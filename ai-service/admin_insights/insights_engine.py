import os
import json
import re
import urllib.request
import urllib.error
from typing import Optional, List
from dotenv import load_dotenv
from .schemas import AdminInsightsRequest, AdminInsightsResponse

load_dotenv()


def _generate_rule_based_insights(req: AdminInsightsRequest) -> AdminInsightsResponse:
    """
    Phân tích thông minh quy tắc nội bộ (Domain Heuristic Analysis)
    dựa trên số liệu tổng hợp thực tế từ MongoDB.
    """
    summary = req.summary or {}
    total_reviews = summary.get("totalReviewsAnalyzed", 0)
    avg_platform_rating = summary.get("averagePlatformRating", 5.0)
    high_risk_count = summary.get("highRiskShopsCount", 0)

    # 1. Phân tích shop xấu & rủi ro cao
    bad_shops = [s for s in req.shop_risk_profiles if s.bad_review_count > 0 or s.risk_level in ["HIGH_RISK", "WARNING"]]
    bad_shops.sort(key=lambda s: (s.bad_review_count, -s.average_rating if s.average_rating else 0), reverse=True)

    if bad_shops:
        top_bad = bad_shops[0]
        bad_shops_text = (
            f"Hệ thống phát hiện **{len(bad_shops)} shop** có tín hiệu cảnh báo hoặc đánh giá tiêu cực.\n"
            f"Trong đó, **{top_bad.business_name}** là shop có nhiều đánh giá xấu nhất với **{top_bad.bad_review_count} lượt đánh giá 1-2 sao** "
            f"(chiếm {top_bad.bad_review_percentage:.1f}% tổng đánh giá, điểm TB: {top_bad.average_rating:.1f}/5.0)."
        )
        if top_bad.primary_issues:
            bad_shops_text += f"\n- **Các vấn đề bị phản ánh nhiều nhất:** {', '.join(top_bad.primary_issues)}."
        if top_bad.recent_negative_comments:
            sample = top_bad.recent_negative_comments[0]
            bad_shops_text += f"\n- **Trích dẫn thực tế:** \"{sample.comment}\" *(từ khách {sample.customer_name})*."
        if top_bad.dispute_count > 0:
            bad_shops_text += f"\n- Ngoài ra shop này đã có **{top_bad.dispute_count} khiếu nại (dispute)** cần can thiệp."
    else:
        bad_shops_text = (
            f"Chất lượng dịch vụ toàn sàn đang rất tốt! Không có shop nào rơi vào mức rủi ro cao. "
            f"Điểm đánh giá trung bình toàn sàn đạt **{avg_platform_rating:.1f}/5.0**."
        )

    # 2. Phân tích hành vi tương tác Khách hàng - Shop
    interactions = req.user_shop_interactions
    if interactions:
        top_pair = interactions[0]
        user_behavior_text = (
            f"Ghi nhận **{len(interactions)} cặp Khách hàng - Shop** có tương tác đặt hàng nổi bật.\n"
            f"- **Khách hàng gắn bó nhất:** **{top_pair.customer_name}** ({top_pair.customer_email}) "
            f"đã đặt **{top_pair.total_bookings} đơn** tại **{top_pair.provider_name}**, "
            f"với tổng chi tiêu {top_pair.total_spent:,.0f}đ."
        )
        if top_pair.review_count > 0:
            user_behavior_text += (
                f" Khách đã để lại {top_pair.review_count} đánh giá cho shop (Điểm TB cho: {top_pair.average_rating_given:.1f}/5.0)."
            )
            if top_pair.recent_comment:
                user_behavior_text += f" Phản hồi: \"{top_pair.recent_comment}\"."
        else:
            user_behavior_text += " Khách hàng này chưa để lại đánh giá chính thức (tiềm năng nhắc gửi review)."
    else:
        user_behavior_text = "Chưa có đủ dữ liệu lịch sử đặt hàng để lập bản đồ tương tác khách hàng - shop chi tiết."

    # 3. Tóm tắt điều hành (Executive Summary)
    exec_summary = (
        f"📊 **Báo Cáo Sức Khỏe Vận Hành Toàn Sàn**\n"
        f"- Tổng số lượt đánh giá đã phân tích: **{total_reviews} lượt** (Điểm TB: **{avg_platform_rating:.1f}/5.0**).\n"
        f"- Số lượng nhà cung cấp cần chú ý rủi ro: **{high_risk_count} shop**.\n"
        f"- Xu hướng chung: Đa số khách hàng đánh giá hài lòng với kiểu dáng áo dài cố đô và kỹ năng thợ chụp ảnh. "
        f"Tuy nhiên, các phản ánh tiêu cực tập trung chủ yếu vào khâu hoàn trả cọc và độ chuẩn xác về giờ hẹn."
    )

    # 4. Khuyến nghị hành động (Top Recommendations)
    recommendations = []
    if bad_shops:
        top_bad = bad_shops[0]
        recommendations.append(
            f"Gửi công văn/thông báo cảnh báo chất lượng đến **{top_bad.business_name}** yêu cầu giải trình về các phản hồi tiêu cực."
        )
        recommendations.append(
            "Tạm dừng duyệt thêm các combo ưu đãi của các shop có tỷ lệ đánh giá tiêu cực > 15% cho đến khi cải thiện điểm rating."
        )
    else:
        recommendations.append("Duy trì tiêu chuẩn kiểm duyệt sản phẩm và dịch vụ hiện tại.")

    if interactions:
        recommendations.append(
            f"Tặng voucher tri ân khách hàng thân thiết cho nhóm khách VIP (như {interactions[0].customer_name}) để gia tăng tỷ lệ tái đặt dịch vụ."
        )

    recommendations.append(
        "Thiết lập cơ chế tự động gửi thông báo kiểm tra đơn hàng sau 24h đối với dịch vụ thuê đồ để giảm thiểu rủi ro tranh chấp cọc."
    )

    # 5. Xử lý câu hỏi Copilot (nếu có)
    copilot_ans = None
    if req.question:
        q_lower = req.question.lower()
        if any(w in q_lower for w in ["xấu nhất", "tệ nhất", "kém nhất", "phàn nàn", "bị chê"]):
            if bad_shops:
                copilot_ans = (
                    f"Theo phân tích dữ liệu thực tế, **{bad_shops[0].business_name}** là shop có nhiều đánh giá xấu nhất "
                    f"với **{bad_shops[0].bad_review_count} lượt đánh giá 1-2 sao** (chiếm {bad_shops[0].bad_review_percentage:.1f}%).\n\n"
                    f"**Các nguyên nhân chính:**\n"
                    + "\n".join([f"- {iss}" for iss in (bad_shops[0].primary_issues or ["Chưa phân loại cụ thể"])])
                    + (f"\n\n**Bình luận tiêu biểu của khách:** \"{bad_shops[0].recent_negative_comments[0].comment}\"" if bad_shops[0].recent_negative_comments else "")
                )
            else:
                copilot_ans = "Hiện tại trên hệ thống không ghi nhận shop nào có đánh giá xấu nghiêm trọng. Tất cả các shop đều duy trì điểm đánh giá trên mức trung bình."
        elif any(w in q_lower for w in ["nhiều nhất", "vào shop", "khách nào", "mua nhiều", "gắn bó"]):
            if interactions:
                top = interactions[0]
                copilot_ans = (
                    f"Khách hàng tương tác và đặt hàng nhiều nhất là **{top.customer_name}** ({top.customer_email}) "
                    f"với **{top.total_bookings} đơn đặt** tại **{top.provider_name}**, "
                    f"tổng chi tiêu đạt **{top.total_spent:,.0f}đ**.\n\n"
                    f"- Đánh giá đã để lại: {top.review_count} lượt (Điểm TB: {top.average_rating_given:.1f}/5.0)."
                    + (f"\n- Phản hồi gần nhất: \"{top.recent_comment}\"" if top.recent_comment else "")
                )
            else:
                copilot_ans = "Chưa có đủ dữ liệu đơn hàng hoàn tất để xác định cặp khách hàng - shop nhiều nhất."
        else:
            copilot_ans = (
                f"Dựa trên tổng hợp dữ liệu hệ thống:\n\n"
                f"1. **Về đánh giá & chất lượng:** Điểm TB toàn sàn là {avg_platform_rating:.1f}/5.0 với {total_reviews} đánh giá. "
                f"Có {len(bad_shops)} shop cần theo dõi chất lượng.\n"
                f"2. **Về khách hàng thân thiết:** {interactions[0].customer_name if interactions else 'Khách hàng'} đang là người dùng tích cực nhất.\n"
                f"3. **Khuyến nghị:** {recommendations[0] if recommendations else 'Tiếp tục theo dõi vận hành.'}"
            )

    return AdminInsightsResponse(
        executive_summary=exec_summary,
        bad_shops_analysis=bad_shops_text,
        user_behavior_analysis=user_behavior_text,
        top_recommendations=recommendations,
        copilot_answer=copilot_ans,
        source="domain_heuristic_engine",
    )


