# ai-service/normalization_helpers.py
import re


def normalize_pronouns(text: str) -> str:
    """
    Chuẩn hóa xưng hô thông minh - phân biệt xưng hô bản thân vs từ chào hỏi (salutation) và người nhận
    """
    text = text.lower().strip()
    
    # 1. Loại bỏ các từ chào hỏi / từ đệm giao tiếp gây nhiễu (noise filler words)
    salutation_patterns = [
        r'^\s*(shop|ad|bạn|anh|chị)\s*(ơi|à|ạ|nhi)\b',
        r'\b(dạ|ạ|nha|nhé|ơi|tư vấn giúp|tư vấn hộ|cho hỏi|mình hỏi)\b'
    ]
    cleaned = text
    for pat in salutation_patterns:
        cleaned = re.sub(pat, ' ', cleaned)
        
    # 2. Chuẩn hóa xưng hô bản thân thành 'tôi' (tớ, mình, mềnh, cháu, tui)
    # Tránh thay thế trong các cụm như 'em gái', 'anh trai', 'chị gái'
    pronoun_replacements = {
        r'\b(tớ|mình|mềnh|cháu|tui|ta)\b': 'tôi',
        r'\b(em|tôi)\s+(là|muốn|cần|tìm|thích|đang)\b': r'tôi \2',
    }
    
    result = cleaned
    for pattern, replacement in pronoun_replacements.items():
        result = re.sub(pattern, replacement, result)
    
    # Clean multiple spaces
    result = re.sub(r'\s+', ' ', result).strip()
    return result


def extract_age_and_range(text: str) -> dict:
    """
    Trích xuất tuổi và map vào age_range
    """
    AGE_RANGES = {
        "teenage": (10, 20),
        "young_adult": (20, 30),
        "middle_adult": (30, 40),
        "mature_adult": (40, 50),
        "senior": (50, 120)
    }
    
    age_match = re.search(r'(\d+)\s*(tuổi|age|years?|yo|tuôi|t)', text.lower())
    
    if age_match:
        age_mentioned = int(age_match.group(1))
        
        age_range = "age_unspecified"
        for range_name, (min_age, max_age) in AGE_RANGES.items():
            if min_age <= age_mentioned < max_age:
                age_range = range_name
                break
        
        return {
            "age_mentioned": age_mentioned,
            "age_range": age_range
        }
    
    return {
        "age_mentioned": None,
        "age_range": "age_unspecified"
    }


def extract_gender(text: str) -> str:

    """
    Trích xuất giới tính thông minh - Lọc từ chào hỏi shop (Anh/Chị/Shop ơi) và phân biệt giới tính mục tiêu
    """
    text_lower = text.lower()
    
    # Bỏ qua từ chào hỏi đầu câu (VD: "Anh ơi em muốn mua...", "Chị ơi tư vấn cho em...")
    cleaned_for_gender = re.sub(r'^\s*(anh|chị|shop|ad|bạn)\s*(ơi|à|ạ|nhé)?\b', '', text_lower).strip()
    
    # Các từ khóa khẳng định giới tính NỮ rõ ràng
    female_explicit = [
        "nữ", "con gái", "phụ nữ", "phái đẹp", "nữ giới", "cô dâu",
        "áo dài nữ", "áo dài cho nữ", "cho nữ", "mặc áo dài nữ", "mình là nữ",
        "tôi là nữ", "tớ là nữ", "em là nữ", "em là con gái", "tớ là con gái"
    ]
    
    # Các từ khóa khẳng định giới tính NAM rõ ràng
    male_explicit = [
        "nam", "con trai", "đàn ông", "phái mạnh", "nam giới", "chú rể",
        "áo dài nam", "áo dài cho nam", "cho nam", "mặc áo dài nam", "mình là nam",
        "tôi là nam", "tớ là nam", "em là nam", "em là con trai", "tớ là con trai"
    ]
    
    has_female = any(re.search(r'\b' + re.escape(kw) + r'\b', cleaned_for_gender) for kw in female_explicit)
    has_male = any(re.search(r'\b' + re.escape(kw) + r'\b', cleaned_for_gender) for kw in male_explicit)
    
    if has_female and not has_male:
        return "female"
    elif has_male and not has_female:
        return "male"
    
    # Kiểm tra ngữ cảnh từ xưng hô khi không có từ ngữ khẳng định trực tiếp
    if "em gái" in text_lower or "chị" in cleaned_for_gender or "cô" in cleaned_for_gender:
        return "female"
    if "em trai" in text_lower or "anh" in cleaned_for_gender or "cậu" in cleaned_for_gender:
        return "male"
        
    return "unknown"



