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

# Tập 30 câu hỏi thực tế đa dạng của người dùng (Có dấu, không dấu, xưng hô khác nhau)
DIVERSE_OFFLINE_TEST_PROMPTS = [
    # Nhóm 1: Thuê áo dài & cọc tiền
    "Thời gian thuê áo dài tính như thế nào shop ơi?",
    "thoi gian thue ao dai duoc giu may ngay",
    "Shop bắt cọc bao nhiêu tiền khi thuê áo dài?",
    "tien dat coc thue ao dai co can cccd khong",
    
    # Nhóm 2: Tư vấn chọn màu da & vóc dáng
    "Em 24t cao 1m62 da ngam thue ao dai mau gi đi cưới?",
    "tơ la nam 1m78 nang 75kg nen mac ao dai nam phom gi",
    "Mặc áo dài cho mẹ chú rể 50 tuổi chọn màu gì sang?",
    "da trang cao 1m55 mac ao dai mau gi ton dang",

    # Nhóm 3: Cổ Phục & Chụp ảnh bối cảnh
    "Bên mình có gói chụp ảnh đôi Cổ Phục ở Đại Nội Huế không?",
    "gia goi chup anh co phuc hue bao nhieu tien",
    "Chụp ảnh áo dài ở Phố Cổ Hội An chọn tone màu nào đẹp?",
    "shop co ao dai nhat binh va ao tac khong",

    # Nhóm 4: Phí hư hại & Dời lịch
    "Nếu làm rách tà áo dài trong lúc chụp ngoại cảnh đền bao nhiêu?",
    "lo lam ban tao ao dai giat hap phi bao nhieu",
    "Mình đặt cọc giữ lịch chụp ảnh trước 1 tuần đổi ngày được không?",
    "khach du lich nuoc ngoai thue ao dai coc bang passport duoc khong",

    # Nhóm 5: Áo dài trẻ em & gia đình
    "Gia đình muốn thuê 8 bộ áo dài đồng màu chụp ảnh gia tộc có ưu đãi không?",
    "thue ao dai tre em cho be gai 5 tuoi co khong",
    "Chú rể người nước ngoài cao 1m85 có size áo dài tân thời không?",

    # Nhóm 6: Các câu hỏi test độ chính xác ngoài lề
    "Áo dài lụa tơ tằm giặt máy được không shop?",
    "co ban ao dai may san khong hay chi cho thue",
    "Shop mở cửa từ mấy giờ đến mấy giờ?",
]

async def run_offline_local_ai_evaluation():
    """
    CHẾ ĐỘ KIỂM THỬ THỜI GIAN THỰC 100% OFFLINE (0 TOKEN GEMINI COST)
    Kiểm tra xem Chatbot Engine Local trả lời đúng được bao nhiêu % dữ liệu trong MongoDB Atlas.
    """
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    qa_col = db["qa_data"]

    print("===================================================================")
    print("[*] KICH HOAT CHE DO EVALUATION LOCAL 100% OFFLINE (0 TOKEN GEMINI COST)")
    print("[*] Dang quet & kiem thu truc tiep Chatbot Engine voi MongoDB Atlas...")
    print("===================================================================\n")

    docs = await qa_col.find({}).to_list(length=20000)
    print(f"[*] Da tai {len(docs)} ban ghi Q&A tu MongoDB Atlas `qa_data` vao Local Memory...")

    chatbot = ChatbotEngine()
    
    hits = 0
    misses = 0
    total_test = len(DIVERSE_OFFLINE_TEST_PROMPTS)

    print("\n--- BAT DAU KIEM THU DO CHINH XAC LOCAL CHATBOT ---\n")

    for idx, prompt in enumerate(DIVERSE_OFFLINE_TEST_PROMPTS, 1):
        age_info = extract_age_and_range(prompt)
        gender = extract_gender(prompt)

        matches = chatbot.search_similar_questions(
            user_question=prompt,
            user_age_range=age_info["age_range"],
            user_gender=gender,
            qa_docs=docs,
            top_k=1
        )

        MIN_THRESHOLD = 65.0

        safe_prompt = prompt.encode('ascii', errors='replace').decode('ascii')
        if matches and matches[0]["score"] >= MIN_THRESHOLD:
            best = matches[0]
            hits += 1
            ans = best['qa']['answer'].encode('ascii', errors='replace').decode('ascii')
            print(f"[MATCH SUCCESS - Score: {best['score']:.1f}] Test #{idx:02d}")
            print(f"   Prompt khach : '{safe_prompt}'")
            print(f"   AI Local tra : '{ans}'")
        else:
            misses += 1
            top_score = matches[0]["score"] if matches else 0.0
            print(f"[TOPIC GAP / MISS - Score: {top_score:.1f}] Test #{idx:02d}")
            print(f"   Prompt khach : '{safe_prompt}' (Chua dat nguong 65.0)")

        print("-------------------------------------------------------------------")
        await asyncio.sleep(0.05)



    accuracy_rate = (hits / total_test) * 100.0

    print("\n===================================================================")
    print("BAO CAO KET QUA DANH GIA CHAT LUONG LOCAL AI (OFFLINE REPORT)")
    print("===================================================================")
    print(f"- Tong so Prompt kiem thu : {total_test} cau")
    print(f"- Tra loi chinh xac (HIT) : {hits} cau ({accuracy_rate:.1f}%)")
    print(f"- Cau chua co du lieu (MISS): {misses} cau")
    print(f"- Chi phi API Gemini       : 0$ (Hoan toan mien phi 100%)")
    print("===================================================================")

    client.close()


if __name__ == "__main__":
    asyncio.run(run_offline_local_ai_evaluation())
