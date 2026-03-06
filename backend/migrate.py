"""
Migration: add waiter_id, cover_count, payment_method to orders table.
Safe to run multiple times — skips columns that already exist.
"""
import asyncio
import aiosqlite
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "dh_pos.db")

MIGRATIONS = [
    "ALTER TABLE orders ADD COLUMN waiter_id TEXT REFERENCES users(id)",
    "ALTER TABLE orders ADD COLUMN cover_count INTEGER DEFAULT 1",
    "ALTER TABLE orders ADD COLUMN payment_method TEXT",
]


async def run():
    async with aiosqlite.connect(DB_PATH) as db:
        # Get existing columns
        async with db.execute("PRAGMA table_info(orders)") as cur:
            cols = {row[1] async for row in cur}

        for sql in MIGRATIONS:
            col = sql.split("ADD COLUMN")[1].strip().split()[0]
            if col in cols:
                print(f"  skip: {col} already exists")
            else:
                await db.execute(sql)
                print(f"  added: {col}")

        await db.commit()
        print("✅ Migration complete")


if __name__ == "__main__":
    asyncio.run(run())