def extract_occasion(text: str) -> str:
    """
    Trích xuất dịp từ câu hỏi
    """
    text_lower = text.lower()
    
    occasion_map = {
        "wedding": ["đám cưới", "cưới", "hôn lễ", "lễ cưới"],
        "photoshoot": ["chụp ảnh", "photoshoot", "photo", "concept", "chụp", "ảnh cưới"],
        "daily": ["hàng ngày", "đi chơi", "casual", "thường ngày"],
        "event": ["sự kiện", "lễ hội", "tiệc", "event"],
    }
    
    for occasion, keywords in occasion_map.items():
        if any(kw in text_lower for kw in keywords):
            return occasion
    
    return "general"


def extract_intent(text: str) -> str:
    """Nhận diện ý định của câu hỏi"""
    text_lower = text.lower()
    
    size_keywords = ["size", "kích thước", "cỡ", "vừa không", "form"]
    if any(kw in text_lower for kw in size_keywords):
        return "size_fit"
    
    style_keywords = ["style", "phong cách", "kiểu", "dáng", "cổ nào", "tay nào", "tà nào"]
    if any(kw in text_lower for kw in style_keywords):
        return "style_advice"
    
    rec_keywords = [
        "đề xuất", "gợi ý", "tư vấn", "bộ nào", "mẫu nào", "chọn bộ", 
        "phù hợp", "hợp với", "mặc được", "nên mua", "nên chọn",
        "muốn mua", "muốn chọn", "muốn chụp",
        "có bộ nào", "bộ nào tốt", "bộ nào đẹp"
    ]
    if any(kw in text_lower for kw in rec_keywords):
        return "recommendation"
    
    return "general_qa"


def extract_height(text: str) -> int:
    """
    Trích xuất chiều cao từ text (cm)
    
    Patterns: "1m8", "1m80", "180cm", "180 cm"
    
    Returns: chiều cao (cm) hoặc None nếu không tìm thấy
    """
    text_lower = text.lower()
    
    # Pattern: 1m80, 1m8, 1m7
    pattern1 = r'(\d)m(\d+)'
    match = re.search(pattern1, text_lower)
    if match:
        m = int(match.group(1))
        cm_digits = match.group(2)
        # 1m8 → 180, 1m80 → 180, 1m75 → 175
        if len(cm_digits) == 1:
            return m * 100 + int(cm_digits) * 10
        else:
            return m * 100 + int(cm_digits[:2])
    
    # Pattern: 180cm, 180 cm
    pattern2 = r'(\d{2,3})\s*cm'
    match = re.search(pattern2, text_lower)
    if match:
        return int(match.group(1))
    
    return None


def map_height_to_range(height_cm: int) -> str:
    """
    Map chiều cao (cm) sang height range
    
    Returns: "tall" / "medium" / "short" / "universal"
    """
    if height_cm is None:
        return "universal"
    
    if height_cm >= 175:
        return "tall"
    elif height_cm >= 160:
        return "medium"
    else:
        return "short"


def extract_skin_tone(text: str) -> str:
    """
    Trích xuất màu da từ text
    
    Returns: "fair" / "medium" / "dark" / "universal"
    """
    text_lower = text.lower()
    
    fair_keywords = ["da sáng", "da trắng", "da phát sáng", "da hồng", "fair", "pale"]
    medium_keywords = ["da nâu", "da vàng", "da ngăm", "medium", "tan"]
    dark_keywords = ["da đen", "da sẫm", "da tối", "da sẫm", "dark", "olive"]
    
    if any(kw in text_lower for kw in fair_keywords):
        return "fair"
    elif any(kw in text_lower for kw in dark_keywords):
        return "dark"
    elif any(kw in text_lower for kw in medium_keywords):
        return "medium"
    
    return "universal"


