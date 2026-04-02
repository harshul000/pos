from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path
from typing import List, Optional
import os
import logging
import json
import hashlib
import hmac
from datetime import datetime, timezone, timedelta
import uuid
from jose import JWTError, jwt
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database import init_db, get_db
from db_models import (
    UserDB, OutletDB, TableDB, MenuCategoryDB, MenuItemDB,
    OrderDB, OrderItemDB, PaymentDB, AppSettingsDB,
)
from models import (
    UserRole, OrderType, OrderStatus, OrderItemStatus,
    PaymentMethod, PaymentStatus, TableStatus,
    UserCreate, UserLogin, GuestLogin, User, Token, TokenData,
    OutletCreate, Outlet,
    TableCreate, Table, 
    MenuCategoryCreate, MenuCategory,
    MenuItemCreate, MenuItem,
    OrderCreate, Order, OrderItem, OrderWithItems,
    QROrderCreate,
    ManualOrderCreate, AddItemsRequest, MarkPaymentRequest,
)
from auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_current_user,
    decode_token,
)
from email_service import email_service
from redis_cache import redis_cache
from qr_service import generate_qr_code, get_qr_url
from razorpay_service import razorpay_service

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI(title="DH POS API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ─── Startup / Shutdown ──────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    await init_db()
    # Run migrations to add any new columns safely
    try:
        import migrate as _mig
        import asyncio as _asyncio
        await _mig.run()
    except Exception as e:
        logger.warning(f"Migration warning (non-fatal): {e}")
    from seed import seed_database
    await seed_database()


# ─── Helpers ────────────────────────────────────────────────────────────────

def generate_order_number() -> str:
    date_str = datetime.now(timezone.utc).strftime("%y%m%d")
    return f"ORD-{date_str}-{uuid.uuid4().hex[:4].upper()}"


def _user_to_dict(u: UserDB) -> dict:
    return {
        "id": u.id, "email": u.email, "full_name": u.full_name,
        "phone": u.phone, "role": u.role, "external_hotel_user_id": u.external_hotel_user_id,
        "is_active": u.is_active, "created_at": u.created_at.isoformat(),
    }


async def _require_admin(token_data: TokenData, db: AsyncSession) -> UserDB:
    result = await db.execute(select(UserDB).where(UserDB.id == token_data.user_id))
    user = result.scalar_one_or_none()
    if not user or user.role not in [UserRole.SUPER_ADMIN, UserRole.POS_ADMIN, UserRole.STAFF]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return user


async def _order_with_items(order: OrderDB, db: AsyncSession) -> dict:
    items_result = await db.execute(
        select(OrderItemDB).where(OrderItemDB.order_id == order.id)
    )
    items = items_result.scalars().all()

    table_number = None
    if order.table_id:
        t_result = await db.execute(select(TableDB).where(TableDB.id == order.table_id))
        t = t_result.scalar_one_or_none()
        if t:
            table_number = t.table_number

    return {
        "id": order.id,
        "order_number": order.order_number,
        "outlet_id": order.outlet_id,
        "table_id": order.table_id,
        "guest_user_id": order.guest_user_id,
        "guest_name": order.guest_name,
        "order_type": order.order_type,
        "status": order.status,
        "subtotal": order.subtotal,
        "tax_amount": order.tax_amount,
        "discount_amount": order.discount_amount,
        "total_amount": order.total_amount,
        "notes": order.notes,
        "created_at": order.created_at.isoformat(),
        "updated_at": order.updated_at.isoformat(),
        "items": [
            {
                "id": i.id, "order_id": i.order_id, "menu_item_id": i.menu_item_id,
                "quantity": i.quantity, "unit_price": i.unit_price, "subtotal": i.subtotal,
                "special_instructions": i.special_instructions, "status": i.status,
            }
            for i in items
        ],
        "table_number": table_number,
    }


async def _build_order(
    outlet_id: str,
    table_id: Optional[str],
    guest_name: Optional[str],
    order_type: OrderType,
    notes: Optional[str],
    items_data: list,
    guest_user_id: Optional[str],
    db: AsyncSession,
) -> OrderDB:
    order_id = str(uuid.uuid4())
    subtotal = 0.0
    order_items = []

    for item_data in items_data:
        mi_result = await db.execute(select(MenuItemDB).where(MenuItemDB.id == item_data.menu_item_id))
        mi = mi_result.scalar_one_or_none()
        if not mi or not mi.is_available:
            raise HTTPException(status_code=400, detail=f"Menu item {item_data.menu_item_id} not available")
        item_subtotal = mi.price * item_data.quantity
        subtotal += item_subtotal
        order_items.append(OrderItemDB(
            id=str(uuid.uuid4()),
            order_id=order_id,
            menu_item_id=item_data.menu_item_id,
            quantity=item_data.quantity,
            unit_price=mi.price,
            subtotal=item_subtotal,
            special_instructions=item_data.special_instructions,
            status=OrderItemStatus.PENDING,
        ))

    tax_amount = round(subtotal * 0.05, 2)
    total_amount = round(subtotal + tax_amount, 2)

    order = OrderDB(
        id=order_id,
        order_number=generate_order_number(),
        outlet_id=outlet_id,
        table_id=table_id,
        guest_user_id=guest_user_id,
        guest_name=guest_name,
        order_type=order_type,
        status=OrderStatus.PENDING,
        subtotal=round(subtotal, 2),
        tax_amount=tax_amount,
        discount_amount=0.0,
        total_amount=total_amount,
        notes=notes,
    )
    db.add(order)
    for oi in order_items:
        db.add(oi)

    if table_id:
        await db.execute(
            select(TableDB).where(TableDB.id == table_id)
        )
        t_result = await db.execute(select(TableDB).where(TableDB.id == table_id))
        t = t_result.scalar_one_or_none()
        if t:
            t.status = TableStatus.OCCUPIED

    await db.commit()
    await db.refresh(order)
    return order


# ─── Auth ────────────────────────────────────────────────────────────────────

@api_router.post("/auth/register", response_model=User)
async def register_user(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserDB).where(UserDB.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = UserDB(
        id=str(uuid.uuid4()),
        email=user_data.email,
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=user_data.role,
        password_hash=get_password_hash(user_data.password),
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return User(**_user_to_dict(user))


@api_router.post("/auth/login", response_model=Token)
async def login_user(login_data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserDB).where(UserDB.email == login_data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")
    return Token(
        access_token=create_access_token({"sub": user.id, "email": user.email}),
        refresh_token=create_refresh_token({"sub": user.id, "email": user.email}),
    )


@api_router.post("/auth/guest-login", response_model=Token)
async def guest_login(guest_data: GuestLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserDB).where(UserDB.email == guest_data.email))
    user = result.scalar_one_or_none()
    if not user:
        user = UserDB(
            id=str(uuid.uuid4()),
            email=guest_data.email,
            full_name=guest_data.name,
            role=UserRole.GUEST,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return Token(
        access_token=create_access_token({"sub": user.id, "email": user.email}),
        refresh_token=create_refresh_token({"sub": user.id, "email": user.email}),
    )


@api_router.post("/auth/hotel-sso", response_model=Token)
async def hotel_sso(request: Request, db: AsyncSession = Depends(get_db)):
    """Exchange a Hotel PMS JWT for a POS access token.
    Accepts token via Authorization: Bearer <token> header OR {hotel_token: ...} JSON body.
    """
    # Support both Authorization header and JSON body
    hotel_token = None
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        hotel_token = auth_header.split(' ', 1)[1]
    else:
        try:
            body = await request.json()
            hotel_token = body.get("hotel_token")
        except Exception:
            pass

    if not hotel_token:
        raise HTTPException(status_code=400, detail="hotel_token is required (Authorization header or JSON body)")

    # Read secret from DB first, fall back to .env
    setting_result = await db.execute(
        select(AppSettingsDB).where(AppSettingsDB.key == "hotel_sso_secret")
    )
    setting = setting_result.scalar_one_or_none()
    hotel_secret = (setting.value if setting and setting.value else None) or os.environ.get('HOTEL_SAAS_JWT_SECRET')

    if not hotel_secret:
        raise HTTPException(status_code=503, detail="Hotel SSO not configured")

    # Check if SSO is enabled (DB overrides .env)
    enabled_setting = await db.execute(
        select(AppSettingsDB).where(AppSettingsDB.key == "hotel_sso_enabled")
    )
    enabled_row = enabled_setting.scalar_one_or_none()
    if enabled_row and enabled_row.value == "false":
        raise HTTPException(status_code=403, detail="Hotel SSO is disabled")

    try:
        payload = jwt.decode(hotel_token, hotel_secret, algorithms=["HS256"])
        hotel_user_id = payload.get("sub")
        if not hotel_user_id:
            raise HTTPException(status_code=401, detail="Invalid hotel token: missing sub")

        email = payload.get("email") or f"hotel_{hotel_user_id}@dhsolutions.com"
        full_name = payload.get("full_name") or payload.get("name") or "Hotel Guest"

        # Map hotel PMS role → POS role
        hotel_role = payload.get("role", "")
        if hotel_role in ("super_admin", "property_admin", "manager", "admin"):
            pos_role = UserRole.POS_ADMIN
        else:
            pos_role = UserRole.STAFF

        result = await db.execute(select(UserDB).where(UserDB.external_hotel_user_id == hotel_user_id))
        user = result.scalar_one_or_none()

        if not user:
            # Check by email to avoid duplicates
            email_result = await db.execute(select(UserDB).where(UserDB.email == email))
            existing_by_email = email_result.scalar_one_or_none()
            if existing_by_email:
                user = existing_by_email
                user.external_hotel_user_id = hotel_user_id
                user.role = pos_role  # update role in case it changed
                await db.commit()
            else:
                user = UserDB(
                    id=str(uuid.uuid4()),
                    email=email,
                    full_name=full_name,
                    role=pos_role,
                    external_hotel_user_id=hotel_user_id,
                    is_active=True,
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)
        else:
            # Update role in case hotel role changed
            user.role = pos_role
            await db.commit()

        return Token(
            access_token=create_access_token({"sub": user.id, "email": user.email}),
            refresh_token=create_refresh_token({"sub": user.id, "email": user.email}),
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid hotel token")



@api_router.post("/auth/refresh", response_model=Token)
async def refresh_token_endpoint(request: Request):
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token_data = decode_token(auth_header.split(' ')[1])
    return Token(
        access_token=create_access_token({"sub": token_data.user_id, "email": token_data.email}),
        refresh_token=create_refresh_token({"sub": token_data.user_id, "email": token_data.email}),
    )


@api_router.get("/auth/me", response_model=User)
async def get_me(token_data: TokenData = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserDB).where(UserDB.id == token_data.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**_user_to_dict(user))


# ─── Public Menu ─────────────────────────────────────────────────────────────

@api_router.get("/menu/{outlet_id}")
async def get_menu(outlet_id: str, db: AsyncSession = Depends(get_db)):
    cache_key = f"menu:{outlet_id}"
    cached = await redis_cache.get(cache_key)
    if cached:
        return cached

    cats_result = await db.execute(
        select(MenuCategoryDB)
        .where(MenuCategoryDB.outlet_id == outlet_id, MenuCategoryDB.is_active == True)
        .order_by(MenuCategoryDB.display_order)
    )
    categories = cats_result.scalars().all()

    menu_data = []
    for cat in categories:
        items_result = await db.execute(
            select(MenuItemDB)
            .where(MenuItemDB.outlet_id == outlet_id, MenuItemDB.category_id == cat.id, MenuItemDB.is_available == True)
        )
        items = items_result.scalars().all()
        menu_data.append({
            "category": {"id": cat.id, "outlet_id": cat.outlet_id, "name": cat.name,
                         "display_order": cat.display_order, "is_active": cat.is_active},
            "items": [
                {"id": i.id, "outlet_id": i.outlet_id, "category_id": i.category_id, "name": i.name,
                 "description": i.description, "price": i.price, "image_url": i.image_url,
                 "is_available": i.is_available, "is_veg": i.is_veg, "prep_time_minutes": i.prep_time_minutes,
                 "tags": i.tags, "created_at": i.created_at.isoformat()}
                for i in items
            ],
        })

    await redis_cache.set(cache_key, menu_data, expire=600)
    return menu_data


@api_router.get("/menu/item/{item_id}")
async def get_menu_item(item_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MenuItemDB).where(MenuItemDB.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return {"id": item.id, "name": item.name, "price": item.price, "description": item.description,
            "is_veg": item.is_veg, "is_available": item.is_available, "tags": item.tags}


@api_router.get("/public/outlets")
async def get_public_outlets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OutletDB).where(OutletDB.is_active == True))
    outlets = result.scalars().all()
    return [{"id": o.id, "name": o.name, "description": o.description, "image_url": o.image_url} for o in outlets]


@api_router.get("/public/tables/{outlet_id}")
async def get_public_tables(outlet_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TableDB).where(TableDB.outlet_id == outlet_id, TableDB.status == TableStatus.AVAILABLE)
    )
    tables = result.scalars().all()
    return [{"id": t.id, "table_number": t.table_number, "capacity": t.capacity, "status": t.status} for t in tables]


# ─── QR Ordering ─────────────────────────────────────────────────────────────

@api_router.get("/qr/{qr_token}")
async def get_qr_info(qr_token: str, db: AsyncSession = Depends(get_db)):
    t_result = await db.execute(select(TableDB).where(TableDB.qr_token == qr_token))
    table = t_result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Invalid QR code")

    o_result = await db.execute(select(OutletDB).where(OutletDB.id == table.outlet_id))
    outlet = o_result.scalar_one_or_none()
    if not outlet or not outlet.is_active:
        raise HTTPException(status_code=404, detail="Outlet not found or inactive")

    menu_data = await get_menu(outlet.id, db)

    return {
        "table": {"id": table.id, "table_number": table.table_number, "capacity": table.capacity,
                  "status": table.status, "qr_token": table.qr_token, "outlet_id": table.outlet_id},
        "outlet": {"id": outlet.id, "name": outlet.name, "description": outlet.description,
                   "image_url": outlet.image_url},
        "menu": menu_data,
    }


@api_router.post("/qr/{qr_token}/order")
async def create_qr_order(qr_token: str, order_data: QROrderCreate, db: AsyncSession = Depends(get_db)):
    t_result = await db.execute(select(TableDB).where(TableDB.qr_token == qr_token))
    table = t_result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Invalid QR code")

    o_result = await db.execute(select(OutletDB).where(OutletDB.id == table.outlet_id))
    outlet = o_result.scalar_one_or_none()
    if not outlet or not outlet.is_active:
        raise HTTPException(status_code=404, detail="Outlet not active")

    order = await _build_order(
        outlet_id=outlet.id, table_id=table.id,
        guest_name=order_data.guest_name, order_type=OrderType.DINE_IN,
        notes=order_data.notes, items_data=order_data.items,
        guest_user_id=None, db=db,
    )
    await redis_cache.clear_pattern("orders:*")
    return await _order_with_items(order, db)


@api_router.post("/public/orders")
async def create_public_order(order_data: OrderCreate, db: AsyncSession = Depends(get_db)):
    o_result = await db.execute(select(OutletDB).where(OutletDB.id == order_data.outlet_id))
    outlet = o_result.scalar_one_or_none()
    if not outlet or not outlet.is_active:
        raise HTTPException(status_code=404, detail="Outlet not found or inactive")

    if order_data.table_id:
        t_result = await db.execute(select(TableDB).where(TableDB.id == order_data.table_id))
        if not t_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Table not found")

    order = await _build_order(
        outlet_id=order_data.outlet_id, table_id=order_data.table_id,
        guest_name=order_data.guest_name, order_type=order_data.order_type,
        notes=order_data.notes, items_data=order_data.items,
        guest_user_id=None, db=db,
    )
    await redis_cache.clear_pattern("orders:*")
    return await _order_with_items(order, db)


# ─── Orders ──────────────────────────────────────────────────────────────────

@api_router.get("/orders")
async def get_orders(
    outlet_id: Optional[str] = None,
    status: Optional[OrderStatus] = None,
    date: Optional[str] = None,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(token_data, db)

    query = select(OrderDB).order_by(OrderDB.created_at.desc())
    if outlet_id:
        query = query.where(OrderDB.outlet_id == outlet_id)
    if status:
        query = query.where(OrderDB.status == status)
    if date:
        day_start = datetime.fromisoformat(date).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        query = query.where(OrderDB.created_at >= day_start, OrderDB.created_at < day_end)

    result = await db.execute(query)
    orders = result.scalars().all()
    return [await _order_with_items(o, db) for o in orders]


@api_router.post("/orders")
async def create_manual_order(
    order_data: OrderCreate,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(token_data, db)

    o_result = await db.execute(select(OutletDB).where(OutletDB.id == order_data.outlet_id))
    outlet = o_result.scalar_one_or_none()
    if not outlet or not outlet.is_active:
        raise HTTPException(status_code=404, detail="Outlet not found or inactive")

    order = await _build_order(
        outlet_id=order_data.outlet_id, table_id=order_data.table_id,
        guest_name=order_data.guest_name, order_type=order_data.order_type,
        notes=order_data.notes, items_data=order_data.items,
        guest_user_id=None, db=db,
    )
    await redis_cache.clear_pattern("orders:*")
    return await _order_with_items(order, db)


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OrderDB).where(OrderDB.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return await _order_with_items(order, db)


@api_router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    status: OrderStatus,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(token_data, db)
    result = await db.execute(select(OrderDB).where(OrderDB.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = status
    if status == OrderStatus.COMPLETED and order.table_id:
        t_result = await db.execute(select(TableDB).where(TableDB.id == order.table_id))
        t = t_result.scalar_one_or_none()
        if t:
            t.status = TableStatus.AVAILABLE
    await db.commit()
    await redis_cache.clear_pattern("orders:*")
    return {"message": "Order status updated successfully"}


@api_router.patch("/orders/{order_id}/items/{item_id}/status")
async def update_order_item_status(
    order_id: str,
    item_id: str,
    status: OrderItemStatus,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(token_data, db)
    result = await db.execute(
        select(OrderItemDB).where(OrderItemDB.id == item_id, OrderItemDB.order_id == order_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")
    item.status = status
    await db.commit()
    await redis_cache.clear_pattern("orders:*")
    return {"message": "Order item status updated successfully"}


@api_router.post("/orders/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(token_data, db)
    result = await db.execute(select(OrderDB).where(OrderDB.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status in [OrderStatus.COMPLETED, OrderStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="Cannot cancel completed or already cancelled order")

    order.status = OrderStatus.CANCELLED
    if order.table_id:
        t_result = await db.execute(select(TableDB).where(TableDB.id == order.table_id))
        t = t_result.scalar_one_or_none()
        if t:
            t.status = TableStatus.AVAILABLE
    await db.commit()
    await redis_cache.clear_pattern("orders:*")
    return {"message": "Order cancelled successfully"}


# ─── Bill Generation ─────────────────────────────────────────────────────────

@api_router.get("/admin/orders/{order_id}/bill")
async def get_order_bill(
    order_id: str,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a structured bill/receipt for an order — for printing or display."""
    await _require_admin(token_data, db)

    result = await db.execute(select(OrderDB).where(OrderDB.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    items_result = await db.execute(select(OrderItemDB).where(OrderItemDB.order_id == order_id))
    order_items = items_result.scalars().all()

    outlet_result = await db.execute(select(OutletDB).where(OutletDB.id == order.outlet_id))
    outlet = outlet_result.scalar_one_or_none()

    table_number = None
    if order.table_id:
        t_result = await db.execute(select(TableDB).where(TableDB.id == order.table_id))
        t = t_result.scalar_one_or_none()
        if t:
            table_number = t.table_number

    bill_items = []
    for oi in order_items:
        mi_result = await db.execute(select(MenuItemDB).where(MenuItemDB.id == oi.menu_item_id))
        mi = mi_result.scalar_one_or_none()
        bill_items.append({
            "name": mi.name if mi else "Unknown Item",
            "quantity": oi.quantity,
            "unit_price": oi.unit_price,
            "subtotal": oi.subtotal,
            "special_instructions": oi.special_instructions,
        })

    return {
        "outlet_name": outlet.name if outlet else "DH POS",
        "order_number": order.order_number,
        "table_number": table_number,
        "guest_name": order.guest_name,
        "order_type": order.order_type,
        "billed_at": datetime.now(timezone.utc).isoformat(),
        "items": bill_items,
        "subtotal": order.subtotal,
        "tax_percent": 5,
        "tax_amount": order.tax_amount,
        "discount_amount": order.discount_amount,
        "total_amount": order.total_amount,
        "status": order.status,
    }


# ─── Payments ────────────────────────────────────────────────────────────────

@api_router.post("/payments/razorpay/order")
async def create_razorpay_order(order_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OrderDB).where(OrderDB.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    razorpay_order = razorpay_service.create_order(
        amount=order.total_amount, currency="INR", receipt=order.order_number
    )

    payment = PaymentDB(
        id=str(uuid.uuid4()),
        order_id=order_id,
        method=PaymentMethod.RAZORPAY,
        status=PaymentStatus.PENDING,
        razorpay_order_id=razorpay_order["id"],
        amount=order.total_amount,
    )
    db.add(payment)
    await db.commit()

    return {
        "razorpay_order_id": razorpay_order["id"],
        "amount": razorpay_order["amount"],
        "currency": razorpay_order["currency"],
        "key_id": razorpay_service.key_id,
    }


@api_router.post("/payments/razorpay/verify")
async def verify_razorpay_payment(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
    db: AsyncSession = Depends(get_db),
):
    is_valid = razorpay_service.verify_payment_signature(
        razorpay_order_id, razorpay_payment_id, razorpay_signature
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    p_result = await db.execute(select(PaymentDB).where(PaymentDB.razorpay_order_id == razorpay_order_id))
    payment = p_result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    payment.status = PaymentStatus.COMPLETED
    payment.razorpay_payment_id = razorpay_payment_id

    o_result = await db.execute(select(OrderDB).where(OrderDB.id == payment.order_id))
    order = o_result.scalar_one_or_none()
    if order:
        order.status = OrderStatus.CONFIRMED
    await db.commit()
    return {"message": "Payment verified successfully"}


@api_router.post("/payments/razorpay/webhook")
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    is_valid = razorpay_service.verify_webhook_signature(body, signature)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload = json.loads(body)
    event = payload.get("event")

    if event == "payment.captured":
        payment_entity = payload["payload"]["payment"]["entity"]
        rp_payment_id = payment_entity["id"]
        rp_order_id = payment_entity["order_id"]

        p_result = await db.execute(select(PaymentDB).where(PaymentDB.razorpay_order_id == rp_order_id))
        payment = p_result.scalar_one_or_none()
        if payment:
            payment.status = PaymentStatus.COMPLETED
            payment.razorpay_payment_id = rp_payment_id
            await db.commit()
    return {"status": "processed"}


@api_router.post("/payments/cash")
async def mark_cash_payment(
    order_id: str,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(token_data, db)
    result = await db.execute(select(OrderDB).where(OrderDB.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    payment = PaymentDB(
        id=str(uuid.uuid4()),
        order_id=order_id,
        method=PaymentMethod.CASH,
        status=PaymentStatus.COMPLETED,
        amount=order.total_amount,
    )
    db.add(payment)
    order.status = OrderStatus.CONFIRMED
    await db.commit()
    return {"message": "Cash payment recorded successfully"}


# ─── Admin — Outlets ─────────────────────────────────────────────────────────

@api_router.get("/admin/outlets")
async def get_outlets(token_data: TokenData = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _require_admin(token_data, db)
    result = await db.execute(select(OutletDB))
    outlets = result.scalars().all()
    return [{"id": o.id, "name": o.name, "description": o.description,
             "image_url": o.image_url, "is_active": o.is_active,
             "created_at": o.created_at.isoformat()} for o in outlets]


@api_router.post("/admin/outlets")
async def create_outlet(
    outlet_data: OutletCreate,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(token_data, db)
    outlet = OutletDB(id=str(uuid.uuid4()), **outlet_data.model_dump())
    db.add(outlet)
    await db.commit()
    await db.refresh(outlet)
    return {"id": outlet.id, "name": outlet.name, "is_active": outlet.is_active,
            "created_at": outlet.created_at.isoformat()}


# ─── Admin — Tables ──────────────────────────────────────────────────────────

@api_router.get("/admin/tables/{outlet_id}")
async def get_tables(outlet_id: str, token_data: TokenData = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _require_admin(token_data, db)
    result = await db.execute(select(TableDB).where(TableDB.outlet_id == outlet_id))
    tables = result.scalars().all()
    return [{"id": t.id, "outlet_id": t.outlet_id, "table_number": t.table_number,
             "capacity": t.capacity, "qr_token": t.qr_token, "status": t.status,
             "created_at": t.created_at.isoformat()} for t in tables]


@api_router.post("/admin/tables/{outlet_id}")
async def create_table(
    outlet_id: str,
    table_data: TableCreate,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(token_data, db)
    table = TableDB(id=str(uuid.uuid4()), qr_token=str(uuid.uuid4()), **table_data.model_dump())
    db.add(table)
    await db.commit()
    await db.refresh(table)
    return {"id": table.id, "outlet_id": table.outlet_id, "table_number": table.table_number,
            "capacity": table.capacity, "qr_token": table.qr_token, "status": table.status,
            "created_at": table.created_at.isoformat()}


@api_router.get("/admin/tables/{outlet_id}/qr-codes")
async def get_table_qr_codes(outlet_id: str, token_data: TokenData = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _require_admin(token_data, db)
    result = await db.execute(select(TableDB).where(TableDB.outlet_id == outlet_id))
    tables = result.scalars().all()
    return [
        {
            "table_id": t.id, "table_number": t.table_number, "qr_token": t.qr_token,
            "qr_url": get_qr_url(t.qr_token), "qr_image": generate_qr_code(get_qr_url(t.qr_token)),
        }
        for t in tables
    ]


@api_router.post("/admin/tables/{table_id}/regenerate-qr")
async def regenerate_qr(table_id: str, token_data: TokenData = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _require_admin(token_data, db)
    result = await db.execute(select(TableDB).where(TableDB.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    table.qr_token = str(uuid.uuid4())
    await db.commit()
    qr_url = get_qr_url(table.qr_token)
    return {"qr_token": table.qr_token, "qr_url": qr_url, "qr_image": generate_qr_code(qr_url)}


# ─── Admin — Menu ────────────────────────────────────────────────────────────

@api_router.get("/admin/menu/categories")
async def get_categories(outlet_id: str, token_data: TokenData = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _require_admin(token_data, db)
    result = await db.execute(
        select(MenuCategoryDB).where(MenuCategoryDB.outlet_id == outlet_id).order_by(MenuCategoryDB.display_order)
    )
    cats = result.scalars().all()
    return [{"id": c.id, "outlet_id": c.outlet_id, "name": c.name,
             "display_order": c.display_order, "is_active": c.is_active} for c in cats]


@api_router.post("/admin/menu/categories")
async def create_category(
    category_data: MenuCategoryCreate,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(token_data, db)
    cat = MenuCategoryDB(id=str(uuid.uuid4()), **category_data.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    await redis_cache.clear_pattern("menu:*")
    return {"id": cat.id, "outlet_id": cat.outlet_id, "name": cat.name,
            "display_order": cat.display_order, "is_active": cat.is_active}


@api_router.get("/admin/menu/items")
async def get_menu_items(outlet_id: str, token_data: TokenData = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _require_admin(token_data, db)
    result = await db.execute(select(MenuItemDB).where(MenuItemDB.outlet_id == outlet_id))
    items = result.scalars().all()
    return [{"id": i.id, "outlet_id": i.outlet_id, "category_id": i.category_id, "name": i.name,
             "description": i.description, "price": i.price, "image_url": i.image_url,
             "is_available": i.is_available, "is_veg": i.is_veg, "prep_time_minutes": i.prep_time_minutes,
             "tags": i.tags, "created_at": i.created_at.isoformat()} for i in items]


@api_router.post("/admin/menu/items")
async def create_menu_item(
    item_data: MenuItemCreate,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(token_data, db)
    item = MenuItemDB(id=str(uuid.uuid4()), **item_data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    await redis_cache.clear_pattern("menu:*")
    return {"id": item.id, "name": item.name, "price": item.price, "is_available": item.is_available,
            "created_at": item.created_at.isoformat()}


@api_router.patch("/admin/menu/items/{item_id}/toggle-availability")
async def toggle_item_availability(
    item_id: str,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(token_data, db)
    result = await db.execute(select(MenuItemDB).where(MenuItemDB.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    item.is_available = not item.is_available
    await db.commit()
    await redis_cache.clear_pattern("menu:*")
    return {"is_available": item.is_available}


# ─── Admin — Dashboard ───────────────────────────────────────────────────────

@api_router.get("/admin/dashboard/{outlet_id}")
async def get_dashboard(outlet_id: str, token_data: TokenData = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _require_admin(token_data, db)

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    orders_result = await db.execute(
        select(OrderDB).where(
            OrderDB.outlet_id == outlet_id,
            OrderDB.created_at >= today_start,
            OrderDB.created_at < today_end,
            OrderDB.status != OrderStatus.CANCELLED,
        )
    )
    todays_orders = orders_result.scalars().all()
    todays_revenue = sum(o.total_amount for o in todays_orders)
    todays_count = len(todays_orders)
    avg_order_value = todays_revenue / todays_count if todays_count > 0 else 0

    active_tables_result = await db.execute(
        select(func.count(TableDB.id)).where(
            TableDB.outlet_id == outlet_id, TableDB.status == TableStatus.OCCUPIED
        )
    )
    active_tables = active_tables_result.scalar_one()

    # Top items
    item_counts: dict = {}
    for order in todays_orders:
        items_result = await db.execute(select(OrderItemDB).where(OrderItemDB.order_id == order.id))
        for oi in items_result.scalars().all():
            if oi.menu_item_id not in item_counts:
                item_counts[oi.menu_item_id] = {"quantity": 0, "item_id": oi.menu_item_id}
            item_counts[oi.menu_item_id]["quantity"] += oi.quantity

    top_items = sorted(item_counts.values(), key=lambda x: x["quantity"], reverse=True)[:5]
    for item in top_items:
        mi_result = await db.execute(select(MenuItemDB).where(MenuItemDB.id == item["item_id"]))
        mi = mi_result.scalar_one_or_none()
        if mi:
            item["name"] = mi.name
            item["price"] = mi.price

    # Revenue trend (last 7 days)
    revenue_trend = []
    for i in range(6, -1, -1):
        day_start = today_start - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        day_result = await db.execute(
            select(func.coalesce(func.sum(OrderDB.total_amount), 0)).where(
                OrderDB.outlet_id == outlet_id,
                OrderDB.created_at >= day_start,
                OrderDB.created_at < day_end,
                OrderDB.status != OrderStatus.CANCELLED,
            )
        )
        revenue_trend.append({"date": day_start.strftime("%Y-%m-%d"), "revenue": day_result.scalar_one()})

    return {
        "todays_revenue": todays_revenue,
        "todays_orders": todays_count,
        "avg_order_value": avg_order_value,
        "active_tables": active_tables,
        "top_items": top_items,
        "revenue_trend": revenue_trend,
    }


# ─── Admin — Live Orders ─────────────────────────────────────────────────────

@api_router.get("/admin/live-orders/{outlet_id}")
async def get_live_orders(outlet_id: str, token_data: TokenData = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _require_admin(token_data, db)
    result = await db.execute(
        select(OrderDB).where(
            OrderDB.outlet_id == outlet_id,
            OrderDB.status.in_([
                OrderStatus.PENDING, OrderStatus.CONFIRMED,
                OrderStatus.PREPARING, OrderStatus.READY,
            ]),
        ).order_by(OrderDB.created_at)
    )
    orders = result.scalars().all()

    out = []
    for order in orders:
        items_result = await db.execute(select(OrderItemDB).where(OrderItemDB.order_id == order.id))
        items = items_result.scalars().all()
        enriched_items = []
        for oi in items:
            mi_result = await db.execute(select(MenuItemDB).where(MenuItemDB.id == oi.menu_item_id))
            mi = mi_result.scalar_one_or_none()
            enriched_items.append({
                "id": oi.id, "menu_item_id": oi.menu_item_id,
                "menu_item_name": mi.name if mi else "Unknown",
                "quantity": oi.quantity, "status": oi.status,
                "special_instructions": oi.special_instructions,
            })

        table_number = None
        if order.table_id:
            t_result = await db.execute(select(TableDB).where(TableDB.id == order.table_id))
            t = t_result.scalar_one_or_none()
            if t:
                table_number = t.table_number

        out.append({
            "id": order.id, "order_number": order.order_number, "table_number": table_number,
            "guest_name": order.guest_name, "order_type": order.order_type, "status": order.status,
            "total_amount": order.total_amount, "created_at": order.created_at.isoformat(),
            "items": enriched_items,
        })
    return out


# ─── Admin — Analytics ───────────────────────────────────────────────────────

@api_router.get("/admin/analytics/{outlet_id}")
async def get_analytics(
    outlet_id: str,
    period: str = "7d",
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_admin(token_data, db)

    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 7)
    end_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    start_date = end_date - timedelta(days=days)

    result = await db.execute(
        select(OrderDB).where(
            OrderDB.outlet_id == outlet_id,
            OrderDB.created_at >= start_date,
            OrderDB.created_at < end_date,
            OrderDB.status != OrderStatus.CANCELLED,
        )
    )
    orders = result.scalars().all()

    revenue_trend = []
    for i in range(days):
        day_start = start_date + timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        day_orders = [o for o in orders if day_start <= o.created_at.replace(tzinfo=timezone.utc) < day_end]
        revenue_trend.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "revenue": sum(o.total_amount for o in day_orders),
            "orders": len(day_orders),
        })

    order_type_breakdown: dict = {}
    hour_distribution: dict = {}
    for order in orders:
        ot = str(order.order_type)
        order_type_breakdown[ot] = order_type_breakdown.get(ot, 0) + 1
        h = order.created_at.hour
        hour_distribution[h] = hour_distribution.get(h, 0) + 1

    peak_hours = sorted(
        [{"hour": h, "orders": c} for h, c in hour_distribution.items()],
        key=lambda x: x["orders"], reverse=True
    )[:5]

    return {
        "revenue_trend": revenue_trend,
        "order_type_breakdown": order_type_breakdown,
        "peak_hours": peak_hours,
        "total_revenue": sum(o.total_amount for o in orders),
        "total_orders": len(orders),
    }



# ─── Waiter Portal Endpoints ─────────────────────────────────────────────────

async def _require_staff(token_data: TokenData, db: AsyncSession) -> UserDB:
    """Allow STAFF (waiter) and admin roles."""
    result = await db.execute(select(UserDB).where(UserDB.id == token_data.user_id))
    user = result.scalar_one_or_none()
    if not user or user.role not in [UserRole.SUPER_ADMIN, UserRole.POS_ADMIN, UserRole.STAFF]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff access required")
    return user


@api_router.get("/waiter/tables")
async def waiter_get_tables(
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all outlets and their tables with live status."""
    user = await _require_staff(token_data, db)
    outlets_result = await db.execute(select(OutletDB).where(OutletDB.is_active == True))
    outlets = outlets_result.scalars().all()
    data = []
    for outlet in outlets:
        tables_result = await db.execute(
            select(TableDB).where(TableDB.outlet_id == outlet.id).order_by(TableDB.table_number)
        )
        tables = tables_result.scalars().all()
        data.append({
            "outlet_id": outlet.id,
            "outlet_name": outlet.name,
            "tables": [
                {
                    "id": t.id, "table_number": t.table_number,
                    "capacity": t.capacity, "status": t.status,
                } for t in tables
            ]
        })
    return data


@api_router.get("/waiter/menu/{outlet_id}")
async def waiter_get_menu(
    outlet_id: str,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full menu grouped by category for an outlet."""
    user = await _require_staff(token_data, db)
    cats_result = await db.execute(
        select(MenuCategoryDB)
        .where(MenuCategoryDB.outlet_id == outlet_id, MenuCategoryDB.is_active == True)
        .order_by(MenuCategoryDB.display_order)
    )
    categories = cats_result.scalars().all()
    result = []
    for cat in categories:
        items_result = await db.execute(
            select(MenuItemDB)
            .where(MenuItemDB.category_id == cat.id, MenuItemDB.is_available == True)
            .order_by(MenuItemDB.name)
        )
        items = items_result.scalars().all()
        result.append({
            "category_id": cat.id,
            "category_name": cat.name,
            "items": [
                {
                    "id": i.id, "name": i.name, "description": i.description,
                    "price": i.price, "is_veg": i.is_veg,
                    "prep_time_minutes": i.prep_time_minutes, "tags": i.tags,
                    "image_url": i.image_url,
                } for i in items
            ]
        })
    return result


@api_router.post("/waiter/orders")
async def waiter_create_order(
    payload: ManualOrderCreate,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a manual order — waiter picks table + items."""
    user = await _require_staff(token_data, db)
    order = await _build_order(
        outlet_id=payload.outlet_id,
        table_id=payload.table_id,
        guest_name=payload.guest_name or user.full_name,
        order_type=payload.order_type,
        notes=payload.notes,
        items_data=payload.items,
        guest_user_id=None,
        db=db,
    )
    # Stamp waiter and cover count
    order.waiter_id = user.id
    order.cover_count = payload.cover_count
    await db.commit()
    await db.refresh(order)
    return await _order_with_items(order, db)


@api_router.get("/waiter/orders")
async def waiter_list_orders(
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the waiter's own active orders (today)."""
    user = await _require_staff(token_data, db)
    from datetime import date
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(OrderDB)
        .where(
            OrderDB.waiter_id == user.id,
            OrderDB.created_at >= today_start,
        )
        .order_by(OrderDB.created_at.desc())
    )
    orders = result.scalars().all()
    return [await _order_with_items(o, db) for o in orders]


@api_router.get("/waiter/orders/{order_id}")
async def waiter_get_order(
    order_id: str,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full order details + bill."""
    user = await _require_staff(token_data, db)
    result = await db.execute(select(OrderDB).where(OrderDB.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return await _order_with_items(order, db)


@api_router.post("/waiter/orders/{order_id}/items")
async def waiter_add_items(
    order_id: str,
    payload: AddItemsRequest,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add more items to an existing order."""
    user = await _require_staff(token_data, db)
    result = await db.execute(select(OrderDB).where(OrderDB.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status in [OrderStatus.COMPLETED, OrderStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="Cannot modify a closed order")

    added_subtotal = 0.0
    for item_data in payload.items:
        mi_result = await db.execute(select(MenuItemDB).where(MenuItemDB.id == item_data.menu_item_id))
        mi = mi_result.scalar_one_or_none()
        if not mi or not mi.is_available:
            raise HTTPException(status_code=400, detail=f"Item {item_data.menu_item_id} not available")
        item_subtotal = mi.price * item_data.quantity
        added_subtotal += item_subtotal
        db.add(OrderItemDB(
            id=str(uuid.uuid4()),
            order_id=order_id,
            menu_item_id=item_data.menu_item_id,
            quantity=item_data.quantity,
            unit_price=mi.price,
            subtotal=item_subtotal,
            special_instructions=item_data.special_instructions,
            status=OrderItemStatus.PENDING,
        ))

    order.subtotal = round(order.subtotal + added_subtotal, 2)
    order.tax_amount = round(order.subtotal * 0.05, 2)
    order.total_amount = round(order.subtotal + order.tax_amount - order.discount_amount, 2)
    await db.commit()
    await db.refresh(order)
    return await _order_with_items(order, db)


@api_router.patch("/waiter/orders/{order_id}/status")
async def waiter_update_status(
    order_id: str,
    new_status: str,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update order status (pending → confirmed → serving → served)."""
    user = await _require_staff(token_data, db)
    result = await db.execute(select(OrderDB).where(OrderDB.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        order.status = OrderStatus(new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {new_status}")

    # Free the table when order is completed or cancelled
    if new_status in ("completed", "cancelled") and order.table_id:
        t_result = await db.execute(select(TableDB).where(TableDB.id == order.table_id))
        t = t_result.scalar_one_or_none()
        if t:
            t.status = TableStatus.AVAILABLE

    await db.commit()
    return {"success": True, "status": order.status}


@api_router.post("/waiter/orders/{order_id}/payment")
async def waiter_mark_payment(
    order_id: str,
    payload: MarkPaymentRequest,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark how the order was paid and close it. Returns change amount for cash."""
    user = await _require_staff(token_data, db)
    result = await db.execute(select(OrderDB).where(OrderDB.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.payment_method = payload.method
    order.status = OrderStatus.COMPLETED

    # Free the table
    if order.table_id:
        t_result = await db.execute(select(TableDB).where(TableDB.id == order.table_id))
        t = t_result.scalar_one_or_none()
        if t:
            t.status = TableStatus.AVAILABLE

    # Record a payment entry
    db.add(PaymentDB(
        id=str(uuid.uuid4()),
        order_id=order_id,
        method=payload.method,
        status=PaymentStatus.COMPLETED,
        amount=order.total_amount,
    ))
    await db.commit()

    change = 0.0
    if payload.method == PaymentMethod.CASH and payload.amount_tendered:
        change = round(payload.amount_tendered - order.total_amount, 2)

    return {
        "success": True,
        "order_number": order.order_number,
        "total_amount": order.total_amount,
        "payment_method": payload.method,
        "change_amount": max(0.0, change),
    }



# ─── Admin: App Settings ──────────────────────────────────────────────────────

SETTING_KEYS = {
    "hotel_sso_enabled",
    "hotel_sso_secret",
    "hotel_saas_url",
    "tax_percentage",
    "service_charge_enabled",
    "service_charge_percentage",
}


async def _get_all_settings(db: AsyncSession) -> dict:
    result = await db.execute(select(AppSettingsDB))
    rows = result.scalars().all()
    return {r.key: r.value for r in rows}


async def _upsert_setting(db: AsyncSession, key: str, value: str):
    result = await db.execute(select(AppSettingsDB).where(AppSettingsDB.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.value = value
    else:
        db.add(AppSettingsDB(key=key, value=value))


@api_router.get("/admin/app-settings")
async def get_app_settings(
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return current application settings (from DB, falling back to .env)."""
    await _require_super_admin(token_data, db)
    stored = await _get_all_settings(db)
    return {
        "hotel_sso_enabled": stored.get("hotel_sso_enabled", os.environ.get("HOTEL_SAAS_ENABLED", "false")),
        "hotel_sso_secret": stored.get("hotel_sso_secret", os.environ.get("HOTEL_SAAS_JWT_SECRET", "")),
        "hotel_saas_url": stored.get("hotel_saas_url", os.environ.get("HOTEL_SAAS_BASE_URL", "")),
        "tax_percentage": stored.get("tax_percentage", "5"),
        "service_charge_enabled": stored.get("service_charge_enabled", "false"),
        "service_charge_percentage": stored.get("service_charge_percentage", "10"),
    }


@api_router.put("/admin/app-settings")
async def save_app_settings(
    payload: dict,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upsert application settings."""
    await _require_super_admin(token_data, db)
    for key, value in payload.items():
        if key in SETTING_KEYS:
            await _upsert_setting(db, key, str(value))
    await db.commit()
    return await _get_all_settings(db)


# ─── Admin: Waiter Management ─────────────────────────────────────────────────

async def _require_super_admin(token_data: TokenData, db: AsyncSession) -> UserDB:
    result = await db.execute(select(UserDB).where(UserDB.id == token_data.user_id))
    user = result.scalar_one_or_none()
    if not user or user.role not in [UserRole.SUPER_ADMIN, UserRole.POS_ADMIN]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


@api_router.get("/admin/waiters")
async def list_waiters(
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all staff/waiter accounts."""
    await _require_super_admin(token_data, db)
    result = await db.execute(
        select(UserDB).where(UserDB.role == UserRole.STAFF).order_by(UserDB.full_name)
    )
    users = result.scalars().all()
    return [_user_to_dict(u) for u in users]


class WaiterCreate(BaseModel):
    full_name: str
    email: str
    password: str
    phone: Optional[str] = None


@api_router.post("/admin/waiters")
async def create_waiter(
    payload: WaiterCreate,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new waiter/staff account."""
    await _require_super_admin(token_data, db)

    existing = await db.execute(select(UserDB).where(UserDB.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already in use")

    user = UserDB(
        id=str(uuid.uuid4()),
        email=payload.email,
        full_name=payload.full_name,
        phone=payload.phone,
        role=UserRole.STAFF,
        password_hash=get_password_hash(payload.password),
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _user_to_dict(user)


@api_router.patch("/admin/waiters/{waiter_id}/toggle")
async def toggle_waiter_active(
    waiter_id: str,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Activate or deactivate a waiter account."""
    await _require_super_admin(token_data, db)
    result = await db.execute(select(UserDB).where(UserDB.id == waiter_id))
    user = result.scalar_one_or_none()
    if not user or user.role != UserRole.STAFF:
        raise HTTPException(status_code=404, detail="Waiter not found")
    user.is_active = not user.is_active
    await db.commit()
    return _user_to_dict(user)


@api_router.delete("/admin/waiters/{waiter_id}")
async def delete_waiter(
    waiter_id: str,
    token_data: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently remove a waiter account."""
    await _require_super_admin(token_data, db)
    result = await db.execute(select(UserDB).where(UserDB.id == waiter_id, UserDB.role == UserRole.STAFF))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Waiter not found")
    await db.delete(user)
    await db.commit()
    return {"success": True}


# ─── App setup ───────────────────────────────────────────────────────────────

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
