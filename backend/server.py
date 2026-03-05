from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
from typing import List, Optional
import os
import logging
from datetime import datetime, timezone, timedelta
import uuid
from jose import JWTError, jwt

from database import connect_to_mongo, close_mongo_connection, get_database
from models import *
from auth import (
    get_password_hash, 
    verify_password, 
    create_access_token, 
    create_refresh_token,
    get_current_user,
    get_current_admin_user,
    decode_token
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

@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()
    from seed import seed_database
    await seed_database()

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

@api_router.post("/auth/register", response_model=User)
async def register_user(user_data: UserCreate):
    db = get_database()
    
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_dict = {
        "id": user_id,
        "email": user_data.email,
        "full_name": user_data.full_name,
        "phone": user_data.phone,
        "role": user_data.role,
        "password_hash": get_password_hash(user_data.password),
        "external_hotel_user_id": None,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_dict)
    user_dict.pop("password_hash")
    return User(**user_dict)

@api_router.post("/auth/login", response_model=Token)
async def login_user(login_data: UserLogin):
    db = get_database()
    
    user = await db.users.find_one({"email": login_data.email}, {"_id": 0})
    if not user or not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active"):
        raise HTTPException(status_code=403, detail="User account is inactive")
    
    access_token = create_access_token(data={"sub": user["id"], "email": user["email"]})
    refresh_token = create_refresh_token(data={"sub": user["id"], "email": user["email"]})
    
    return Token(access_token=access_token, refresh_token=refresh_token)

@api_router.post("/auth/guest-login", response_model=Token)
async def guest_login(guest_data: GuestLogin):
    db = get_database()
    
    user = await db.users.find_one({"email": guest_data.email}, {"_id": 0})
    
    if not user:
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id,
            "email": guest_data.email,
            "full_name": guest_data.name,
            "phone": None,
            "role": UserRole.GUEST,
            "password_hash": "",
            "external_hotel_user_id": None,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user)
    
    access_token = create_access_token(data={"sub": user["id"], "email": user["email"]})
    refresh_token = create_refresh_token(data={"sub": user["id"], "email": user["email"]})
    
    return Token(access_token=access_token, refresh_token=refresh_token)

