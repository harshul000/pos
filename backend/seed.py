import uuid
from datetime import datetime, timezone
from database import get_database
from auth import get_password_hash
from models import UserRole, TableStatus
import asyncio

async def seed_database():
    db = get_database()
    
    existing_users = await db.users.count_documents({})
    if existing_users > 0:
        print("Database already seeded. Skipping seed.")
        return
    
    print("Seeding database...")
    
    admin_id = str(uuid.uuid4())
    admin = {
        "id": admin_id,
        "email": "admin@dhpos.com",
        "full_name": "Admin User",
        "phone": "9876543210",
        "role": UserRole.SUPER_ADMIN,
        "password_hash": get_password_hash("Admin@123"),
        "external_hotel_user_id": None,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin)
    print(f"Created admin user: {admin['email']}")
    
    outlet_id = str(uuid.uuid4())
    outlet = {
        "id": outlet_id,
        "name": "The Grand Bistro",
        "description": "Fine dining experience with a blend of international cuisines",
        "image_url": "https://images.unsplash.com/photo-1768697358705-c1b60333da35?crop=entropy&cs=srgb&fm=jpg&q=85",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.outlets.insert_one(outlet)
    print(f"Created outlet: {outlet['name']}")
    
    tables = []
    for i in range(1, 6):
        table = {
            "id": str(uuid.uuid4()),
            "outlet_id": outlet_id,
            "table_number": f"T{i}",
            "capacity": 4,
            "qr_token": str(uuid.uuid4()),
            "status": TableStatus.AVAILABLE,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        tables.append(table)
    await db.tables.insert_many(tables)
    print(f"Created {len(tables)} tables")
    
    category_1 = str(uuid.uuid4())
    category_2 = str(uuid.uuid4())
    category_3 = str(uuid.uuid4())
    
    categories = [
        {
            "id": category_1,
            "outlet_id": outlet_id,
            "name": "Starters",
            "display_order": 1,
            "is_active": True
        },
        {
            "id": category_2,
            "outlet_id": outlet_id,
            "name": "Main Course",
            "display_order": 2,
            "is_active": True
        },
        {
            "id": category_3,
            "outlet_id": outlet_id,
            "name": "Beverages",
            "display_order": 3,
            "is_active": True
        }
    ]
    await db.menu_categories.insert_many(categories)
    print(f"Created {len(categories)} menu categories")
    
    menu_items = [
        {
            "id": str(uuid.uuid4()),
            "outlet_id": outlet_id,
            "category_id": category_1,
            "name": "Crispy Spring Rolls",
            "description": "Golden fried spring rolls with sweet chili sauce",
            "price": 199.0,
            "image_url": "https://images.unsplash.com/photo-1630563775062-bbaf8ad3d73c?crop=entropy&cs=srgb&fm=jpg&q=85",
            "is_available": True,
            "is_veg": True,
            "prep_time_minutes": 15,
            "tags": ["appetizer", "crispy"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "outlet_id": outlet_id,
            "category_id": category_1,
            "name": "Chicken Wings",
            "description": "Spicy buffalo wings with ranch dressing",
            "price": 299.0,
            "image_url": "https://images.unsplash.com/photo-1650012762279-e8b5f90f504f?crop=entropy&cs=srgb&fm=jpg&q=85",
            "is_available": True,
            "is_veg": False,
            "prep_time_minutes": 20,
            "tags": ["spicy", "chicken"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "outlet_id": outlet_id,
            "category_id": category_1,
            "name": "Paneer Tikka",
            "description": "Grilled cottage cheese with Indian spices",
            "price": 249.0,
            "image_url": "https://images.unsplash.com/photo-1630563775062-bbaf8ad3d73c?crop=entropy&cs=srgb&fm=jpg&q=85",
            "is_available": True,
            "is_veg": True,
            "prep_time_minutes": 18,
            "tags": ["grilled", "indian"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "outlet_id": outlet_id,
            "category_id": category_2,
            "name": "Classic Margherita Pizza",
            "description": "Tomato sauce, mozzarella, fresh basil",
            "price": 399.0,
            "image_url": "https://images.unsplash.com/photo-1630563775062-bbaf8ad3d73c?crop=entropy&cs=srgb&fm=jpg&q=85",
            "is_available": True,
            "is_veg": True,
            "prep_time_minutes": 25,
            "tags": ["pizza", "italian"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "outlet_id": outlet_id,
            "category_id": category_2,
            "name": "Butter Chicken",
            "description": "Creamy tomato gravy with tender chicken pieces",
            "price": 449.0,
            "image_url": "https://images.unsplash.com/photo-1650012762279-e8b5f90f504f?crop=entropy&cs=srgb&fm=jpg&q=85",
            "is_available": True,
            "is_veg": False,
            "prep_time_minutes": 30,
            "tags": ["indian", "curry"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "outlet_id": outlet_id,
            "category_id": category_2,
            "name": "Grilled Salmon",
            "description": "Atlantic salmon with lemon butter sauce",
            "price": 699.0,
            "image_url": "https://images.unsplash.com/photo-1630563775062-bbaf8ad3d73c?crop=entropy&cs=srgb&fm=jpg&q=85",
            "is_available": True,
            "is_veg": False,
            "prep_time_minutes": 25,
            "tags": ["seafood", "grilled"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "outlet_id": outlet_id,
            "category_id": category_2,
            "name": "Veg Biryani",
            "description": "Aromatic basmati rice with mixed vegetables",
            "price": 349.0,
            "image_url": "https://images.unsplash.com/photo-1630563775062-bbaf8ad3d73c?crop=entropy&cs=srgb&fm=jpg&q=85",
            "is_available": True,
            "is_veg": True,
            "prep_time_minutes": 35,
            "tags": ["indian", "rice"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "outlet_id": outlet_id,
            "category_id": category_3,
            "name": "Fresh Lime Soda",
            "description": "Refreshing lime soda with mint",
            "price": 99.0,
            "image_url": "https://images.pexels.com/photos/3925158/pexels-photo-3925158.jpeg",
            "is_available": True,
            "is_veg": True,
            "prep_time_minutes": 5,
            "tags": ["refreshing", "cold"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "outlet_id": outlet_id,
            "category_id": category_3,
            "name": "Mango Lassi",
            "description": "Creamy yogurt drink with mango pulp",
            "price": 129.0,
            "image_url": "https://images.pexels.com/photos/3925158/pexels-photo-3925158.jpeg",
            "is_available": True,
            "is_veg": True,
            "prep_time_minutes": 5,
            "tags": ["drink", "sweet"],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "outlet_id": outlet_id,
            "category_id": category_3,
            "name": "Cappuccino",
            "description": "Classic Italian coffee with steamed milk",
            "price": 149.0,
            "image_url": "https://images.pexels.com/photos/3925158/pexels-photo-3925158.jpeg",
            "is_available": True,
            "is_veg": True,
            "prep_time_minutes": 8,
            "tags": ["coffee", "hot"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.menu_items.insert_many(menu_items)
    print(f"Created {len(menu_items)} menu items")
    
    print("Database seeding completed successfully!")

if __name__ == "__main__":
    from database import connect_to_mongo
    asyncio.run(connect_to_mongo())
    asyncio.run(seed_database())