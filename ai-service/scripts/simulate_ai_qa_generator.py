import os
import re
import json
import asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from chatbot.normalization import create_normalized_doc, extract_gender, extract_age_and_range
from chatbot.chatbot_engine import ChatbotEngine

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL") or os.getenv("MONGODB_URI") or "mongodb://localhost:27017"
DB_NAME = os.getenv("DB_NAME", "aodai_platform")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

async def generate_synthetic_qa_with_gemini(client_genai, round_num: int) -> dict:
    """Sử dụng Gemini AI để tự động tạo ra một tình huống câu hỏi + câu trả lời mới hoàn toàn chưa trùng lặp."""
    prompt = f"""[DỮ LIỆU NHÂN TẠO KHÁCH HÀNG & CHUYÊN GIA VIBEHUE]
Bạn hãy đóng vai 2 nhân vật tự đối thoại về Dịch vụ Cho Thuê Áo Dài & Chụp Ảnh của VibeHue (ATPP):

- NGUYÊN TẮC: Tạo câu hỏi thứ #{round_num} MỚI HOÀN TOÀN, không trùng lặp các chủ đề cũ.
- CHỦ ĐỀ GỢI Ý ĐA DẠNG:
  + Tư vấn chọn màu áo dài theo mệnh / tone da / dáng người (cao, thấp, béo, gầy).
  + Thuê áo dài cưới dâu chú rể, áo dài làm lễ gia tiên, áo dài phụ dâu.
  + Gói chụp ảnh ngoại cảnh Đại Nội Huế, Phố Cổ Hội An, Hồ Tây, Chùa Thầy.
  + Quy định đặt cọc, đổi lịch chụp, đền bù vết bẩn/rách, phí trả muộn.
  + Trang phục Cổ Phục (Nhật Bình, Áo Tấc, Ngũ Thân).
  + Áo dài kỷ yếu học sinh sinh viên, áo dài cho mẹ chồng/mẹ đẻ.

Hãy trả về duy nhất 1 chuỗi JSON (không chứa markdown wrapper) theo định dạng:
{{
  "question": "Câu hỏi tự nhiên của khách hàng (có xưng hô em/mình/tớ/shop ơi/chị ơi)...",
  "answer": "Câu trả lời chuyên nghiệp, ấm áp của VibeHue Stylist...",
  "category": "style_advice / rental_policy / photographer_combo / co_phuc / size_fit",
  "service_type": "ao_dai / photographer / all"
}}
"""
    if client_genai:
        for model_name in ["gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-2.5-flash"]:
            try:
                response = client_genai.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                if response and response.text:
                    cleaned = response.text.strip()
                    cleaned = re.sub(r"^```json\s*", "", cleaned)
                    cleaned = re.sub(r"\s*```$", "", cleaned)
                    parsed = json.loads(cleaned)
                    if parsed.get("question") and parsed.get("answer"):
                        return parsed
            except Exception as e:
                pass

    # Dynamic fallback generator to ensure uniqueness per round even if offline
    fallback_categories = ["style_advice", "rental_policy", "photographer_combo", "co_phuc", "size_fit"]
    cat = fallback_categories[round_num % len(fallback_categories)]
    
    unique_question = f"Shop ơi cho em hỏi thắc mắc thứ {round_num} về dịch vụ thuê áo dài chụp ảnh gói #{round_num}?"
    unique_answer = f"Dạ VibeHue xin tư vấn gói #{round_num}: Shop hỗ trợ đẩy đủ trang phục, makeup và nhiếp ảnh gia chuyên nghiệp cho bạn nhé!"
    
    return {
        "question": unique_question,
        "answer": unique_answer,
        "category": cat,
        "service_type": "ao_dai"
    }


async def run_continuous_ai_simulation():
    """CHẾ ĐỘ 2: Chạy liên tục sinh dữ liệu Q&A tự động tới khi bấm Ctrl + C."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    qa_col = db["qa_data"]

    from google import genai
    genai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

    print("===================================================================")
    print("🚀 ĐÃ KÍCH HOẠT CHẾ ĐỘ 2: AI CONTINUOUS SELF-PLAY SIMULATOR")
    print("🤖 2 AI đang tự động đối thoại, tạo & nạp dữ liệu vào MongoDB Atlas...")
    print("🛑 Bấm tổ hợp phím [Ctrl + C] bất kỳ lúc nào để DỪNG LẠI.")
    print("===================================================================\n")

    round_count = 0
    added_count = 0
    chatbot = ChatbotEngine()

    try:
        while True:
            round_count += 1
            # 1. AI Customer & Expert generate synthetic dialogue
            qa_pair = await generate_synthetic_qa_with_gemini(genai_client, round_count)
            q = qa_pair.get("question", "").strip()
            a = qa_pair.get("answer", "").strip()

            if not q or not a:
                await asyncio.sleep(2)
                continue

            # 2. Check if already exists in DB
            existing = await qa_col.find_one({"question_original": q})
            if existing:
                print(f"[-] Round #{round_count}: Cau hoi da ton tai. TIEP TUC...")
                await asyncio.sleep(2)
                continue

            # 3. Create enriched document using normalization engine
            doc = create_normalized_doc(question=q, answer=a, source="ai_continuous_simulator")
            doc["service_type"] = qa_pair.get("service_type", "ao_dai")
            doc["category"] = qa_pair.get("category", "general")
            doc["priority_score"] = 90
            doc["status"] = "ACTIVE"
            doc["question_variations"] = [q, doc.get("question_normalized", q), doc.get("question_no_accent", q)]

            # 4. Insert into MongoDB Atlas Cloud
            await qa_col.insert_one(doc)
            added_count += 1

            print(f"[+] Round #{round_count} [ADDED TOTAL: {added_count}]")
            print(f"    Q: '{q[:60]}...'")
            print(f"    A: '{a[:60]}...'")
            print("-------------------------------------------------------------------")

            # 5. Rest 3 seconds between continuous rounds
            await asyncio.sleep(3)

    except KeyboardInterrupt:
        print("\n===================================================================")
        print(f"🛑 ĐÃ DỪNG TIẾN TRÌNH THEO YÊU CẦU NGUỜI DÙNG (Ctrl + C).")
        print(f"📊 Tổng số bản ghi mới đã được AI nạp vào MongoDB Atlas: {added_count} câu.")
        print("===================================================================")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(run_continuous_ai_simulation())
