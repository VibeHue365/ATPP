import os
import json
import re
import urllib.request
import urllib.error
from typing import Optional
from dotenv import load_dotenv
from .schemas import ComboSuggestionRequest, ComboSuggestionResponse

load_dotenv()


def _generate_rule_based_combo(req: ComboSuggestionRequest) -> ComboSuggestionResponse:
    """
    Thông minh dự phòng (Domain-specific heuristic fallback)
    dành riêng cho ngành áo dài và nhiếp ảnh Việt Nam khi chưa có API key hoặc mất mạng.
    """
    prod_name = req.product.name or "Áo dài truyền thống"
    prod_desc = req.product.description or ""
    pkg_name = req.photography_package.name or "Gói chụp ảnh nghệ thuật"
    pkg_desc = req.photography_package.description or ""
    vibe = req.vibe or "Tự động phân tích"

    # Giá
    ao_dai_price = float(req.product.basePrice or 0)
    pkg_price = float(req.photography_package.price or 0)
    total_original = ao_dai_price + pkg_price
    
    # Tính chiết khấu đề xuất (15%)
    discount_pct = 15
    suggested_price = int(total_original * (1 - discount_pct / 100))
    # Làm tròn tới hàng chục nghìn
    suggested_price = round(suggested_price / 10000) * 10000

    # Phân tích concept từ từ khóa
    text_corpus = f"{prod_name} {prod_desc} {pkg_name} {pkg_desc} {vibe}".lower()

    if any(k in text_corpus for k in ["tết", "xuân", "hoa đào", "mai"]):
        concept_theme = "Sắc Xuân Hoan Hỉ - Tết Cổ Truyền"
        name = f"Combo Đón Tết An Khang - {prod_name} & {pkg_name}"
        desc = (
            f"Trọn gói du xuân với {prod_name} rạng ngời kết hợp cùng {pkg_name}. "
            "Lưu giữ khoảnh khắc sum vầy, tươi vui đầu năm với tone màu ấm áp và góc máy chuyên nghiệp."
        )
        locations = ["Chợ Hoa Xuân", "Phố Cổ / Cầu Trường Tiền", "Chùa Cổ / Đình Làng"]
        styling = ["Cành đào / mai cầm tay", "Bao lì xì đỏ may mắn", "Guốc mộc truyền thống"]
        audience = "Gia đình, bạn trẻ muốn lưu giữ ảnh Tết trọn vẹn"

    elif any(k in text_corpus for k in ["cố đô", "hoàng cung", "đại nội", "cổ điển", "nhung", "gấm", "quý phái", "sang trọng"]):
        concept_theme = "Dấu Ấn Hoàng Cung - Cổ Điển Quý Phái"
        name = f"Combo Cố Đô Nghệ Thuật - {prod_name} & {pkg_name}"
        desc = (
            f"Trải nghiệm hóa thân tuyệt mỹ với {prod_name} sang trọng và {pkg_name}. "
            "Bắt trọn nét thâm trầm, đài các của kinh kỳ qua từng khung hình giàu chất thơ."
        )
        locations = ["Đại Nội Huế / Hoàng Thành", "Lăng Khải Định / Tự Đức", "Cầu Trường Tiền lúc hoàng hôn"]
        styling = ["Quạt trầm hương / Quạt lụa thêu tay", "Vấn tóc cổ điển / Mấn đính ngọc", "Trang sức ngọc trai thanh lịch"]
        audience = "Nữ giới yêu nét đẹp hoài cổ, du khách check-in cố đô"

    elif any(k in text_corpus for k in ["sen", "hồ sen", "mùa hạ", "thôn dã"]):
        concept_theme = "Hương Sắc Hồ Sen - Dáng Ngọc Duyên Dáng"
        name = f"Combo Hương Sen Đầu Mùa - {prod_name} & {pkg_name}"
        desc = (
            f"Hòa mình vào thiên nhiên thanh thuần với {prod_name} thướt tha và {pkg_name}. "
            "Tôn vinh vẻ đẹp thuần khiết, dịu dàng của người phụ nữ Việt bên đóa sen ngát hương."
        )
        locations = ["Đầm sen Tịnh Tâm", "Hồ sen ngoại ô", "Bờ sông Hương sớm mai"]
        styling = ["Bó sen tươi cầm tay", "Nón lá bài thơ mộc mạc", "Trang điểm trong trẻo tone hồng phấn"]
        audience = "Các nàng thơ yêu thích phong cách dịu dàng, trong trẻo"

    elif any(k in text_corpus for k in ["kỷ yếu", "học sinh", "sinh viên", "thanh xuân", "trắng"]):
        concept_theme = "Thanh Xuân Nắng Hạ - Kỷ Niệm Tinh Khôi"
        name = f"Combo Kỷ Niệm Thanh Xuân - {prod_name} & {pkg_name}"
        desc = (
            f"Lưu giữ những tháng năm đẹp nhất cùng {prod_name} tinh khôi và {pkg_name}. "
            "Từng góc chụp tự nhiên, bắt trọn nụ cười rạng rỡ và sự hồn nhiên tuổi trẻ."
        )
        locations = ["Trường Quốc Học Huế", "Con đường rợp bóng cây", "Cầu đi bộ gỗ lim"]
        styling = ["Cặp sách da vintage", "Bó hoa baby / cúc họa mi", "Tóc buông tự nhiên"]
        audience = "Học sinh, sinh viên, hội bạn thân chụp ảnh kỷ yếu"

    else:
        concept_theme = "Nàng Thơ Dạo Phố - Thanh Lịch Hiện Đại"
        name = f"Combo Nàng Thơ Trọn Gói - {prod_name} & {pkg_name}"
        desc = (
            f"Gói dịch vụ hoàn hảo kết hợp {prod_name} tôn dáng và {pkg_name} tận tâm. "
            "Mang đến bộ ảnh kỷ niệm nghệ thuật, vừa tôn nét duyên truyền thống vừa hiện đại."
        )
        locations = ["Phố Cổ", "Không gian cafe Indochine", "Cảnh sắc thiên nhiên thơ mộng"]
        styling = ["Nón lá / Quạt lụa", "Khuyên tai bạc nhẹ nhàng", "Makeup tự nhiên tôn da"]
        audience = "Khách hàng muốn có bộ ảnh kỷ niệm đẹp, nhanh chóng, trọn gói"

    # Cắt gọn mô tả nếu vượt quá 280 ký tự để vừa form
    if len(desc) > 280:
        desc = desc[:277] + "..."

    return ComboSuggestionResponse(
        name=name[:100],
        description=desc,
        suggested_discount_percent=discount_pct,
        suggested_price=suggested_price,
        suggested_shoot_people_count=req.photography_package.maxPeople or 1,
        suggested_aodai_quantity=1,
        concept_theme=concept_theme,
        target_audience=audience,
        ideal_locations=locations,
        styling_tips=styling,
        marketing_highlights=[
            f"Tiết kiệm ngay {discount_pct}% so với thuê lẻ từng dịch vụ",
            "Đồng bộ trang phục và góc máy cùng một phong cách nghệ thuật",
            "Được hỗ trợ tạo dáng và tư vấn phụ kiện chu đáo suốt buổi chụp"
        ],
        source="rule_engine"
    )


