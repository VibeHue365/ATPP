from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from db.connection import users_col, services_col, bookings_col, db, products_col
from recommendation.style_engine import StyleMatchingEngine
from chatbot.chatbot_engine import ChatbotEngine
from chatbot.normalization import extract_age_and_range, extract_gender

app    = FastAPI(title="AI Style Matching", version="2.0")
engine = StyleMatchingEngine()
chatbot = ChatbotEngine()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ImageChatRequest(BaseModel):
    message: str = ""
    image_base64: str
    mime_type: str = "image/jpeg"


async def _get_product_context(limit: int = 10) -> str:
    """Fetch top products from VIBE_Hue.products and format as a context string for Gemini RAG."""
    try:
        products = await products_col.find(
            {"status": "ACTIVE"},
            {"_id": 1, "name": 1, "description": 1, "basePrice": 1, "materials": 1, "colors": 1, "sizes": 1, "specifications": 1, "images": 1}
        ).limit(limit).to_list(length=limit)

        if not products:
            return ""

        lines = []
        for p in products:
            specs = dict(p.get("specifications") or {})
            spec_str = ", ".join(f"{k}: {v}" for k, v in specs.items()) if specs else ""
            line = (
                f"- ID: {str(p['_id'])} | "
                f"Tên: {p.get('name', 'N/A')} | "
                f"Giá thuê: {p.get('basePrice', 0):,}đ | "
                f"Chất liệu: {', '.join(p.get('materials', []) or ['N/A'])} | "
                f"Màu sắc: {', '.join(p.get('colors', []) or ['N/A'])} | "
                f"Kích cỡ: {', '.join(p.get('sizes', []) or ['N/A'])}"
                + (f" | Đặc điểm: {spec_str}" if spec_str else "")
                + (f" | Mô tả: {p['description'][:120]}" if p.get('description') else "")
            )
            lines.append(line)

        return "\n".join(lines)
    except Exception as e:
        print(f"[ProductContext Error] {e}")
        return ""


@app.get("/")
async def root():
    return {"message": "AI Style Matching API đang chạy ✅"}


# ════════════════════════════════════════════════════════════════
# RECOMMENDATION ENDPOINTS (UC-X04)
# ════════════════════════════════════════════════════════════════

@app.get("/recommend/{user_id}")
async def recommend(user_id: str, top_k: int = 5):
    user = await users_col.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy user: {user_id}")

    cursor   = bookings_col.find({"user_id": user_id}).sort("booked_at", -1).limit(10)
    bookings = await cursor.to_list(length=10)

    svc_cursor = services_col.find({"status": "active"})
    services   = await svc_cursor.to_list(length=500)

    profile = engine.build_user_profile(user["preferences"], bookings)
    results = engine.recommend(profile, services, top_k)

    return {
        "user_id":   user_id,
        "user_name": user.get("name"),
        "recommendations": results
    }


@app.get("/recommend/{user_id}/ao-dai")
async def recommend_ao_dai(user_id: str, top_k: int = 5):
    user = await users_col.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy user")

    cursor     = bookings_col.find({"user_id": user_id}).sort("booked_at", -1).limit(10)
    bookings   = await cursor.to_list(length=10)
    svc_cursor = services_col.find({"status": "active", "service_type": "ao_dai"})
    services   = await svc_cursor.to_list(length=500)

    profile = engine.build_user_profile(user["preferences"], bookings)
    results = engine.recommend(profile, services, top_k)
    return {"user_id": user_id, "recommendations": results}


@app.get("/recommend/{user_id}/photographer")
async def recommend_photographer(user_id: str, top_k: int = 5):
    user = await users_col.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy user")

    cursor     = bookings_col.find({"user_id": user_id}).sort("booked_at", -1).limit(10)
    bookings   = await cursor.to_list(length=10)
    svc_cursor = services_col.find({"status": "active", "service_type": "photographer"})
    services   = await svc_cursor.to_list(length=500)

    profile = engine.build_user_profile(user["preferences"], bookings)
    results = engine.recommend(profile, services, top_k)
    return {"user_id": user_id, "recommendations": results}


# ════════════════════════════════════════════════════════════════
# CHATBOT ENDPOINTS (UC-M06)
# ════════════════════════════════════════════════════════════════

# @app.post("/chat")
# async def chat(message: str):
#     """
#     Chatbot trả lời câu hỏi về áo dài
#     """
#     qa_col = db["qa_data"]
#     all_qa = await qa_col.find({}).to_list(length=20000)

#     result = chatbot.answer_question(message, all_qa)
    
#     # Cơ chế TỰ HỌC (Auto-learning): Nếu câu trả lời sinh ra từ Gemini Fallback
#     # Chúng ta sẽ lưu bản ghi Q&A mới này trực tiếp vào MongoDB qa_data
#     if result.get("source") == "gemini_learned" and "new_doc" in result:
#         new_doc = result["new_doc"]
#         new_doc["_id"] = f"qa_learned_{len(all_qa)}"
#         try:
#             await qa_col.insert_one(new_doc)
#             print(f"💡 [Auto-Learning] Đã tự học và lưu câu hỏi mới vào DB: '{message}'")
#         except Exception as e:
#             print(f"⚠️ [Auto-Learning] Không thể lưu câu hỏi mới vào DB: {e}")
            