@api_router.post("/auth/hotel-sso", response_model=Token)
async def hotel_sso(request: Request):
    hotel_enabled = os.environ.get('HOTEL_SAAS_ENABLED', 'false').lower() == 'true'
    if not hotel_enabled:
        raise HTTPException(status_code=400, detail="Hotel SSO not enabled")
    
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    hotel_token = auth_header.split(' ')[1]
    hotel_secret = os.environ.get('HOTEL_SAAS_JWT_SECRET')
    
    if not hotel_secret:
        raise HTTPException(status_code=500, detail="Hotel SSO not configured")
    
    try:
        payload = jwt.decode(hotel_token, hotel_secret, algorithms=["HS256"])
        hotel_user_id = payload.get("sub")
        email = payload.get("email")
        full_name = payload.get("name", "Guest User")
        
        db = get_database()
        user = await db.users.find_one({"external_hotel_user_id": hotel_user_id}, {"_id": 0})
        
        if not user:
            user_id = str(uuid.uuid4())
            user = {
                "id": user_id,
                "email": email,
                "full_name": full_name,
                "phone": None,
                "role": UserRole.GUEST,
                "password_hash": "",
                "external_hotel_user_id": hotel_user_id,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user)
        
        access_token = create_access_token(data={"sub": user["id"], "email": user["email"]})
        refresh_token = create_refresh_token(data={"sub": user["id"], "email": user["email"]})
        
        return Token(access_token=access_token, refresh_token=refresh_token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid hotel token")

@api_router.post("/auth/refresh", response_model=Token)
async def refresh_token(request: Request):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = auth_header.split(' ')[1]
    token_data = decode_token(token)
    
    access_token = create_access_token(data={"sub": token_data.user_id, "email": token_data.email})
    refresh_token = create_refresh_token(data={"sub": token_data.user_id, "email": token_data.email})
    
    return Token(access_token=access_token, refresh_token=refresh_token)

@api_router.get("/auth/me", response_model=User)
async def get_me(token_data: TokenData = Depends(get_current_user)):
    db = get_database()
    user = await db.users.find_one({"id": token_data.user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user)

@api_router.get("/menu/{outlet_id}")
async def get_menu(outlet_id: str):
    db = get_database()
    
    cache_key = f"menu:{outlet_id}"
    cached_menu = await redis_cache.get(cache_key)
    if cached_menu:
        return cached_menu
    
    categories = await db.menu_categories.find(
        {"outlet_id": outlet_id, "is_active": True},
        {"_id": 0}
    ).sort("display_order", 1).to_list(100)
    
    menu_data = []
    for category in categories:
        items = await db.menu_items.find(
            {"outlet_id": outlet_id, "category_id": category["id"], "is_available": True},
            {"_id": 0}
        ).to_list(100)
        
        menu_data.append({
            "category": category,
            "items": items
        })
    
    await redis_cache.set(cache_key, menu_data, expire=600)
    return menu_data

@api_router.get("/menu/item/{item_id}")
async def get_menu_item(item_id: str):
    db = get_database()
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return item

@api_router.get("/qr/{qr_token}")
async def get_qr_info(qr_token: str):
    db = get_database()
    
    table = await db.tables.find_one({"qr_token": qr_token}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Invalid QR code")
    
    outlet = await db.outlets.find_one({"id": table["outlet_id"]}, {"_id": 0})
    if not outlet or not outlet.get("is_active"):
        raise HTTPException(status_code=404, detail="Outlet not found or inactive")
    
    categories = await db.menu_categories.find(
        {"outlet_id": outlet["id"], "is_active": True},
        {"_id": 0}
    ).sort("display_order", 1).to_list(100)
    
    menu_data = []
    for category in categories:
        items = await db.menu_items.find(
            {"outlet_id": outlet["id"], "category_id": category["id"], "is_available": True},
            {"_id": 0}
        ).to_list(100)
        
        menu_data.append({
            "category": category,
            "items": items
        })
    
    return {
        "table": table,
        "outlet": outlet,
        "menu": menu_data
    }

def generate_order_number():
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%y%m%d")
    random_suffix = str(uuid.uuid4())[:4].upper()
    return f"ORD-{date_str}-{random_suffix}"

@api_router.post("/qr/{qr_token}/order", response_model=OrderWithItems)
async def create_qr_order(qr_token: str, order_data: QROrderCreate):
    db = get_database()
    
    table = await db.tables.find_one({"qr_token": qr_token}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Invalid QR code")
    
    outlet = await db.outlets.find_one({"id": table["outlet_id"]}, {"_id": 0})
    if not outlet or not outlet.get("is_active"):
        raise HTTPException(status_code=404, detail="Outlet not active")
    
    order_id = str(uuid.uuid4())
    order_number = generate_order_number()
    
    subtotal = 0.0
    order_items = []
    
    for item_data in order_data.items:
        menu_item = await db.menu_items.find_one({"id": item_data.menu_item_id}, {"_id": 0})
        if not menu_item or not menu_item.get("is_available"):
            raise HTTPException(status_code=400, detail=f"Menu item {item_data.menu_item_id} not available")
        
        item_subtotal = menu_item["price"] * item_data.quantity
        subtotal += item_subtotal
        
        order_item = {
            "id": str(uuid.uuid4()),
            "order_id": order_id,
            "menu_item_id": item_data.menu_item_id,
            "quantity": item_data.quantity,
            "unit_price": menu_item["price"],
            "subtotal": item_subtotal,
            "special_instructions": item_data.special_instructions,
            "status": OrderItemStatus.PENDING
        }
        order_items.append(order_item)
    
    tax_amount = subtotal * 0.05
    total_amount = subtotal + tax_amount
    
    order = {
        "id": order_id,
        "order_number": order_number,
        "outlet_id": outlet["id"],
        "table_id": table["id"],
        "guest_user_id": None,
        "guest_name": order_data.guest_name,
        "order_type": OrderType.DINE_IN,
        "status": OrderStatus.PENDING,
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "discount_amount": 0.0,
        "total_amount": total_amount,
        "notes": order_data.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.insert_one(order)
    await db.order_items.insert_many(order_items)
    
    await db.tables.update_one(
        {"id": table["id"]},
        {"$set": {"status": TableStatus.OCCUPIED}}
    )
    
    await redis_cache.clear_pattern(f"orders:*")
    
    order_with_items = {**order, "items": order_items, "table_number": table["table_number"]}
    return OrderWithItems(**order_with_items)

@api_router.get("/orders", response_model=List[OrderWithItems])
async def get_orders(
    outlet_id: Optional[str] = None,
    status: Optional[OrderStatus] = None,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_admin_user)
):
    db = get_database()
    
    query = {}
    if outlet_id:
        query["outlet_id"] = outlet_id
    if status:
        query["status"] = status
    if date:
        start_date = datetime.fromisoformat(date).replace(hour=0, minute=0, second=0)
        end_date = start_date + timedelta(days=1)
        query["created_at"] = {
            "$gte": start_date.isoformat(),
            "$lt": end_date.isoformat()
        }
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    orders_with_items = []
    for order in orders:
        items = await db.order_items.find({"order_id": order["id"]}, {"_id": 0}).to_list(100)
        
        table_number = None
        if order.get("table_id"):
            table = await db.tables.find_one({"id": order["table_id"]}, {"_id": 0})
            if table:
                table_number = table["table_number"]
        
        order_with_items = {**order, "items": items, "table_number": table_number}
        orders_with_items.append(OrderWithItems(**order_with_items))
    
    return orders_with_items

@api_router.post("/orders", response_model=OrderWithItems)
async def create_manual_order(
    order_data: OrderCreate,
    current_user: dict = Depends(get_current_admin_user)
):
    db = get_database()
    
    outlet = await db.outlets.find_one({"id": order_data.outlet_id}, {"_id": 0})
    if not outlet or not outlet.get("is_active"):
        raise HTTPException(status_code=404, detail="Outlet not found or inactive")
    
    order_id = str(uuid.uuid4())
    order_number = generate_order_number()
    
    subtotal = 0.0
    order_items = []
    
    for item_data in order_data.items:
        menu_item = await db.menu_items.find_one({"id": item_data.menu_item_id}, {"_id": 0})
        if not menu_item:
            raise HTTPException(status_code=400, detail=f"Menu item {item_data.menu_item_id} not found")
        
        item_subtotal = menu_item["price"] * item_data.quantity
        subtotal += item_subtotal
        
        order_item = {
            "id": str(uuid.uuid4()),
            "order_id": order_id,
            "menu_item_id": item_data.menu_item_id,
            "quantity": item_data.quantity,
            "unit_price": menu_item["price"],
            "subtotal": item_subtotal,
            "special_instructions": item_data.special_instructions,
            "status": OrderItemStatus.PENDING
        }
        order_items.append(order_item)
    
    tax_amount = subtotal * 0.05
    total_amount = subtotal + tax_amount
    
    order = {
        "id": order_id,
        "order_number": order_number,
        "outlet_id": order_data.outlet_id,
        "table_id": order_data.table_id,
        "guest_user_id": None,
        "guest_name": order_data.guest_name,
        "order_type": order_data.order_type,
        "status": OrderStatus.PENDING,
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "discount_amount": 0.0,
        "total_amount": total_amount,
        "notes": order_data.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.insert_one(order)
    await db.order_items.insert_many(order_items)
    
    if order_data.table_id:
        await db.tables.update_one(
            {"id": order_data.table_id},
            {"$set": {"status": TableStatus.OCCUPIED}}
        )
    
    await redis_cache.clear_pattern(f"orders:*")
    
    table_number = None
    if order_data.table_id:
        table = await db.tables.find_one({"id": order_data.table_id}, {"_id": 0})
        if table:
            table_number = table["table_number"]
    
    order_with_items = {**order, "items": order_items, "table_number": table_number}
    return OrderWithItems(**order_with_items)

@api_router.get("/orders/{order_id}", response_model=OrderWithItems)
async def get_order(order_id: str):
    db = get_database()
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    items = await db.order_items.find({"order_id": order_id}, {"_id": 0}).to_list(100)
    
    table_number = None
    if order.get("table_id"):
        table = await db.tables.find_one({"id": order["table_id"]}, {"_id": 0})
        if table:
            table_number = table["table_number"]
    
    order_with_items = {**order, "items": items, "table_number": table_number}
    return OrderWithItems(**order_with_items)

@api_router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    status: OrderStatus,
    current_user: dict = Depends(get_current_admin_user)
):
    db = get_database()
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if status == OrderStatus.COMPLETED and order.get("table_id"):
        await db.tables.update_one(
            {"id": order["table_id"]},
            {"$set": {"status": TableStatus.AVAILABLE}}
        )
    
    await redis_cache.clear_pattern(f"orders:*")
    
    return {"message": "Order status updated successfully"}

@api_router.patch("/orders/{order_id}/items/{item_id}/status")
async def update_order_item_status(
    order_id: str,
    item_id: str,
    status: OrderItemStatus,
    current_user: dict = Depends(get_current_admin_user)
):
    db = get_database()
    
    await db.order_items.update_one(
        {"id": item_id, "order_id": order_id},
        {"$set": {"status": status}}
    )
    
    await redis_cache.clear_pattern(f"orders:*")
    
    return {"message": "Order item status updated successfully"}

@api_router.post("/orders/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    db = get_database()
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] in [OrderStatus.COMPLETED, OrderStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="Cannot cancel completed or already cancelled order")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": OrderStatus.CANCELLED, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if order.get("table_id"):
        await db.tables.update_one(
            {"id": order["table_id"]},
            {"$set": {"status": TableStatus.AVAILABLE}}
        )
    
    await redis_cache.clear_pattern(f"orders:*")
    
    return {"message": "Order cancelled successfully"}

@api_router.post("/payments/razorpay/order")
async def create_razorpay_order(order_id: str):
    db = get_database()
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    razorpay_order = razorpay_service.create_order(
        amount=order["total_amount"],
        currency="INR",
        receipt=order["order_number"]
    )
    
    payment_id = str(uuid.uuid4())
    payment = {
        "id": payment_id,
        "order_id": order_id,
        "method": PaymentMethod.RAZORPAY,
        "status": PaymentStatus.PENDING,
        "razorpay_order_id": razorpay_order["id"],
        "razorpay_payment_id": None,
        "amount": order["total_amount"],
        "refund_amount": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payments.insert_one(payment)
    
    return {
        "razorpay_order_id": razorpay_order["id"],
        "amount": razorpay_order["amount"],
        "currency": razorpay_order["currency"],
        "key_id": razorpay_service.key_id
    }

@api_router.post("/payments/razorpay/verify")
async def verify_razorpay_payment(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str
):
    db = get_database()
    
    is_valid = razorpay_service.verify_payment_signature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
    )
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    
    payment = await db.payments.find_one({"razorpay_order_id": razorpay_order_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    await db.payments.update_one(
        {"id": payment["id"]},
        {"$set": {
            "status": PaymentStatus.COMPLETED,
            "razorpay_payment_id": razorpay_payment_id
        }}
    )
    
    await db.orders.update_one(
        {"id": payment["order_id"]},
        {"$set": {"status": OrderStatus.CONFIRMED}}
    )
    
    return {"message": "Payment verified successfully"}

@api_router.post("/payments/razorpay/webhook")
async def razorpay_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    
    is_valid = razorpay_service.verify_webhook_signature(body, signature)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    
    import json
    payload = json.loads(body)
    
    event = payload.get("event")
    
    if event == "payment.captured":
        payment_entity = payload["payload"]["payment"]["entity"]
        razorpay_payment_id = payment_entity["id"]
        razorpay_order_id = payment_entity["order_id"]
        
        db = get_database()
        await db.payments.update_one(
            {"razorpay_order_id": razorpay_order_id},
            {"$set": {
                "status": PaymentStatus.COMPLETED,
                "razorpay_payment_id": razorpay_payment_id
            }}
        )
    
    return {"status": "processed"}

@api_router.post("/payments/cash")
async def mark_cash_payment(
    order_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    db = get_database()
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    payment_id = str(uuid.uuid4())
    payment = {
        "id": payment_id,
        "order_id": order_id,
        "method": PaymentMethod.CASH,
        "status": PaymentStatus.COMPLETED,
        "razorpay_order_id": None,
        "razorpay_payment_id": None,
        "amount": order["total_amount"],
        "refund_amount": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payments.insert_one(payment)
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": OrderStatus.CONFIRMED}}
    )
    
    return {"message": "Cash payment recorded successfully"}

@api_router.get("/admin/outlets", response_model=List[Outlet])
async def get_outlets(current_user: dict = Depends(get_current_admin_user)):
    db = get_database()
    outlets = await db.outlets.find({}, {"_id": 0}).to_list(100)
    return [Outlet(**outlet) for outlet in outlets]

@api_router.post("/admin/outlets", response_model=Outlet)
async def create_outlet(
    outlet_data: OutletCreate,
    current_user: dict = Depends(get_current_admin_user)
):
    db = get_database()
    
    outlet_id = str(uuid.uuid4())
    outlet = {
        "id": outlet_id,
        **outlet_data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.outlets.insert_one(outlet)
    return Outlet(**outlet)

@api_router.get("/admin/tables/{outlet_id}", response_model=List[Table])
async def get_tables(outlet_id: str, current_user: dict = Depends(get_current_admin_user)):
    db = get_database()
    tables = await db.tables.find({"outlet_id": outlet_id}, {"_id": 0}).to_list(100)
    return [Table(**table) for table in tables]

@api_router.post("/admin/tables/{outlet_id}", response_model=Table)
async def create_table(
    outlet_id: str,
    table_data: TableCreate,
    current_user: dict = Depends(get_current_admin_user)
):
    db = get_database()
    
    table_id = str(uuid.uuid4())
    qr_token = str(uuid.uuid4())
    
    table = {
        "id": table_id,
        "qr_token": qr_token,
        **table_data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tables.insert_one(table)
    return Table(**table)

@api_router.get("/admin/tables/{outlet_id}/qr-codes")
async def get_table_qr_codes(outlet_id: str, current_user: dict = Depends(get_current_admin_user)):
    db = get_database()
    
    tables = await db.tables.find({"outlet_id": outlet_id}, {"_id": 0}).to_list(100)
    
    qr_codes = []
    for table in tables:
        qr_url = get_qr_url(table["qr_token"])
        qr_image = generate_qr_code(qr_url)
        
        qr_codes.append({
            "table_id": table["id"],
            "table_number": table["table_number"],
            "qr_token": table["qr_token"],
            "qr_url": qr_url,
            "qr_image": qr_image
        })
    
    return qr_codes

@api_router.post("/admin/tables/{table_id}/regenerate-qr")
async def regenerate_qr(table_id: str, current_user: dict = Depends(get_current_admin_user)):
    db = get_database()
    
    new_qr_token = str(uuid.uuid4())
    
    await db.tables.update_one(
        {"id": table_id},
        {"$set": {"qr_token": new_qr_token}}
    )
    
    qr_url = get_qr_url(new_qr_token)
    qr_image = generate_qr_code(qr_url)
    
    return {
        "qr_token": new_qr_token,
        "qr_url": qr_url,
        "qr_image": qr_image
    }

@api_router.get("/admin/menu/categories", response_model=List[MenuCategory])
async def get_categories(outlet_id: str, current_user: dict = Depends(get_current_admin_user)):
    db = get_database()
    categories = await db.menu_categories.find({"outlet_id": outlet_id}, {"_id": 0}).sort("display_order", 1).to_list(100)
    return [MenuCategory(**cat) for cat in categories]

@api_router.post("/admin/menu/categories", response_model=MenuCategory)
async def create_category(
    category_data: MenuCategoryCreate,
    current_user: dict = Depends(get_current_admin_user)
):
    db = get_database()
    
    category_id = str(uuid.uuid4())
    category = {
        "id": category_id,
        **category_data.model_dump()
    }
    
    await db.menu_categories.insert_one(category)
    await redis_cache.clear_pattern(f"menu:*")
    
    return MenuCategory(**category)

@api_router.get("/admin/menu/items", response_model=List[MenuItem])
async def get_menu_items(outlet_id: str, current_user: dict = Depends(get_current_admin_user)):
    db = get_database()
    items = await db.menu_items.find({"outlet_id": outlet_id}, {"_id": 0}).to_list(1000)
    return [MenuItem(**item) for item in items]

@api_router.post("/admin/menu/items", response_model=MenuItem)
async def create_menu_item(
    item_data: MenuItemCreate,
    current_user: dict = Depends(get_current_admin_user)
):
    db = get_database()
    
    item_id = str(uuid.uuid4())
    item = {
        "id": item_id,
        **item_data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.menu_items.insert_one(item)
    await redis_cache.clear_pattern(f"menu:*")
    
    return MenuItem(**item)

@api_router.patch("/admin/menu/items/{item_id}/toggle-availability")
async def toggle_item_availability(
    item_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    db = get_database()
    
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    new_status = not item.get("is_available", True)
    
    await db.menu_items.update_one(
        {"id": item_id},
        {"$set": {"is_available": new_status}}
    )
    
    await redis_cache.clear_pattern(f"menu:*")
    
    return {"is_available": new_status}

@api_router.get("/admin/dashboard/{outlet_id}")
async def get_dashboard(outlet_id: str, current_user: dict = Depends(get_current_admin_user)):
    db = get_database()
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    todays_orders = await db.orders.find({
        "outlet_id": outlet_id,
        "created_at": {
            "$gte": today_start.isoformat(),
            "$lt": today_end.isoformat()
        },
        "status": {"$ne": OrderStatus.CANCELLED}
    }, {"_id": 0}).to_list(1000)
    
    todays_revenue = sum(order.get("total_amount", 0) for order in todays_orders)
    todays_order_count = len(todays_orders)
    avg_order_value = todays_revenue / todays_order_count if todays_order_count > 0 else 0
    
    active_tables = await db.tables.count_documents({
        "outlet_id": outlet_id,
        "status": TableStatus.OCCUPIED
    })
    
    item_counts = {}
    for order in todays_orders:
        items = await db.order_items.find({"order_id": order["id"]}, {"_id": 0}).to_list(100)
        for item in items:
            menu_item_id = item["menu_item_id"]
            if menu_item_id not in item_counts:
                item_counts[menu_item_id] = {"quantity": 0, "item_id": menu_item_id}
            item_counts[menu_item_id]["quantity"] += item["quantity"]
    
    top_items = sorted(item_counts.values(), key=lambda x: x["quantity"], reverse=True)[:5]
    
    for item in top_items:
        menu_item = await db.menu_items.find_one({"id": item["item_id"]}, {"_id": 0})
        if menu_item:
            item["name"] = menu_item["name"]
            item["price"] = menu_item["price"]
    
    revenue_trend = []
    for i in range(6, -1, -1):
        day_start = today_start - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        
        day_orders = await db.orders.find({
            "outlet_id": outlet_id,
            "created_at": {
                "$gte": day_start.isoformat(),
                "$lt": day_end.isoformat()
            },
            "status": {"$ne": OrderStatus.CANCELLED}
        }, {"_id": 0}).to_list(1000)
        
        day_revenue = sum(order.get("total_amount", 0) for order in day_orders)
        
        revenue_trend.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "revenue": day_revenue
        })
    
    return {
        "todays_revenue": todays_revenue,
        "todays_orders": todays_order_count,
        "avg_order_value": avg_order_value,
        "active_tables": active_tables,
        "top_items": top_items,
        "revenue_trend": revenue_trend
    }

@api_router.get("/admin/live-orders/{outlet_id}")
async def get_live_orders(outlet_id: str, current_user: dict = Depends(get_current_admin_user)):
    db = get_database()
    
    active_statuses = [
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.READY
    ]
    
    orders = await db.orders.find({
        "outlet_id": outlet_id,
        "status": {"$in": active_statuses}
    }, {"_id": 0}).sort("created_at", 1).to_list(1000)
    
    orders_with_items = []
    for order in orders:
        items = await db.order_items.find({"order_id": order["id"]}, {"_id": 0}).to_list(100)
        
        for item in items:
            menu_item = await db.menu_items.find_one({"id": item["menu_item_id"]}, {"_id": 0})
            if menu_item:
                item["menu_item_name"] = menu_item["name"]
        
        table_number = None
        if order.get("table_id"):
            table = await db.tables.find_one({"id": order["table_id"]}, {"_id": 0})
            if table:
                table_number = table["table_number"]
        
        order_with_items = {**order, "items": items, "table_number": table_number}
        orders_with_items.append(order_with_items)
    
    return orders_with_items

@api_router.get("/admin/analytics/{outlet_id}")
async def get_analytics(
    outlet_id: str,
    period: str = "7d",
    current_user: dict = Depends(get_current_admin_user)
):
    db = get_database()
    
    days_map = {"7d": 7, "30d": 30, "90d": 90}
    days = days_map.get(period, 7)
    
    end_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    start_date = end_date - timedelta(days=days)
    
    orders = await db.orders.find({
        "outlet_id": outlet_id,
        "created_at": {
            "$gte": start_date.isoformat(),
            "$lt": end_date.isoformat()
        },
        "status": {"$ne": OrderStatus.CANCELLED}
    }, {"_id": 0}).to_list(10000)
    
    revenue_trend = []
    for i in range(days):
        day_start = start_date + timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        
        day_orders = [o for o in orders if day_start.isoformat() <= o["created_at"] < day_end.isoformat()]
        day_revenue = sum(order.get("total_amount", 0) for order in day_orders)
        
        revenue_trend.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "revenue": day_revenue,
            "orders": len(day_orders)
        })
    
    order_type_breakdown = {}
    for order in orders:
        order_type = order.get("order_type", OrderType.DINE_IN)
        if order_type not in order_type_breakdown:
            order_type_breakdown[order_type] = 0
        order_type_breakdown[order_type] += 1
    
    hour_distribution = {}
    for order in orders:
        created_at = datetime.fromisoformat(order["created_at"])
        hour = created_at.hour
        if hour not in hour_distribution:
            hour_distribution[hour] = 0
        hour_distribution[hour] += 1
    
    peak_hours = [{"hour": h, "orders": c} for h, c in sorted(hour_distribution.items(), key=lambda x: x[1], reverse=True)[:5]]
    
    return {
        "revenue_trend": revenue_trend,
        "order_type_breakdown": order_type_breakdown,
        "peak_hours": peak_hours,
        "total_revenue": sum(o.get("total_amount", 0) for o in orders),
        "total_orders": len(orders)
    }

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
