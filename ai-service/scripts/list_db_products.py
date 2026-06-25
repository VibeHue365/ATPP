import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# Set console encoding to UTF-8
if sys.platform.startswith('win'):
    import sys
    sys.stdout.reconfigure(encoding='utf-8')

async def check():
    mongo_url = os.getenv("MONGO_URL") or os.getenv("MONGODB_URI") or "mongodb://localhost:27017"
    db_name = os.getenv("NESTJS_DB_NAME", "vibehue_db")
    print(f"Connecting to: {mongo_url}")
    print(f"Database: {db_name}")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    products_col = db["products"]
    
    count = await products_col.count_documents({})
    print(f"Total products: {count}")
    
    products = await products_col.find({}).to_list(length=10)
    for p in products:
        line = f"- ID: {p['_id']} | Name: {p.get('name')} | Status: {p.get('status')} | Price: {p.get('basePrice')} | Colors: {p.get('colors')} | Materials: {p.get('materials')}"
        print(line)

if __name__ == "__main__":
    asyncio.run(check())