async def generate_admin_insights(req: AdminInsightsRequest) -> AdminInsightsResponse:
    """
    Gọi Gemini API để tổng hợp dữ liệu quản trị sắc bén,
    nếu lỗi hoặc không có API key thì chuyển tiếp sang heuristic engine.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return _generate_rule_based_insights(req)

    # Chuẩn bị context dạng tóm tắt
    summary = req.summary or {}
    bad_shops_data = [s.model_dump() for s in req.shop_risk_profiles[:5]]
    interactions_data = [i.model_dump() for i in req.user_shop_interactions[:5]]
    sentiment_data = [c.model_dump() for c in req.sentiment_clusters[:5]]

    prompt = f"""Bạn là Giám Đốc Phân Tích Dữ Liệu & Quản Trị Rủi Ro (Chief Analytics & Risk Officer) của sàn thương mại dịch vụ Áo Dài & Nhiếp Ảnh ATPP.
Nhiệm vụ của bạn là đọc và phân tích số liệu thực tế được kết xuất trực tiếp từ cơ sở dữ liệu hệ thống dưới đây:

DỮ LIỆU TỔNG QUAN:
- Tổng số lượt đánh giá: {summary.get('totalReviewsAnalyzed', 0)}
- Điểm đánh giá trung bình sàn: {summary.get('averagePlatformRating', 5.0):.2f}/5.0
- Số lượng shop rủi ro cao: {summary.get('highRiskShopsCount', 0)}

