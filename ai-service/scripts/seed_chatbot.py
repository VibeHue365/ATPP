# # ai-service/seed_kaggle_qa.py
# import asyncio
# import pandas as pd
# import os
# from database import db

# async def seed_kaggle_qa():
#     """
#     Load dữ liệu từ Kaggle vào MongoDB
#     """
#     qa_col = db["qa_data"]
    
#     # Đọc file CSV
#     csv_file = "data/qa_aodai_VN.csv"
    
#     if not os.path.exists(csv_file):
#         print(f"❌ Không tìm thấy file {csv_file}")
#         return
    
#     print(f"Đang đọc {csv_file}...")
#     df = pd.read_csv(csv_file)
    
#     print(f"Tổng cộng {len(df)} câu hỏi-trả lời")
    
#     print("Đang xóa dữ liệu cũ...")
#     await qa_col.delete_many({})
    
#     print("Đang xử lý và thêm dữ liệu...")
#     documents = []
    
#     for idx, row in df.iterrows():
#         doc = {
#             "_id": f"qa_{idx}",
#             "question": str(row['question']).strip(),
#             "answer": str(row['answer']).strip(),
#             "category": extract_category(str(row['question']).lower()),
#             "keywords": extract_keywords(str(row['question']).lower()),
#             "source": "kaggle"
#         }
#         documents.append(doc)
        
#         # Báo tiến độ mỗi 1000 dòng
#         if (idx + 1) % 2000 == 0:
#             print(f"   Đã xử lý {idx + 1}/{len(df)}...")
    
#     # Thêm vào MongoDB
#     if documents:
#         result = await qa_col.insert_many(documents)
#         print(f"\n✅ Seed Kaggle data xong!")
#         print(f"   - Thêm {len(result.inserted_ids)} câu hỏi-trả lời vào MongoDB")
#     else:
#         print("❌ Không có document nào để thêm")


# def extract_category(question: str) -> str:
#     """
#     Phân loại câu hỏi dựa trên keyword
#     """
#     question_lower = question.lower()
#     if "cổ" in question_lower:
#         return "collar"
#     elif "tay" in question_lower or "tay áo" in question_lower:
#         return "sleeve"
#     elif "tà" in question_lower:
#         return "tail"
#     elif "vải" in question_lower or "chất liệu" in question_lower:
#         return "fabric"
#     elif "thân áo" in question_lower:
#         return "body"
#     elif "xẻ" in question_lower:
#         return "slit"
#     elif any(term in question_lower for term in ["nam", "con trai", "đàn ông", "nữ", "con gái", "phụ nữ"]):
#         return "gender"
#     elif any(term in question_lower for term in ["size", "kích thước", "nặng", "kg", "cao", "chiều cao", "cân nặng"]):
#         return "size_fit"
#     else:
#         return "general"


# def extract_keywords(question: str) -> list:
#     """
#     Trích xuất keywords quan trọng từ câu hỏi
#     """
#     keywords = []
    
#     # Các từ khóa chính
#     key_terms = [
#         "cổ cao", "cổ tròn", "cổ thuyền", "cổ tim", "cổ vuông", "cổ yếm",
#         "tay áo dài", "tay áo lửng", "tay phồng", "tay raglan", "tay chuông",
#         "tà áo", "xẻ tà", "tà dài", "tà ngắn", "tà chéo",
#         "vải lụa", "vải voan", "vải nhung", "vải gấm",
#         "áo dài truyền thống", "áo dài cách tân", "áo dài cưới", "áo dài hiện đại",
#         "thân áo", "cau gối", "vai",
#         # Các từ khóa giới tính và kích cỡ/dáng người
#         "con trai", "nam giới", "đàn ông", "áo dài nam", "áo dài nữ", "con gái", "phụ nữ",
#         "cân nặng", "chiều cao", "nặng", "cao", "mập", "béo", "gầy", "ốm", "size", "kích thước"
#     ]
    
#     question_lower = question.lower()
#     for term in key_terms:
#         if term in question_lower:
#             keywords.append(term)
    
#     return keywords


# if __name__ == "__main__":
#     asyncio.run(seed_kaggle_qa())

# ai-service/seed_kaggle_qa.py
import asyncio
import pandas as pd
import os
from database import db
from normalization_helpers import create_normalized_doc


async def seed_kaggle_qa():
    """
    Load dữ liệu từ Kaggle CSV vào MongoDB với normalization pronouns + age
    """
    qa_col = db["qa_data"]
    
    # Đọi file CSV
    csv_file = "data/qa_aodai_VN.csv"
    
    if not os.path.exists(csv_file):
        print(f"❌ Không tìm thấy file {csv_file}")
        return
    
    print(f"Đang đọc {csv_file}...")
    df = pd.read_csv(csv_file)
    
    print(f"Tổng cộng {len(df)} câu hỏi-trả lời")
    
    print("Đang xóa dữ liệu cũ...")
    await qa_col.delete_many({})
    
    print("Đang xử lý và thêm dữ liệu (normalize pronouns + age)...")
    documents = []
    
    for idx, row in df.iterrows():
        question = str(row['question']).strip()
        answer = str(row['answer']).strip()
        
        # ===== NORMALIZE =====
        doc = create_normalized_doc(question, answer, source="kaggle")
        doc["_id"] = f"qa_{idx}"
        
        documents.append(doc)
        
        # Báo tiến độ mỗi 2000 dòng
        if (idx + 1) % 2000 == 0:
            print(f"   Đã xử lý {idx + 1}/{len(df)}...")
    
    # Thêm vào MongoDB
    if documents:
        result = await qa_col.insert_many(documents)
        print(f"\n✅ Seed Kaggle data xong!")
        print(f"   - Thêm {len(result.inserted_ids)} câu hỏi-trả lời vào MongoDB")
        print(f"   - Đã normalize tất cả pronouns và tuổi")
    else:
        print("❌ Không có document nào để thêm")


async def test_normalization():
    """
    Test normalization trước khi seed toàn bộ
    """
    print("\n" + "="*80)
    print("TEST NORMALIZATION")
    print("="*80)
    
    from normalization_helpers import create_normalized_doc
    
    test_questions = [
        ("mình là con gái 25 tuổi muốn mua áo dài cho đám cưới", "Lụa tơ tằm..."),
        ("ta là con gái và muốn chụp ảnh với áo dài", "Kiểu cổ thuyền..."),
        ("em là con trai 30 tuổi, bộ áo dài nào phù hợp", "Áo dài nam..."),
        ("con gái muốn mua áo dài", "Có nhiều lựa chọn..."),
        ("tôi muốn tư vấn về size áo dài", "Size phù hợp..."),
    ]
    
    for question, answer in test_questions:
        doc = create_normalized_doc(question, answer)
        
        print(f"\n📝 Question: {question}")
        print(f"   Normalized: {doc['question_normalized']}")
        print(f"   Age: {doc['age_mentioned']} → Range: {doc['age_range']}")
        print(f"   Gender: {doc['gender']}")
        print(f"   Occasion: {doc['occasion']}")
        print(f"   Intent: {doc['intent']}")
        print(f"   Category: {doc['category']}")
        print(f"   Keywords: {doc['keywords']}")
    
    print("\n" + "="*80)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        # Chạy test: python seed_kaggle_qa.py test
        asyncio.run(test_normalization())
    else:
        # Chạy seed: python seed_kaggle_qa.py
        asyncio.run(seed_kaggle_qa())