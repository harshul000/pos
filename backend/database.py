from motor.motor_asyncio import AsyncIOMotorClient
import os
from typing import Optional

class Database:
    client: Optional[AsyncIOMotorClient] = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_instance.client = AsyncIOMotorClient(mongo_url)
    db_instance.db = db_instance.client[os.environ.get('DB_NAME', 'dh_pos')]
    print(f"Connected to MongoDB: {os.environ.get('DB_NAME')}")

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        print("Closed MongoDB connection")

def get_database():
    return db_instance.db