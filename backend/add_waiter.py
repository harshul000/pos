"""Run once to add the default waiter account without wiping the database."""
import asyncio
import uuid
from sqlalchemy import select
from database import AsyncSessionLocal, init_db
from auth import get_password_hash
from models import UserRole
from db_models import UserDB


async def add_waiter():
    await init_db()
    async with AsyncSessionLocal() as db:
        # Check if waiter already exists
        result = await db.execute(select(UserDB).where(UserDB.email == "waiter@dhpos.com"))
        existing = result.scalar_one_or_none()

        if existing:
            # Update password just in case
            existing.password_hash = get_password_hash("Waiter@123")
            existing.role = UserRole.STAFF
            existing.is_active = True
            await db.commit()
            print("✅ Waiter account updated: waiter@dhpos.com / Waiter@123")
        else:
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
            await db.commit()
            print("✅ Waiter account created: waiter@dhpos.com / Waiter@123")


if __name__ == "__main__":
    asyncio.run(add_waiter())
