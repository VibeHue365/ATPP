import asyncio
import httpx
import sys

# Set console encoding to UTF-8
if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

async def main():
    # Test text chat that should trigger fallback and match red brocade ao dai
    print("=== Testing /chat (Text) ===")
    async with httpx.AsyncClient() as client:
        # FastAPI is running at port 8000
        res = await client.post("http://127.0.0.1:8000/chat?message=Tôi muốn thuê áo dài màu đỏ gấm thêu phượng", timeout=30.0)
        if res.status_code == 200:
            data = res.json()
            print(f"Answer: {data.get('answer')}")
            print(f"Source: {data.get('source')}")
            print(f"Recommended products count: {len(data.get('recommended_products', []))}")
            for p in data.get('recommended_products', []):
                print(f"  - Recommended: {p.get('name')} (Price: {p.get('basePrice')}đ)")
        else:
            print(f"Error {res.status_code}: {res.text}")

    # Test chat with image (we can use a dummy base64 representation of a small image)
    # 1x1 transparent GIF base64
    dummy_gif_base64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
    print("\n=== Testing /chat/with-image (Multimodal) ===")
    async with httpx.AsyncClient() as client:
        payload = {
            "message": "Shop có mẫu nào màu trắng giống ảnh này không?",
            "image_base64": dummy_gif_base64,
            "mime_type": "image/gif"
        }
        res = await client.post("http://127.0.0.1:8000/chat/with-image", json=payload, timeout=20.0)
        if res.status_code == 200:
            data = res.json()
            print(f"Answer: {data.get('answer')}")
            print(f"Source: {data.get('source')}")
            print(f"Recommended products count: {len(data.get('recommended_products', []))}")
            for p in data.get('recommended_products', []):
                print(f"  - Recommended: {p.get('name')} (Price: {p.get('basePrice')}đ)")
        else:
            print(f"Error {res.status_code}: {res.text}")

if __name__ == "__main__":
    asyncio.run(main())