DANH SÁCH SHOP VÀ PHẢN HỒI ĐÁNH GIÁ (Xếp theo rủi ro / nhiều đánh giá xấu nhất):
{json.dumps(bad_shops_data, ensure_ascii=False, indent=2)}

DANH SÁCH TƯƠNG TÁC KHÁCH HÀNG - SHOP (User - Shop Affinity):
{json.dumps(interactions_data, ensure_ascii=False, indent=2)}

CÁC CHỦ ĐỀ CẢM XÚC & ĐÁNH GIÁ NỔI BẬT:
{json.dumps(sentiment_data, ensure_ascii=False, indent=2)}

CÂU HỎI CỤ THỂ CỦA ADMIN (nếu có):
{req.question or "Không có (Admin muốn bản báo cáo tổng hợp toàn diện)"}

YÊU CẦU ĐẦU RA:
Hãy phân tích sắc bén, khách quan và chuyên nghiệp. Trả về ĐÚNG MỘT JSON với cấu trúc sau:
{{
  "executive_summary": "Đoạn tóm tắt tổng quan sức khỏe dịch vụ trên sàn, số lượng review, điểm số và các tín hiệu cần chú ý (dùng markdown format, bold số liệu).",
  "bad_shops_analysis": "Phân tích rõ shop nào có nhiều đánh giá xấu nhất, tỷ lệ bao nhiêu, nguyên nhân cốt lõi khách phàn nàn là gì (chất lượng áo, thái độ, hay trễ hẹn trả ảnh...).",
  "user_behavior_analysis": "Phân tích chi tiết hành vi khách hàng: Khách hàng nào tương tác và đặt hàng tại shop nào nhiều nhất, tổng chi tiêu, họ đánh giá shop như thế nào.",
  "top_recommendations": [
    "Khuyến nghị hành động cụ thể 1 cho Admin",
    "Khuyến nghị hành động cụ thể 2 cho Admin",
    "Khuyến nghị hành động cụ thể 3 cho Admin"
  ],
  "copilot_answer": "Câu trả lời trực tiếp, rõ ràng cho câu hỏi của Admin nếu có. Nếu không có câu hỏi, tóm tắt 2 ý quan trọng nhất Admin cần nắm hôm nay."
}}
"""

    models_to_try = ["gemini-3.8-flash", "gemini-2.5-flash"]

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        for model_name in models_to_try:
            try:
                sdk_res = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                if sdk_res and sdk_res.text:
                    text_content = sdk_res.text.strip()
                    if text_content.startswith("```"):
                        text_content = re.sub(r"^```(?:json)?\s*", "", text_content)
                        text_content = re.sub(r"\s*```$", "", text_content)
                    parsed = json.loads(text_content)
                    return AdminInsightsResponse(
                        executive_summary=parsed.get("executive_summary", ""),
                        bad_shops_analysis=parsed.get("bad_shops_analysis", ""),
                        user_behavior_analysis=parsed.get("user_behavior_analysis", ""),
                        top_recommendations=parsed.get("top_recommendations", []),
                        copilot_answer=parsed.get("copilot_answer"),
                        source=f"gemini_sdk_{model_name}",
                    )
            except Exception as e:
                print(f"[Gemini Admin Insights SDK {model_name} Error]: {e}")
    except Exception as e:
        print(f"[Gemini Admin Insights Init Error]: {e}")

    # Fallback to rule engine
    return _generate_rule_based_insights(req)

