from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL      = os.getenv("MONGO_URL") or os.getenv("MONGODB_URI") or "mongodb://localhost:27017"
DB_NAME        = os.getenv("DB_NAME", "aodai_platform")
NESTJS_DB_NAME = os.getenv("NESTJS_DB_NAME", "vibehue_db")

client = AsyncIOMotorClient(MONGO_URL)
db     = client[DB_NAME]

# NestJS main DB — for reading real product/ao-dai catalog
nestjs_db    = client[NESTJS_DB_NAME]
products_col = nestjs_db["products"]

users_col    = db["users"]
services_col = db["services"]
bookings_col = db["bookings"]