def extract_hairstyle(text: str) -> str:
    """
    Trích xuất kiểu tóc từ text
    
    Returns: "long_hair" / "short_hair" / "curly_hair" / "universal"
    """
    text_lower = text.lower()
    
    long_keywords = ["tóc dài", "long hair", "mái dài", "tóc xõa"]
    short_keywords = ["tóc ngắn", "short hair", "tóc bob", "tóc pixie"]
    curly_keywords = ["tóc xoăn", "tóc uốn", "curly", "wavy"]
    
    if any(kw in text_lower for kw in curly_keywords):
        return "curly_hair"
    elif any(kw in text_lower for kw in long_keywords):
        return "long_hair"
    elif any(kw in text_lower for kw in short_keywords):
        return "short_hair"
    
    return "universal"


def get_sizing_advice(height_range: str) -> dict:
    """
    Trả về lời khuyên sizing dựa trên height_range
    """
    advice_map = {
        "tall": {
            "length": "Chiều dài tà nên tới mắt cá chân để cân đối vóc dáng cao",
            "sleeve": "Tay áo có thể dài tới cổ tay, không nên quá ngắn",
            "collar": "Cổ cao (cổ thuyền) tạo cân đối và tỉ lệ tốt"
        },
        "medium": {
            "length": "Chiều dài tà tới gót chân là lý tưởng nhất",
            "sleeve": "Tay áo lửng (dưới cồi) vừa vặn, cân đối",
            "collar": "Cổ tròn hoặc cổ thuyền đều phù hợp rất tốt"
        },
        "short": {
            "length": "Chiều dài tà hơi ngắn để tránh kéo xuống, che phủ quá",
            "sleeve": "Tay áo nên hạn chế dài quá để tránh làm ngắn cánh tay",
            "collar": "Cổ cao hoặc cổ yếm tạo chiều dọc, giúp kéo dài vóc dáng"
        },
        "universal": {
            "length": "Chiều dài tà tới gót chân hoặc mắt cá chân",
            "sleeve": "Tay áo lửng hoặc dài tới cổ tay đều phù hợp",
            "collar": "Bất kỳ kiểu cổ nào đều có thể chọn tùy sở thích"
        }
    }
    
    return advice_map.get(height_range, advice_map["universal"])


def get_skin_tone_color_advice(skin_tone: str) -> dict:
    """
    Trả về lời khuyên màu áo dài dựa trên màu da
    """
    advice_map = {
        "fair": {
            "matching": "Trắng, nude, pastel (hồng nhạt, xanh nhạt), vàng nhạt, tím nhạt",
            "avoid": "Nên tránh màu quá đậm hoặc quá sáng làm lấp lửng da"
        },
        "medium": {
            "matching": "Gần như mọi màu đều phù hợp: trắng, be, xanh, đỏ, vàng, cam",
            "avoid": "Không có màu nào là không phù hợp, tùy theo thị hiếu và dịp"
        },
        "dark": {
            "matching": "Xanh đậm, đỏ đậm, vàng đậm, nâu, vàng vàng, cam đậm",
            "avoid": "Nên tránh màu quá nhạt hoặc quá trơ sẽ làm toát sáng da"
        },
        "universal": {
            "matching": "Hầu hết các màu đều có thể phù hợp tùy theo thị hiếu cá nhân",
            "avoid": "Chọn màu dựa trên tính cách và ưa thích của bản thân"
        }
    }
    
    return advice_map.get(skin_tone, advice_map["universal"])


