from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    POS_ADMIN = "pos_admin"
    STAFF = "staff"
    GUEST = "guest"

class OrderType(str, Enum):
    DINE_IN = "dine_in"
    TAKEAWAY = "takeaway"
    DELIVERY = "delivery"
    MANUAL = "manual"

class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY = "ready"
    SERVED = "served"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class OrderItemStatus(str, Enum):
    PENDING = "pending"
    PREPARING = "preparing"
    READY = "ready"
    SERVED = "served"

class PaymentMethod(str, Enum):
    RAZORPAY = "razorpay"
    CASH = "cash"
    UPI = "upi"
    CARD = "card"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

class TableStatus(str, Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    RESERVED = "reserved"

class DiscountType(str, Enum):
    PERCENT = "percent"
    FLAT = "flat"

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.GUEST

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GuestLogin(BaseModel):
    email: EmailStr
    name: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    external_hotel_user_id: Optional[str] = None
    is_active: bool = True
    created_at: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None

class OutletBase(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_active: bool = True

class OutletCreate(OutletBase):
    pass

class Outlet(OutletBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str

class TableBase(BaseModel):
    outlet_id: str
    table_number: str
    capacity: int = 4
    status: TableStatus = TableStatus.AVAILABLE

class TableCreate(TableBase):
    pass

class Table(TableBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    qr_token: str
    created_at: str

class MenuCategoryBase(BaseModel):
    outlet_id: str
    name: str
    display_order: int = 0
    is_active: bool = True

class MenuCategoryCreate(MenuCategoryBase):
    pass

class MenuCategory(MenuCategoryBase):
    model_config = ConfigDict(extra="ignore")
    id: str

class MenuItemBase(BaseModel):
    outlet_id: str
    category_id: str
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    is_available: bool = True
    is_veg: bool = True
    prep_time_minutes: int = 15
    tags: Optional[List[str]] = []

class MenuItemCreate(MenuItemBase):
    pass

class MenuItem(MenuItemBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str

class OrderItemBase(BaseModel):
    menu_item_id: str
    quantity: int = 1
    special_instructions: Optional[str] = None

class OrderItemCreate(OrderItemBase):
    pass

class OrderItem(OrderItemBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    order_id: str
    unit_price: float
    subtotal: float
    status: OrderItemStatus = OrderItemStatus.PENDING

class OrderBase(BaseModel):
    outlet_id: str
    table_id: Optional[str] = None
    guest_name: Optional[str] = None
    order_type: OrderType = OrderType.DINE_IN
    notes: Optional[str] = None

class OrderCreate(OrderBase):
    items: List[OrderItemCreate]

class Order(OrderBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    order_number: str
    guest_user_id: Optional[str] = None
    status: OrderStatus = OrderStatus.PENDING
    subtotal: float
    tax_amount: float
    discount_amount: float = 0.0
    total_amount: float
    created_at: str
    updated_at: str

class OrderWithItems(Order):
    items: List[OrderItem] = []
    table_number: Optional[str] = None

class PaymentBase(BaseModel):
    order_id: str
    method: PaymentMethod
    amount: float

class PaymentCreate(PaymentBase):
    pass

class Payment(PaymentBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    status: PaymentStatus = PaymentStatus.PENDING
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    refund_amount: float = 0.0
    created_at: str

class CouponBase(BaseModel):
    code: str
    discount_type: DiscountType
    discount_value: float
    max_uses: int = 100
    is_active: bool = True
    expires_at: Optional[str] = None

class CouponCreate(CouponBase):
    pass

class Coupon(CouponBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    used_count: int = 0

class DashboardStats(BaseModel):
    todays_revenue: float
    todays_orders: int
    avg_order_value: float
    active_tables: int
    top_items: List[dict]
    revenue_trend: List[dict]

class QROrderCreate(BaseModel):
    guest_name: str
    items: List[OrderItemCreate]
    notes: Optional[str] = None