#     # Xóa trường new_doc trước khi gửi về client để giữ cho payload gọn gàng
#     result.pop("new_doc", None)
#     return result

async def _get_recommended_products(answer_text: str) -> tuple[str, list[dict]]:
    """
    Parses [RECOMMENDED_IDS: ...] from answer_text, fetches full product details,
    and returns (cleaned_answer_text, product_list).
    """
    import re
    from bson import ObjectId
    if not answer_text:
        return "", []
        
    match = re.search(r'\[RECOMMENDED_IDS:\s*(.*?)\]', answer_text, re.IGNORECASE)
    if not match:
        return answer_text, []
    
    id_str = match.group(1)
    cleaned_text = re.sub(r'\[RECOMMENDED_IDS:\s*.*?\]', '', answer_text, flags=re.IGNORECASE).strip()
    
    ids = [i.strip() for i in id_str.split(",") if i.strip()]
    if not ids:
        return cleaned_text, []
    
    try:
        object_ids = []
        for i in ids:
            try:
                object_ids.append(ObjectId(i))
            except Exception:
                pass
                
        query = {"$or": [{"_id": {"$in": object_ids}}, {"_id": {"$in": ids}}]} if object_ids else {"_id": {"$in": ids}}
        products = await products_col.find(query).to_list(length=10)
        
        serialized_products = []
        for p in products:
            p_dict = dict(p)
            p_dict["_id"] = str(p_dict["_id"])
            p_dict.pop("providerId", None)
            p_dict.pop("categoryId", None)
            p_dict.pop("createdAt", None)
            p_dict.pop("updatedAt", None)
            serialized_products.append(p_dict)
            
        return cleaned_text, serialized_products
    except Exception as e:
        print(f"[RecommendedProducts Error] {e}")
        return cleaned_text, []


@app.post("/chat")
async def chat(message: str):
    # Extract age_range và gender từ user message
    age_info = extract_age_and_range(message)
    user_age_range = age_info["age_range"]
    user_gender = extract_gender(message)

    qa_col = db["qa_data"]
    all_qa = await qa_col.find({}).to_list(length=20000)

    result = chatbot.answer_question(
        message,
        user_age_range,
        user_gender,
        all_qa
    )

    recommended_prods = []

    # Nếu không tìm thấy trong DB nội bộ → dùng Gemini RAG với product context
    if not result.get("found") or result.get("source") == "gemini_learned":
        product_context = await _get_product_context(limit=10)
        gemini_answer = chatbot.call_gemini_fallback(message, product_context=product_context)
        if gemini_answer:
            cleaned_answer, recommended_prods = await _get_recommended_products(gemini_answer)
            from chatbot.normalization import create_normalized_doc
            new_doc = create_normalized_doc(message, cleaned_answer, source="gemini_learned")
            result = {
                "question": message,
                "answer": cleaned_answer,
                "found": True,
                "matched_question": "Tri thức tự học từ Gemini AI Trợ lý",
                "category": new_doc.get("category", "general"),
                "confidence": 0.85,
                "source": "gemini_learned",
                "age_range_used": user_age_range,
                "gender_used": user_gender,
                "new_doc": new_doc,
                "recommended_products": recommended_prods
            }

    # Cơ chế TỰ HỌC
    if result.get("source") == "gemini_learned" and "new_doc" in result:
        new_doc = result["new_doc"]
        new_doc["_id"] = f"qa_learned_{len(all_qa)}"
        try:
            await qa_col.insert_one(new_doc)
            print(f"[Auto-Learning] Saved: {message.encode('ascii', errors='replace').decode('ascii')}")
        except Exception as e:
            print(f"[Auto-Learning Error] {str(e).encode('ascii', errors='replace').decode('ascii')}")

    result.pop("new_doc", None)
    if "recommended_products" not in result:
        result["recommended_products"] = recommended_prods
    return result


@app.post("/chat/with-image")
async def chat_with_image(req: ImageChatRequest):
    """
    Chatbot phân tích hình ảnh áo dài bằng Gemini Vision multimodal.
    Nhận: { message, image_base64, mime_type }
    Trả về: { answer, source, recommended_products }
    """
    product_context = await _get_product_context(limit=8)
    answer = chatbot.call_gemini_with_image(
        question=req.message,
        image_base64=req.image_base64,
        mime_type=req.mime_type,
        product_context=product_context,
    )
    cleaned_answer, recommended_prods = await _get_recommended_products(answer)
    return {
        "question": req.message,
        "answer": cleaned_answer,
        "found": True,
        "source": "gemini_vision",
        "confidence": 0.95,
        "recommended_products": recommended_prods
    }

@app.get("/chat/categories")
async def get_categories():
    """
    Lấy danh sách category Q&A
    """
    qa_col = db["qa_data"]
    categories = await qa_col.distinct("category")
    return {"categories": categories}


@app.get("/chat/qa-by-category/{category}")
async def get_qa_by_category(category: str):
    """
    Lấy tất cả Q&A theo category (collar, sleeve, tail, fabric...)
    """
    qa_col = db["qa_data"]
    qa_list = await qa_col.find({"category": category}).to_list(length=500)
    return {"category": category, "total": len(qa_list), "items": qa_list}