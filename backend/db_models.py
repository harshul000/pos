import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base
from models import (
    UserRole, OrderType, OrderStatus, OrderItemStatus,
    PaymentMethod, PaymentStatus, TableStatus, DiscountType,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> str:
    return str(uuid.uuid4())


class UserDB(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    role: Mapped[str] = mapped_column(SAEnum(UserRole), default=UserRole.GUEST)
    password_hash: Mapped[str] = mapped_column(String(255), default="")
    external_hotel_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class OutletDB(Base):
    __tablename__ = "outlets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(180))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    tables: Mapped[list["TableDB"]] = relationship(back_populates="outlet", cascade="all, delete")


class TableDB(Base):
    __tablename__ = "tables"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    outlet_id: Mapped[str] = mapped_column(ForeignKey("outlets.id"), index=True)
    table_number: Mapped[str] = mapped_column(String(20))
    capacity: Mapped[int] = mapped_column(Integer, default=4)
    qr_token: Mapped[str] = mapped_column(String(36), unique=True, default=new_uuid)
    status: Mapped[str] = mapped_column(SAEnum(TableStatus), default=TableStatus.AVAILABLE)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    outlet: Mapped["OutletDB"] = relationship(back_populates="tables")


class MenuCategoryDB(Base):
    __tablename__ = "menu_categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    outlet_id: Mapped[str] = mapped_column(ForeignKey("outlets.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    items: Mapped[list["MenuItemDB"]] = relationship(back_populates="category", cascade="all, delete")


class MenuItemDB(Base):
    __tablename__ = "menu_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    outlet_id: Mapped[str] = mapped_column(ForeignKey("outlets.id"), index=True)
    category_id: Mapped[str] = mapped_column(ForeignKey("menu_categories.id"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Float)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    is_veg: Mapped[bool] = mapped_column(Boolean, default=True)
    prep_time_minutes: Mapped[int] = mapped_column(Integer, default=15)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    category: Mapped["MenuCategoryDB"] = relationship(back_populates="items")


class OrderDB(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    order_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    outlet_id: Mapped[str] = mapped_column(ForeignKey("outlets.id"), index=True)
    table_id: Mapped[str | None] = mapped_column(ForeignKey("tables.id"), nullable=True, index=True)
    waiter_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    guest_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    guest_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    cover_count: Mapped[int] = mapped_column(Integer, default=1)
    order_type: Mapped[str] = mapped_column(SAEnum(OrderType), default=OrderType.DINE_IN)
    status: Mapped[str] = mapped_column(SAEnum(OrderStatus), default=OrderStatus.PENDING)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_method: Mapped[str | None] = mapped_column(SAEnum(PaymentMethod), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    items: Mapped[list["OrderItemDB"]] = relationship(back_populates="order", cascade="all, delete")


class OrderItemDB(Base):
    __tablename__ = "order_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), index=True)
    menu_item_id: Mapped[str] = mapped_column(ForeignKey("menu_items.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float)
    subtotal: Mapped[float] = mapped_column(Float)
    special_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(SAEnum(OrderItemStatus), default=OrderItemStatus.PENDING)

    order: Mapped["OrderDB"] = relationship(back_populates="items")
    menu_item: Mapped["MenuItemDB"] = relationship()


class PaymentDB(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), index=True)
    method: Mapped[str] = mapped_column(SAEnum(PaymentMethod))
    status: Mapped[str] = mapped_column(SAEnum(PaymentStatus), default=PaymentStatus.PENDING)
    razorpay_order_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    razorpay_payment_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    amount: Mapped[float] = mapped_column(Float)
    refund_amount: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class CouponDB(Base):
    __tablename__ = "coupons"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    discount_type: Mapped[str] = mapped_column(SAEnum(DiscountType))
    discount_value: Mapped[float] = mapped_column(Float)
    max_uses: Mapped[int] = mapped_column(Integer, default=100)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[str | None] = mapped_column(String(40), nullable=True)


class AppSettingsDB(Base):
    """Key-value table for persistent application settings."""
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

