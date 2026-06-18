import asyncio
import sys
from db.connection import db

if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

async def main():
    qa_col = db["qa_data"]
    docs = await qa_col.find({}).to_list(length=100)
    print(f"Total documents: {len(docs)}")
    for d in docs:
        print(f"- ID: {d.get('_id')}")
        print(f"  Q: {d.get('question_original')}")
        print(f"  Gender: {d.get('gender')}")
        print(f"  Age: {d.get('age_range')}")
        print(f"  Keywords: {d.get('keywords')}")

if __name__ == "__main__":
    asyncio.run(main())
