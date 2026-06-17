# ai-service/chatbot_engine.py
from typing import List, Dict
import re
import math
import os
import traceback
from dotenv import load_dotenv

load_dotenv()


class ChatbotEngine:
    """Engine tìm kiếm và trả lời câu hỏi về áo dài với smart age-range + gender matching + Gemini RAG fallback"""

    def __init__(self):
        self.stopwords = {
            "mình", "là", "và", "thì", "có", "bộ", "nào", "với", "cho", "ở", "của", "gì", "nhé",
            "ạ", "ad", "đây", "đó", "kia", "này", "vậy", "thế", "cái", "con", "chiếc", "những",
            "các", "đang", "đã", "sẽ", "được", "bị", "lại", "ra", "vào", "lên", "xuống", "như",
            "nhưng", "để", "làm", "sao", "bao", "nhiều", "ít", "hơn", "đi", "luôn", "nữa", "thôi"
        }
        self.idf = {}
        self.last_docs_len = 0

    def _compute_idf(self, qa_docs: List[Dict]):
        """Tính toán IDF cho corpus"""
        total_docs = len(qa_docs)
        if total_docs == 0:
            self.idf = {}
            return

        doc_counts = {}
        for qa in qa_docs:
            q_text = self._preprocess(qa.get("question_normalized", ""))
            a_text = self._preprocess(qa.get("answer", ""))
            
            words = set(q_text.split()) | set(a_text.split())
            
            for kw in qa.get("keywords", []):
                words.update(self._preprocess(kw).split())

            for word in words:
                if word not in self.stopwords:
                    doc_counts[word] = doc_counts.get(word, 0) + 1

        self.idf = {}
        for word, count in doc_counts.items():
            self.idf[word] = math.log(total_docs / (count + 1)) + 1.0

        self.last_docs_len = total_docs

    def _is_age_range_compatible(self, user_age_range: str, db_age_range: str) -> bool:
        """
        Kiểm tra xem 2 age range có tương thích không
        
        Logic:
        - age_unspecified match với age_unspecified
        - age_unspecified match với bất kỳ range nào (tổng quát)
        - same range match với nhau
        - khác range không match
        """
        if user_age_range == "age_unspecified" and db_age_range == "age_unspecified":
            return True
        
        if user_age_range == "age_unspecified":
            # User không nhắc tuổi → chỉ match với answers không specific tuổi
            return db_age_range == "age_unspecified"
        
        if db_age_range == "age_unspecified":
            # DB answer không specific → match với bất kỳ user age
            return True
        
        # User có tuổi → match với cùng age_range
        return user_age_range == db_age_range

    def _is_gender_compatible(self, user_gender: str, db_gender: str) -> bool:
        """
        Kiểm tra xem 2 giới tính có tương thích không
        
        Logic:
        - "unknown" match với everything (tổng quát)
        - same gender match với nhau
        - khác gender không match
        """
        # Nếu 1 trong 2 là unknown → match (general answer)
        if user_gender == "unknown" or db_gender == "unknown":
            return True
        
        # Nếu cùng giới tính → match
        return user_gender == db_gender

    def search_similar_questions(self, user_question: str, user_age_range: str, user_gender: str, qa_docs: List[Dict], top_k: int = 3) -> List[Dict]:
        """
        Tìm câu Q&A giống nhất, có filter age_range + gender thông minh
        """
        if not self.idf or len(qa_docs) != self.last_docs_len:
            self._compute_idf(qa_docs)

        user_query = self._preprocess(user_question)
        user_words = [w for w in user_query.split() if w not in self.stopwords]

        scored = []

        for qa in qa_docs:
            score = 0.0
            
            # ===== FILTER AGE RANGE =====
            db_age_range = qa.get("age_range", "age_unspecified")
            if not self._is_age_range_compatible(user_age_range, db_age_range):
                continue

            # ===== FILTER GENDER =====
            db_gender = qa.get("gender", "unknown")
            if not self._is_gender_compatible(user_gender, db_gender):
                continue

            # Keywords match
            for kw in qa.get("keywords", []):
                kw_clean = self._preprocess(kw)
                if kw_clean and kw_clean in user_query:
                    kw_words = kw_clean.split()
                    kw_idf = sum(self.idf.get(w, 1.0) for w in kw_words)
                    score += 15.0 + kw_idf * 2.0

            # Question words match (dùng normalized)
            q_clean = self._preprocess(qa.get("question_normalized", ""))
            question_words = set(q_clean.split())
            matched_q_words = [word for word in user_words if word in question_words]
            question_score = 0.0
            for word in matched_q_words:
                word_idf = self.idf.get(word, 1.0)
                question_score += word_idf * 4.0

            if len(matched_q_words) == 1 and len(user_words) > 2:
                question_score *= 0.3

            score += question_score

            # Answer words match
            a_clean = self._preprocess(qa.get("answer", ""))
            answer_words = set(a_clean.split())
            for word in user_words:
                if word in answer_words:
                    word_idf = self.idf.get(word, 1.0)
                    score += word_idf * 1.0

            if score > 0:
                scored.append({
                    "qa": qa,
                    "score": score,
                    "match_type": "keyword"
                })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]

    def answer_question(self, user_question: str, user_age_range: str, user_gender: str, qa_docs: List[Dict]) -> Dict:
        """
        Trả lời câu hỏi với smart age-range + gender filtering + Gemini fallback RAG
        """
        clean_question = user_question.strip()
        if not clean_question or len(clean_question) < 3:
            return {
                "question": user_question,
                "answer": "Bạn vui lòng đặt câu hỏi chi tiết hơn một chút nhé! 😊",
                "found": False,
                "confidence": 0.0,
                "age_range_used": user_age_range,
                "gender_used": user_gender
            }

        # Tìm kiếm với age_range + gender filter
        similar_qas = self.search_similar_questions(user_question, user_age_range, user_gender, qa_docs, top_k=1)

        MIN_SCORE_THRESHOLD = 35.0

        if not similar_qas or similar_qas[0]["score"] < MIN_SCORE_THRESHOLD:
            # GỌI GEMINI FALLBACK & TỰ HỌC
            api_key = os.environ.get("GEMINI_API_KEY")
            if api_key:
                try:
                    gemini_answer = self.call_gemini_fallback(user_question)
                    if gemini_answer:
                        from chatbot.normalization import create_normalized_doc
                        # Tự động chuẩn hóa câu Q&A mới học được
                        new_doc = create_normalized_doc(user_question, gemini_answer, source="gemini_learned")
                        
                        return {
                            "question": user_question,
                            "answer": gemini_answer,
                            "found": True,
                            "matched_question": "Tri thức tự học từ Gemini AI Trợ lý",
                            "category": new_doc.get("category", "general"),
                            "confidence": 0.85,
                            "source": "gemini_learned",
                            "age_range_matched": new_doc.get("age_range"),
                            "gender_matched": new_doc.get("gender"),
                            "age_range_used": user_age_range,
                            "gender_used": user_gender,
                            "new_doc": new_doc
                        }
                except Exception:
                    print(f"[Gemini Fallback Error]")
                    print(traceback.format_exc())

            return {
                "question": user_question,
                "answer": "Mình chưa có thông tin về câu hỏi này. Bạn có thể thử hỏi về cổ áo, tay áo, tà áo hoặc các kiểu áo dài nhé! 😊",
                "found": False,
                "confidence": 0.0,
                "age_range_used": user_age_range,
                "gender_used": user_gender
            }

        best_match = similar_qas[0]
        best_qa = best_match["qa"]
        best_score = best_match["score"]

        confidence = min(0.5 + (best_score / 100.0), 0.99)

        return {
            "question": user_question,
            "answer": best_qa["answer"],
            "found": True,
            "matched_question": best_qa["question_original"],
            "category": best_qa.get("category", "unknown"),
            "confidence": round(confidence, 2),
            "source": best_qa.get("source", "kaggle"),
            "age_range_matched": best_qa.get("age_range"),
            "gender_matched": best_qa.get("gender"),
            "age_range_used": user_age_range,
            "gender_used": user_gender
        }

    def call_gemini_fallback(self, question: str, product_context: str = "") -> str:
        """
        Gọi trực tiếp Gemini API để trả lời câu hỏi khi database nội bộ không có dữ liệu.
        Nếu có product_context (từ MongoDB products), inject vào prompt để RAG.
        """
        from google import genai

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return ""

        client = genai.Client(api_key=api_key)

        context_block = ""
        if product_context:
            context_block = f"""
Dưới đây là danh sách sản phẩm Áo Dài đang có trong hệ thống cửa hàng:
---
{product_context}
---
"""

        prompt = f"""Bạn là một chuyên gia tư vấn áo dài Việt Nam am hiểu sâu sắc, nhiệt tình và lịch sự.
{context_block}
Khách hàng vừa hỏi một câu hỏi hoặc đưa ra yêu cầu về kiểu dáng, màu sắc, chất liệu áo dài.
Hãy:
1. Phân tích yêu cầu của khách hàng để trích xuất các đặc tính mong muốn (ví dụ: màu đỏ, chất liệu gấm, lụa Hà Đông, thêu phượng, tay lỡ, cổ cao...).
2. Trả lời ngắn gọn, hữu ích và tự nhiên (tối đa 3-4 câu). Xưng là "Mình" và gọi khách là "Bạn".
3. Đối chiếu các đặc tính này với danh sách sản phẩm ở trên. Nếu có sản phẩm nào khớp hoặc tương tự các đặc tính đó, hãy giới thiệu và đề xuất sản phẩm đó.
4. Ở cuối câu trả lời (sau tất cả các câu tư vấn), hãy thêm một dòng định dạng chính xác chứa các ID sản phẩm đề xuất: `[RECOMMENDED_IDS: id1, id2, ...]`. Ví dụ: `[RECOMMENDED_IDS: 6a3115219c5d63a0697e1cbd]`. Nếu không có sản phẩm nào phù hợp, tuyệt đối không thêm dòng này.

Câu hỏi: {question}

Trả lời:"""

        for model_name in ["gemini-2.0-flash", "gemini-3.1-flash-lite"]:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                print(f"[Gemini Fallback Error] Thất bại khi gọi model {model_name}: {e}")

        return "Hiện tại trợ lý AI đang quá tải lượt yêu cầu hoặc gặp sự cố kết nối. Bạn vui lòng thử lại sau giây lát nhé! 😊"

    def call_gemini_with_image(self, question: str, image_base64: str, mime_type: str = "image/jpeg", product_context: str = "") -> str:
        """
        Gọi Gemini multimodal API để phân tích hình ảnh áo dài + đề xuất sản phẩm từ cửa hàng.
        """
        from google import genai
        from google.genai import types
        import base64

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return "Tính năng phân tích hình ảnh chưa được cấu hình. Vui lòng thử lại sau."

        client = genai.Client(api_key=api_key)

        context_block = ""
        if product_context:
            context_block = f"""
Dưới đây là danh sách sản phẩm Áo Dài đang có trong hệ thống cửa hàng:
---
{product_context}
---
"""

        text_prompt = f"""Bạn là chuyên gia tư vấn Áo Dài Việt Nam với con mắt thẩm mỹ tinh tế.
{context_block}
Khách hàng vừa gửi cho bạn một hình ảnh mẫu áo dài{' kèm câu hỏi: ' + question if question else ''}.

Hãy:
1. Phân tích hình ảnh áo dài để trích xuất các đặc tính kiểu dáng, màu sắc, họa tiết, chất liệu.
2. Trả lời ngắn gọn, nhận xét về phom dáng, màu sắc và độ phù hợp vóc dáng/dịp mặc (tối đa 4 câu). Xưng là "Mình", gọi khách là "Bạn".
3. Đối chiếu các đặc tính trích xuất được với danh sách sản phẩm cửa hàng được cung cấp ở trên. Tìm kiếm các sản phẩm tương đồng nhất để đề xuất cho khách.
4. Ở cuối câu trả lời (sau tất cả các câu tư vấn), hãy thêm một dòng định dạng chính xác chứa các ID sản phẩm tương đồng: `[RECOMMENDED_IDS: id1, id2, ...]`. Ví dụ: `[RECOMMENDED_IDS: 6a3115219c5d63a0697e1cbc]`. Nếu không có sản phẩm nào phù hợp, tuyệt đối không thêm dòng này.

Trả lời bằng tiếng Việt."""

        try:
            image_bytes = base64.b64decode(image_base64)
        except Exception as e:
            print(f"[Gemini Image Error] Lỗi decode base64: {e}")
            return "Hình ảnh không hợp lệ. Vui lòng gửi lại ảnh khác nhé!"

        for model_name in ["gemini-2.0-flash", "gemini-3.1-flash-lite"]:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                        types.Part.from_text(text=text_prompt),
                    ]
                )
                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                print(f"[Gemini Image Error] Thất bại khi gọi model {model_name}: {e}")

        return "Hiện tại trợ lý AI đang bận hoặc quá tải cuộc gọi phân tích hình ảnh. Bạn vui lòng thử lại sau giây lát nhé! 😊"

    @staticmethod
    def _preprocess(text: str) -> str:
        """Chuẩn bị text: chữ thường, xóa dấu câu"""
        text = text.lower()
        text = re.sub(r'[^\w\s]', '', text)
        return text.strip()