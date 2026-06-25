import asyncio
import traceback
import sys

# Set console encoding to UTF-8
if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

async def main():
    try:
        from chatbot.chatbot_engine import ChatbotEngine
        from main import _get_product_context, _get_recommended_products
        
        chatbot = ChatbotEngine()
        context = await _get_product_context(limit=8)
        
        # 1x1 transparent GIF base64
        dummy_gif_base64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        
        print("Calling multimodal Gemini...")
        ans = chatbot.call_gemini_with_image(
            question="Shop có mẫu nào màu trắng giống ảnh này không?",
            image_base64=dummy_gif_base64,
            mime_type="image/gif",
            product_context=context
        )
        print(f"Raw Gemini Answer:\n{ans}")
        
        cleaned, prods = await _get_recommended_products(ans)
        print(f"\nCleaned Answer:\n{cleaned}")
        print(f"Recommended products: {prods}")
        
    except Exception as e:
        print("Error occurred:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
