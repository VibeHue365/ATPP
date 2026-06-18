"""
Script tạo và import bộ dữ liệu QA chất lượng cao về Nghiệp vụ và Chính sách của cửa hàng vào MongoDB qa_data.
Dữ liệu này dành cho LOCAL SEARCH (các câu hỏi thường gặp FAQs về chính sách thuê, cọc, trả, size đồ...).
KHÔNG chứa câu hỏi về đề xuất sản phẩm cụ thể (để Gemini RAG xử lý).

Chạy: python scripts/seed_qa_quality.py
"""

import asyncio
import sys
from db.connection import db

if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

QA_KNOWLEDGE_BASE = [
    # ─── CHÍNH SÁCH THUÊ & CỌC (RENTAL & DEPOSIT) ───────────────────────────
    {
        "_id": "qa_rental_001",
        "question_original": "Thời gian thuê áo dài tính như thế nào và được giữ trong bao lâu?",
        "question_normalized": "thoi gian thue ao dai tinh nhu the nao va duoc giu trong bao lau",
        "answer": "Thời gian thuê tiêu chuẩn tại Vi Bê Huế là **3 ngày 2 đêm** (ví dụ: nhận ngày 1, trả ngày 3). Nếu bạn có nhu cầu giữ áo lâu hơn cho chuyến đi xa, vui lòng báo trước với shop để được hỗ trợ tính phí ưu đãi phát sinh nhé! 😊",
        "keywords": ["thời gian thuê", "giữ bao lâu", "mấy ngày", "hạn trả", "bao lâu"],
        "category": "rental_policy", "intent": "general_qa", "is_recommendation_intent": False,
        "gender": "unknown", "age_range": "age_unspecified", "occasion": "general", "source": "manual"
    },
    {
        "_id": "qa_rental_002",
        "question_original": "Tiền đặt cọc khi thuê áo dài tính như thế nào? Có cần CCCD không?",
        "question_normalized": "tien dat coc khi thue ao dai tinh nhu the nao co can cccd khong",
        "answer": "Khi thuê áo dài, bạn có 2 hình thức cọc: ① Để lại **CCCD gốc** kèm tiền cọc **500,000đ/bộ**; ② Không để lại giấy tờ thì cọc **100% giá trị gốc** của trang phục (shop sẽ hoàn cọc ngay khi bạn trả đồ nguyên vẹn).",
        "keywords": ["tiền đặt cọc", "cọc tiền", "thế chấp", "cccd", "chứng minh thư", "giấy tờ", "đặt cọc"],
        "category": "rental_policy", "intent": "general_qa", "is_recommendation_intent": False,
        "gender": "unknown", "age_range": "age_unspecified", "occasion": "general", "source": "manual"
    },
    {
        "_id": "qa_rental_003",
        "question_original": "Nếu trả áo dài trễ hẹn thì shop tính phí phạt như thế nào?",
        "question_normalized": "neu tra ao dai tre hen thi shop tinh phi phat nhu the nao",
        "answer": "Nếu trả áo trễ hạn mà không báo trước, phí phát sinh sẽ là **50,000đ/ngày** đối với áo dài thường và **100,000đ/ngày** đối với áo dài thiết kế/thêu cao cấp. Nếu gặp sự cố đột xuất, hãy nhắn tin ngay cho shop để thỏa thuận thêm nhé!",
        "keywords": ["trễ hẹn", "trả muộn", "quá hạn", "phí phạt", "phạt tiền", "trễ ngày"],
        "category": "rental_policy", "intent": "general_qa", "is_recommendation_intent": False,
        "gender": "unknown", "age_range": "age_unspecified", "occasion": "general", "source": "manual"
    },
    {
        "_id": "qa_rental_004",
        "question_original": "Nếu làm bẩn, rách hoặc hỏng áo dài khi thuê thì đền bù thế nào?",
        "question_normalized": "neu lam ban rach hoac hong ao dai khi thue thi den bu the nao",
        "answer": "Với vết bẩn giặt được (bụi đất, nước ngọt), shop miễn phí xử lý. Với vết bẩn cứng đầu (mực dột, dầu mỡ, màu vẽ), bạn đền bù phí tẩy hấp **50,000đ - 100,000đ**. Trường hợp rách vải, cháy do ủi, hư hỏng nặng không thể phục hồi, shop xin phép thu phí đền bù từ **50% - 100% giá trị áo** tùy tình trạng hao mòn.",
        "keywords": ["làm bẩn", "rách áo", "hỏng đồ", "đền bù", "đền tiền", "làm mất", "sự cố"],
        "category": "rental_policy", "intent": "general_qa", "is_recommendation_intent": False,
        "gender": "unknown", "age_range": "age_unspecified", "occasion": "general", "source": "manual"
    },

    # ─── THỬ ĐỒ & DỊCH VỤ SỬA ĐỒ (FITTING & ALTERATION) ────────────────────
    {
        "_id": "qa_fitting_001",
        "question_original": "Tôi có thể đến cửa hàng thử áo dài trực tiếp không? Địa chỉ ở đâu?",
        "question_normalized": "toi co the den cua hang thu ao dai truc tiep khong dia chi o dau",
        "answer": "Có chứ ạ! Bạn có thể đến thử đồ trực tiếp tại showroom Vi Bê Huế ở: **Số 12 Lê Lợi, TP. Huế**. Shop mở cửa từ **8:00 - 21:30 hàng ngày** kể cả cuối tuần. Rất hân hạnh được đón tiếp bạn! 🌸",
        "keywords": ["thử trực tiếp", "đến thử", "showroom", "địa chỉ", "ở đâu", "mấy giờ mở cửa", "đường nào"],
        "category": "fitting", "intent": "general_qa", "is_recommendation_intent": False,
        "gender": "unknown", "age_range": "age_unspecified", "occasion": "general", "source": "manual"
    },
    {
        "_id": "qa_fitting_002",
        "question_original": "Shop có nhận chỉnh sửa kích cỡ (bóp eo, cắt tà) áo dài cho vừa người tôi không?",
        "question_normalized": "shop co nhan chinh sua kich co bop eo cat ta ao dai cho vua nguoi toi khong",
        "answer": "Để bảo toàn phom dáng chuẩn của trang phục cho thuê, shop **không nhận cắt tà** hoặc thay đổi thiết kế gốc. Tuy nhiên, shop hỗ trợ **bóp eo hoặc nới nhẹ** bằng chỉ may tạm thời (không cắt vải) để áo ôm dáng bạn nhất khi mặc. Dịch vụ này hoàn toàn miễn phí!",
        "keywords": ["chỉnh sửa", "bóp eo", "cắt tà", "nới eo", "sửa áo", "vừa người", "sửa dáng"],
        "category": "fitting", "intent": "general_qa", "is_recommendation_intent": False,
        "gender": "unknown", "age_range": "age_unspecified", "occasion": "general", "source": "manual"
    },

    # ─── BẢNG SIZE & ĐO SỐ ĐO (SIZING & MEASUREMENT) ───────────────────────
    {
        "_id": "qa_sizing_001",
        "question_original": "Bảng size áo dài của shop được tính như thế nào?",
        "question_normalized": "bang size ao dai cua shop duoc tinh nhu the nao",
        "answer": "Bảng size áo dài nữ tiêu chuẩn tại shop:\n- **Size S**: Ngực 80-84cm | Eo 62-66cm | Hông 86-90cm (Cân nặng ~42-48kg)\n- **Size M**: Ngực 85-89cm | Eo 66-70cm | Hông 91-94cm (Cân nặng ~48-54kg)\n- **Size L**: Ngực 90-94cm | Eo 71-75cm | Hông 95-98cm (Cân nặng ~54-60kg)\n- **Size XL**: Ngực 95-100cm | Eo 76-81cm | Hông 99-104cm (Cân nặng ~60-68kg)\nBạn nên đối chiếu theo số đo vòng ngực và eo là chuẩn xác nhất nhé!",
        "keywords": ["bảng size", "số đo", "cân nặng", "size s m l", "vừa size", "bao nhiêu kg"],
        "category": "sizing", "intent": "general_qa", "is_recommendation_intent": False,
        "gender": "female", "age_range": "age_unspecified", "occasion": "general", "source": "manual"
    },
    {
        "_id": "qa_sizing_002",
        "question_original": "Làm cách nào để tự đo các chỉ số cơ thể tại nhà chuẩn nhất?",
        "question_normalized": "lam cach nao de tu do cac chi so co the tai nha chuan nhat",
        "answer": "Bạn dùng thước dây mềm đo sát cơ thể theo 3 bước:\n1. **Vòng 1 (Ngực)**: Đo quanh đỉnh ngực nơi lớn nhất (nhớ mặc áo ngực thường mặc).\n2. **Vòng 2 (Eo)**: Đo quanh thắt eo nhỏ nhất (thường trên rốn 3cm).\n3. **Vòng 3 (Hông)**: Đo vòng nở nhất của mông.\nHãy đứng thẳng, thả lỏng cơ thể khi đo để có số đo chính xác nhé!",
        "keywords": ["tự đo", "cách đo", "thước dây", "số đo ngực", "đo eo", "hướng dẫn đo"],
        "category": "sizing", "intent": "general_qa", "is_recommendation_intent": False,
        "gender": "unknown", "age_range": "age_unspecified", "occasion": "general", "source": "manual"
    },

    # ─── GIẶT ỦI & BẢO QUẢN (CLEANING & CARE) ──────────────────────────────
    {
        "_id": "qa_care_001",
        "question_original": "Nhận áo dài về tôi có cần tự giặt không? Khi trả đồ tôi có cần giặt sạch trước không?",
        "question_normalized": "nhan ao dai ve toi co can tu giat khong khi tra do toi co can giat sach truoc khong",
        "answer": "Bạn **KHÔNG cần giặt** áo dài khi nhận lẫn khi trả đồ! Shop cam kết toàn bộ trang phục trước khi giao đều đã được giặt hấp và sấy khử khuẩn sạch sẽ. Khi mặc xong, bạn chỉ cần xếp gọn áo dài cất vào túi và mang trả lại, shop sẽ tự thực hiện quy trình giặt là chuyên dụng để bảo vệ sợi vải.",
        "keywords": ["có cần giặt", "giặt hấp", "trả đồ giặt", "giặt sạch", "vệ sinh", "bẩn", "sấy"],
        "category": "care", "intent": "general_qa", "is_recommendation_intent": False,
        "gender": "unknown", "age_range": "age_unspecified", "occasion": "general", "source": "manual"
    },
    {
        "_id": "qa_care_002",
        "question_original": "Làm thế nào để ủi (là) áo dài lụa hoặc gấm an toàn nếu bị nhăn khi di chuyển?",
        "question_normalized": "lam the nao de ui la ao dai lua hoac gam an toan neu bi nhan khi di chuyen",
        "answer": "Đối với chất lụa và gấm nhạy cảm, bạn hãy dùng **bàn là hơi nước đứng** ở chế độ nhẹ nhất. Nếu dùng bàn là thường: ① Lộn trái áo dài; ② Lót một tấm vải cotton mỏng sạch lên trên bề mặt; ③ Điều chỉnh nhiệt độ ở mức **Silk/Low** (Thấp nhất); ④ Tránh đè bàn là quá lâu tại một vị trí để tránh cháy sém vải.",
        "keywords": ["ủi áo", "là áo", "ủi lụa", "bị nhăn", "là phẳng", "nhiệt độ", "bàn là"],
        "category": "care", "intent": "general_qa", "is_recommendation_intent": False,
        "gender": "unknown", "age_range": "age_unspecified", "occasion": "general", "source": "manual"
    },

    # ─── GIAO NHẬN & SHIP (SHIPPING) ────────────────────────────────────────
    {
        "_id": "qa_shipping_001",
        "question_original": "Cửa hàng có giao áo dài tận nhà không? Phí ship tính thế nào?",
        "question_normalized": "cua hang co giao ao dai tan nha khong phi ship tinh the nao",
        "answer": "Shop hỗ trợ giao đồ tận nhà! ① **Nội thành TP. Huế**: Giao hỏa tốc nhận trong ngày (phí ship tính theo App Ahamove/Grab); ② **Các tỉnh thành khác**: Giao hàng chuyển phát nhanh qua bưu điện (khoảng 2-3 ngày, phí ship dao động 30,000đ - 50,000đ tùy cân nặng). Khách hàng chịu phí ship 2 chiều khi thuê online.",
        "keywords": ["giao nhà", "ship đồ", "phí ship", "hỏa tốc", "bưu điện", "vận chuyển", "nhận hàng"],
        "category": "shipping", "intent": "general_qa", "is_recommendation_intent": False,
        "gender": "unknown", "age_range": "age_unspecified", "occasion": "general", "source": "manual"
    },

    # ─── QUY TRÌNH ĐẶT LỊCH THUÊ (BOOKING PROCESS) ──────────────────────────
    {
        "_id": "qa_booking_001",
        "question_original": "Quy trình đăng ký đặt lịch thuê áo dài online trên web như thế nào?",
        "question_normalized": "quy trinh dang ky dat lich thue ao dai online tren web nhu the nao",
        "answer": "Rất đơn giản ạ! Bạn thực hiện theo 4 bước:\n1. Chọn mẫu áo dài yêu thích tại danh mục **Cho thuê**.\n2. Chọn thời gian mong muốn nhận và trả đồ.\n3. Nhấp **Đồng ý đặt lịch** và thực hiện chuyển cọc qua ngân hàng để giữ chỗ.\n4. Nhận mã xác nhận đặt lịch qua email/điện thoại và chờ nhận đồ hoặc đến cửa hàng nhận trực tiếp.",
        "keywords": ["đăng ký", "đặt lịch", "online", "quy trình", "thủ tục", "giữ đồ", "các bước"],
        "category": "booking", "intent": "general_qa", "is_recommendation_intent": False,
        "gender": "unknown", "age_range": "age_unspecified", "occasion": "general", "source": "manual"
    }
]

async def main():
    qa_col = db["qa_data"]

    # Đếm hiện tại
    existing = await qa_col.count_documents({})
    print(f"[Info] Hiện có {existing} documents trong qa_data")

    # Xóa sạch collection trước khi ghi đè dữ liệu nghiệp vụ chuẩn
    print("[Info] Đang dọn sạch các QA cũ lỗi thời khỏi qa_data...")
    await qa_col.delete_many({})
    print("[OK] Đã dọn sạch collection qa_data")

    inserted = 0
    for doc in QA_KNOWLEDGE_BASE:
        doc_id = doc["_id"]
        try:
            await qa_col.insert_one(doc)
            print(f"[OK]   {doc_id}: {doc['question_original'][:50]}...")
            inserted += 1
        except Exception as e:
            print(f"[Error] {doc_id}: {e}")

    print(f"\n=== Kết quả nạp lại dữ liệu ===")
    print(f"Đã thêm mới: {inserted} câu hỏi nghiệp vụ chuẩn")
    print(f"Tổng số bản ghi hiện tại trong qa_data: {inserted}")

if __name__ == "__main__":
    asyncio.run(main())