async def suggest_combo(req: ComboSuggestionRequest) -> ComboSuggestionResponse:
    """
    Gọi Gemini API để sinh gợi ý combo cao cấp,
    nếu lỗi hoặc không có API key thì chuyển tiếp sang rule-based fallback.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return _generate_rule_based_combo(req)

    # Chuẩn bị context cho Gemini
    p = req.product
    pkg = req.photography_package
    vibe = req.vibe or "Tự động phân tích phù hợp nhất"
    notes = req.notes or "Không có"

    prod_price_str = f"{p.basePrice:,.0f}đ" if p.basePrice else "Chưa rõ"
    pkg_price_str = f"{pkg.price:,.0f}đ" if pkg.price else "Chưa rõ"
    materials_str = ", ".join(p.materials) if p.materials else "N/A"
    colors_str = ", ".join(p.colors) if p.colors else "N/A"
    deliverables_str = ", ".join(pkg.deliverables) if pkg.deliverables else "Toàn bộ file gốc + ảnh chỉnh sửa"

    prompt = f"""Bạn là một Giám Đốc Nghệ Thuật (Art Director) và Chuyên Gia Định Vị Thương Hiệu hàng đầu trong ngành Áo Dài và Nhiếp Ảnh Cố Đô Việt Nam.
Một nhà cung cấp (vừa là thợ chụp ảnh vừa cho thuê áo dài) muốn đóng gói sản phẩm Áo Dài và Gói Chụp Ảnh của họ thành một COMBO TRỌN GÓI hấp dẫn nhất.

