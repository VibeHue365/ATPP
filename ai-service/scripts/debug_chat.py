import asyncio
import traceback
import sys

# Set console encoding to UTF-8
if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

async def main():
    try:
        from db.connection import products_col
        from chatbot.chatbot_engine import ChatbotEngine
        from main import _get_product_context, _get_recommended_products
        
        chatbot = ChatbotEngine()
        print("Fetching product context...")
        context = await _get_product_context(limit=10)
        print(f"Product Context:\n{context}")
        
        print("\nCalling fallback Gemini...")
        # Test text prompt
        ans = chatbot.call_gemini_fallback("Tôi muốn thuê áo dài màu đỏ gấm thêu phượng", product_context=context)
        print(f"Raw Gemini Answer:\n{ans}")
        
        cleaned, prods = await _get_recommended_products(ans)
        print(f"\nCleaned Answer:\n{cleaned}")
        print(f"Recommended products: {prods}")
        
    except Exception as e:
        print("Error occurred:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
