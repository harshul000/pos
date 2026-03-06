import uuid
from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from database import AsyncSessionLocal
from auth import get_password_hash
from models import UserRole, TableStatus
from db_models import (
    UserDB, OutletDB, TableDB, MenuCategoryDB, MenuItemDB,
)


async def seed_database():
    async with AsyncSessionLocal() as db:
        # Check if already seeded
        result = await db.execute(select(func.count(UserDB.id)))
        count = result.scalar_one()
        if count > 0:
            print("Database already seeded. Skipping.")
            return

        print("Seeding database...")

        # --- Admin User ---
        admin = UserDB(
            id=str(uuid.uuid4()),
            email="admin@dhpos.com",
            full_name="Admin User",
            phone="9876543210",
            role=UserRole.SUPER_ADMIN,
            password_hash=get_password_hash("Admin@123"),
            is_active=True,
        )
        db.add(admin)
        await db.flush()
        print(f"Created admin user: {admin.email}")

        # --- Default Waiter ---
        waiter = UserDB(
            id=str(uuid.uuid4()),
            email="waiter@dhpos.com",
            full_name="Rahul (Waiter)",
            phone="9876543211",
            role=UserRole.STAFF,
            password_hash=get_password_hash("Waiter@123"),
            is_active=True,
        )
        db.add(waiter)
        await db.flush()
        print(f"Created waiter user: {waiter.email}")

        # --- Outlet ---
        outlet = OutletDB(
            id=str(uuid.uuid4()),
            name="The Grand Bistro",
            description="Fine dining experience with a blend of international cuisines",
            image_url="https://images.unsplash.com/photo-1768697358705-c1b60333da35?crop=entropy&cs=srgb&fm=jpg&q=85",
            is_active=True,
        )
        db.add(outlet)
        await db.flush()
        print(f"Created outlet: {outlet.name}")

        # --- Tables ---
        for i in range(1, 6):
            table = TableDB(
                id=str(uuid.uuid4()),
                outlet_id=outlet.id,
                table_number=f"T{i}",
                capacity=4,
                qr_token=str(uuid.uuid4()),
                status=TableStatus.AVAILABLE,
            )
            db.add(table)
        print("Created 5 tables")

        # --- Menu Categories ---
        cat_starters = MenuCategoryDB(
            id=str(uuid.uuid4()), outlet_id=outlet.id, name="Starters", display_order=1, is_active=True,
        )
        cat_main = MenuCategoryDB(
            id=str(uuid.uuid4()), outlet_id=outlet.id, name="Main Course", display_order=2, is_active=True,
        )
        cat_beverages = MenuCategoryDB(
            id=str(uuid.uuid4()), outlet_id=outlet.id, name="Beverages", display_order=3, is_active=True,
        )
        db.add_all([cat_starters, cat_main, cat_beverages])
        await db.flush()
        print("Created 3 menu categories")

        # --- Menu Items ---
        items_data = [
            # Starters
            dict(outlet_id=outlet.id, category_id=cat_starters.id, name="Crispy Spring Rolls",
                 description="Golden fried spring rolls with sweet chili sauce", price=199.0,
                 image_url="https://images.unsplash.com/photo-1630563775062-bbaf8ad3d73c?crop=entropy&cs=srgb&fm=jpg&q=85",
                 is_veg=True, prep_time_minutes=15, tags=["appetizer", "crispy"]),
            dict(outlet_id=outlet.id, category_id=cat_starters.id, name="Chicken Wings",
                 description="Spicy buffalo wings with ranch dressing", price=299.0,
                 image_url="https://images.unsplash.com/photo-1650012762279-e8b5f90f504f?crop=entropy&cs=srgb&fm=jpg&q=85",
                 is_veg=False, prep_time_minutes=20, tags=["spicy", "chicken"]),
            dict(outlet_id=outlet.id, category_id=cat_starters.id, name="Paneer Tikka",
                 description="Grilled cottage cheese with Indian spices", price=249.0,
                 image_url="https://images.unsplash.com/photo-1630563775062-bbaf8ad3d73c?crop=entropy&cs=srgb&fm=jpg&q=85",
                 is_veg=True, prep_time_minutes=18, tags=["grilled", "indian"]),
            # Main Course
            dict(outlet_id=outlet.id, category_id=cat_main.id, name="Classic Margherita Pizza",
                 description="Tomato sauce, mozzarella, fresh basil", price=399.0,
                 image_url="https://images.unsplash.com/photo-1630563775062-bbaf8ad3d73c?crop=entropy&cs=srgb&fm=jpg&q=85",
                 is_veg=True, prep_time_minutes=25, tags=["pizza", "italian"]),
            dict(outlet_id=outlet.id, category_id=cat_main.id, name="Butter Chicken",
                 description="Creamy tomato gravy with tender chicken pieces", price=449.0,
                 image_url="https://images.unsplash.com/photo-1650012762279-e8b5f90f504f?crop=entropy&cs=srgb&fm=jpg&q=85",
                 is_veg=False, prep_time_minutes=30, tags=["indian", "curry"]),
            dict(outlet_id=outlet.id, category_id=cat_main.id, name="Grilled Salmon",
                 description="Atlantic salmon with lemon butter sauce", price=699.0,
                 image_url="https://images.unsplash.com/photo-1630563775062-bbaf8ad3d73c?crop=entropy&cs=srgb&fm=jpg&q=85",
                 is_veg=False, prep_time_minutes=25, tags=["seafood", "grilled"]),
            dict(outlet_id=outlet.id, category_id=cat_main.id, name="Veg Biryani",
                 description="Aromatic basmati rice with mixed vegetables", price=349.0,
                 image_url="https://images.unsplash.com/photo-1630563775062-bbaf8ad3d73c?crop=entropy&cs=srgb&fm=jpg&q=85",
                 is_veg=True, prep_time_minutes=35, tags=["indian", "rice"]),
            # Beverages
            dict(outlet_id=outlet.id, category_id=cat_beverages.id, name="Fresh Lime Soda",
                 description="Refreshing lime soda with mint", price=99.0,
                 image_url="https://images.pexels.com/photos/3925158/pexels-photo-3925158.jpeg",
                 is_veg=True, prep_time_minutes=5, tags=["refreshing", "cold"]),
            dict(outlet_id=outlet.id, category_id=cat_beverages.id, name="Mango Lassi",
                 description="Creamy yogurt drink with mango pulp", price=129.0,
                 image_url="https://images.pexels.com/photos/3925158/pexels-photo-3925158.jpeg",
                 is_veg=True, prep_time_minutes=5, tags=["drink", "sweet"]),
            dict(outlet_id=outlet.id, category_id=cat_beverages.id, name="Cappuccino",
                 description="Classic Italian coffee with steamed milk", price=149.0,
                 image_url="https://images.pexels.com/photos/3925158/pexels-photo-3925158.jpeg",
                 is_veg=True, prep_time_minutes=8, tags=["coffee", "hot"]),
        ]
        for item_data in items_data:
            db.add(MenuItemDB(id=str(uuid.uuid4()), **item_data))

        await db.commit()
        print(f"Created {len(items_data)} menu items")
        print("Database seeding completed successfully!")