Thông tin Áo Dài:
- Tên: {p.name}
- Chất liệu: {materials_str}
- Màu sắc: {colors_str}
- Giá thuê lẻ: {prod_price_str}
- Mô tả: {p.description or 'N/A'}

Thông tin Gói Chụp Ảnh:
- Tên: {pkg.name}
- Thời lượng: {pkg.durationMinutes} phút
- Số người chụp tối đa: {pkg.maxPeople or 1} người
- Địa điểm: {pkg.locationType or 'Ngoại cảnh / Cố đô'}
- Sản phẩm bàn giao: {deliverables_str}
- Giá chụp lẻ: {pkg_price_str}
- Mô tả: {pkg.description or 'N/A'}

Yêu cầu định hướng:
- Phong cách mong muốn (Vibe): {vibe}
- Ghi chú thêm từ thợ: {notes}

Nhiệm vụ của bạn:
Hãy tạo ra một combo hoàn chỉnh, cuốn hút, kích thích khách hàng đặt ngay.
Trả về dữ liệu dưới dạng ĐÚNG MỘT ĐỐI TƯỢNG JSON (không kèm markdown ```json bọc ngoài, hoặc bọc ngoài bằng ```json hợp lệ) với cấu trúc các trường sau:

{{
  "name": "Tên combo thật kêu, giàu chất thơ và nghệ thuật (tối đa 80 ký tự, ví dụ: 'Combo Nàng Thơ Cố Đô - Áo Dài Tơ Tằm & Bộ Ảnh Nghệ Thuật')",
  "description": "Đoạn mô tả ngắn gọn, súc tích (dưới 280 ký tự) nêu bật quyền lợi trọn gói, concept và trải nghiệm đặc sắc để khách cảm thấy rất hời và yên tâm",
  "suggested_discount_percent": 15, // Số nguyên từ 10 đến 25 (mức giảm giá kích thích mua cả 2)
  "concept_theme": "Tên chủ đề concept ngắn gọn (ví dụ: 'Nàng Thơ Hoàng Thành', 'Sắc Xuân Cổ Truyền', 'Dáng Xưa Cố Đô')",
  "target_audience": "Đối tượng khách hàng mục tiêu phù hợp nhất",
  "ideal_locations": ["Địa điểm 1 lý tưởng", "Địa điểm 2 lý tưởng", "Địa điểm 3 lý tưởng"],
  "styling_tips": ["Gợi ý phụ kiện 1 (nón bài thơ, quạt trầm...)", "Gợi ý tone makeup / làm tóc 2", "Gợi ý tạo dáng 3"],
  "marketing_highlights": [
    "Điểm nhấn marketing 1",
    "Điểm nhấn marketing 2",
    "Điểm nhấn marketing 3"
  ]
}}
"""

    models_to_try = [
        "gemini-2.0-flash",
        "gemini-2.5-flash",
        "gemini-1.5-flash",
    ]

    total_original = float(p.basePrice or 0) + float(pkg.price or 0)

    # 1. Thử gọi qua Google GenAI SDK (mới nhất)
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        for model_name in ["gemini-3.8-flash", "gemini-2.5-flash"]:
            try:
                sdk_res = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                if sdk_res and sdk_res.text:
                    text_content = sdk_res.text.strip()
                    if text_content.startswith("```"):
                        text_content = re.sub(r"^```(?:json)?\s*", "", text_content)
                        text_content = re.sub(r"\s*```$", "", text_content)

                    parsed = json.loads(text_content)
                    discount_pct = int(parsed.get("suggested_discount_percent", 15))
                    if discount_pct < 5 or discount_pct > 50:
                        discount_pct = 15

                    suggested_price = int(total_original * (1 - discount_pct / 100))
                    suggested_price = round(suggested_price / 10000) * 10000

                    return ComboSuggestionResponse(
                        name=str(parsed.get("name", f"Combo {p.name} & {pkg.name}"))[:100],
                        description=str(parsed.get("description", ""))[:295],
                        suggested_discount_percent=discount_pct,
                        suggested_price=suggested_price,
                        suggested_shoot_people_count=pkg.maxPeople or 1,
                        suggested_aodai_quantity=1,
                        concept_theme=str(parsed.get("concept_theme", "Nghệ thuật & Tinh hoa Áo Dài")),
                        target_audience=str(parsed.get("target_audience", "Khách hàng yêu thích áo dài")),
                        ideal_locations=list(parsed.get("ideal_locations", ["Đại Nội Huế", "Cầu Trường Tiền"])),
                        styling_tips=list(parsed.get("styling_tips", ["Nón bài thơ", "Quạt lụa", "Makeup nhẹ nhàng"])),
                        marketing_highlights=list(parsed.get("marketing_highlights", [
                            f"Tiết kiệm {discount_pct}% so với đặt lẻ",
                            "Được tư vấn concept và dáng chụp riêng",
                            "Trọn gói không phát sinh chi phí"
                        ])),
                        source=f"gemini_sdk_{model_name}"
                    )
            except Exception as e:
                print(f"[Gemini SDK {model_name} Error]: {e}")
    except Exception as e:
        print(f"[Gemini SDK Init Error]: {e}")

    # 2. Thử gọi qua REST HTTP
    models_to_try = [
        "gemini-3.8-flash",
        "gemini-2.5-flash",
    ]

    for model_name in models_to_try:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            payload = {
                "contents": [
                    {
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.7,
                    "responseMimeType": "application/json"
                }
            }

            req_data = json.dumps(payload).encode("utf-8")
            request = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            with urllib.request.urlopen(request, timeout=12) as response:
                res_body = response.read().decode("utf-8")
                res_json = json.loads(res_body)

                candidates = res_json.get("candidates", [])
                if not candidates:
                    continue

                part = candidates[0].get("content", {}).get("parts", [{}])[0]
                text_content = part.get("text", "").strip()

                # Clean markdown blocks if present
                if text_content.startswith("```"):
                    text_content = re.sub(r"^```(?:json)?\s*", "", text_content)
                    text_content = re.sub(r"\s*```$", "", text_content)

                parsed = json.loads(text_content)

                discount_pct = int(parsed.get("suggested_discount_percent", 15))
                if discount_pct < 5 or discount_pct > 50:
                    discount_pct = 15

                suggested_price = int(total_original * (1 - discount_pct / 100))
                suggested_price = round(suggested_price / 10000) * 10000

                return ComboSuggestionResponse(
                    name=str(parsed.get("name", f"Combo {p.name} & {pkg.name}"))[:100],
                    description=str(parsed.get("description", ""))[:295],
                    suggested_discount_percent=discount_pct,
                    suggested_price=suggested_price,
                    suggested_shoot_people_count=pkg.maxPeople or 1,
                    suggested_aodai_quantity=1,
                    concept_theme=str(parsed.get("concept_theme", "Nghệ thuật & Tinh hoa Áo Dài")),
                    target_audience=str(parsed.get("target_audience", "Khách hàng yêu thích áo dài")),
                    ideal_locations=list(parsed.get("ideal_locations", ["Đại Nội Huế", "Cầu Trường Tiền"])),
                    styling_tips=list(parsed.get("styling_tips", ["Nón bài thơ", "Quạt lụa", "Makeup nhẹ nhàng"])),
                    marketing_highlights=list(parsed.get("marketing_highlights", [
                        f"Tiết kiệm {discount_pct}% so với đặt lẻ",
                        "Được tư vấn concept và dáng chụp riêng",
                        "Trọn gói không phát sinh chi phí"
                    ])),
                    source=f"gemini_rest_{model_name}"
                )
        except Exception as e:
            print(f"[Gemini REST {model_name} Error]: {e}")
            continue

    # 3. Fallback sang domain heuristic engine
    return _generate_rule_based_combo(req)