def create_normalized_doc(question: str, answer: str, source: str = "kaggle", sizing_advice: dict = None, color_advice: dict = None) -> dict:
    """
    Tạo document đã normalize để insert vào MongoDB
    
    Gộp tất cả các normalization: age, gender, height, skin_tone, hairstyle
    """
    
    # Normalize pronouns
    question_normalized = normalize_pronouns(question)
    
    # Extract age, gender, occasion, intent
    age_info = extract_age_and_range(question)
    occasion = extract_occasion(question)
    gender = extract_gender(question)
    intent = extract_intent(question)
    
    # Extract body metrics (NEW)
    height_cm = extract_height(question)
    height_range = map_height_to_range(height_cm)
    skin_tone = extract_skin_tone(question)
    hairstyle = extract_hairstyle(question)
    
    # Get default sizing advice nếu không pass vào
    if sizing_advice is None:
        sizing_advice = get_sizing_advice(height_range)
    
    if color_advice is None:
        color_advice = get_skin_tone_color_advice(skin_tone)
    
    # Tính toán các flags
    has_personal_metrics = (
        age_info["age_mentioned"] is not None or
        height_cm is not None or
        skin_tone != "universal"
    )
    is_recommendation_intent = intent == "recommendation"
    
    # Generate keywords từ question
    keywords = []
    if gender != "unknown":
        keywords.append(gender)
    if age_info["age_mentioned"]:
        keywords.append(f"{age_info['age_mentioned']} tuổi")
    if height_cm:
        keywords.append(f"{height_cm}cm")
    if occasion != "general":
        keywords.append(occasion)
    if skin_tone != "universal":
        keywords.append(f"da {skin_tone}")
    if hairstyle != "universal":
        keywords.append(hairstyle)
    
    # Tạo category
    if "cổ" in question.lower():
        category = "collar"
    elif "tay" in question.lower():
        category = "sleeve"
    elif "tà" in question.lower():
        category = "tail"
    elif "vải" in question.lower() or "chất liệu" in question.lower():
        category = "fabric"
    elif gender != "unknown":
        category = "gender"
    elif intent == "size_fit":
        category = "size_fit"
    else:
        category = "general"
    
    # Detect service type
    service_type = "all"
    if any(kw in question.lower() for kw in ["chụp", "ảnh", "thợ", "photo", "studio", "concept"]):
        service_type = "photographer"
    elif any(kw in question.lower() for kw in ["áo", "dài", "thuê", "mặc", "vải", "gấm", "lụa"]):
        service_type = "ao_dai"

    # Tạo document chuẩn hóa nâng cao
    document = {
        "question_original": question.strip(),
        "question_normalized": question_normalized,
        "question_variations": [question.strip(), question_normalized],
        "answer": answer.strip(),
        
        # Age & Body metrics
        "age_mentioned": age_info["age_mentioned"],
        "age_range": age_info["age_range"],
        "height_cm": height_cm,
        "height_range": height_range,
        "skin_tone": skin_tone,
        "hairstyle": hairstyle,
        
        # Domain Metadata
        "service_type": service_type,
        "gender": gender,
        "occasion": occasion,
        "intent": intent,
        "category": category,
        "keywords": keywords,
        
        # Trust & Quality Governance
        "priority_score": 100 if source == "manual" else 65,
        "status": "ACTIVE",
        "action_link": "/booking" if is_recommendation_intent else None,
        
        # Personalized advice
        "sizing_advice": sizing_advice,
        "color_advice": color_advice,
        
        # Flags & Tracking
        "has_personal_metrics": has_personal_metrics,
        "is_recommendation_intent": is_recommendation_intent,
        "source": source,
    }
    
    return document



# ===== TEST =====
if __name__ == "__main__":
    test_questions = [
        "mình là con gái 25 tuổi cao 1m65 da sáng muốn mua áo dài cho đám cưới",
        "em là con trai 30 tuổi cao 1m80 da đen tóc ngắn, bộ áo dài nào phù hợp",
        "con gái muốn mua áo dài",
        "tôi cao 1m7 muốn tư vấn về size áo dài"
    ]
    
    for q in test_questions:
        print(f"\n{'='*70}")
        print(f"Question: {q}")
        print(f"Normalized: {normalize_pronouns(q)}")
        print(f"Age: {extract_age_and_range(q)}")
        print(f"Gender: {extract_gender(q)}")
        print(f"Height: {extract_height(q)}cm → {map_height_to_range(extract_height(q))}")
        print(f"Skin tone: {extract_skin_tone(q)}")
        print(f"Hairstyle: {extract_hairstyle(q)}")
        print(f"Occasion: {extract_occasion(q)}")
        print(f"Intent: {extract_intent(q)}")