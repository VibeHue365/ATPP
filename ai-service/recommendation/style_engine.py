class StyleMatchingEngine:

    def build_user_profile(self, preference: dict, bookings: list) -> dict:
        styles = set(preference.get("preferred_styles", []))
        colors = set(preference.get("preferred_colors", []))

        for idx, booking in enumerate(bookings):
            for tag in booking.get("style_tags", []):
                styles.add(tag)

        return {
            "styles":     list(styles),
            "colors":     list(colors),
            "price_range": preference.get("price_range", "medium")
        }

    def score_service(self, profile: dict, service: dict) -> tuple:
        score   = 0.0
        reasons = []

        user_styles = set(profile["styles"])
        user_colors = set(profile["colors"])
        svc_styles  = set(service.get("style_tags", []))
        svc_colors  = set(service.get("color_tags", []))

        # Style match — 40%
        matched_styles = user_styles & svc_styles
        if matched_styles:
            score += (len(matched_styles) / max(len(user_styles), 1)) * 0.4
            reasons.append(f"Phù hợp phong cách: {', '.join(matched_styles)}")

        # Màu sắc — 20%
        matched_colors = user_colors & svc_colors
        if matched_colors:
            score += (len(matched_colors) / max(len(user_colors), 1)) * 0.2
            reasons.append(f"Màu sắc yêu thích: {', '.join(matched_colors)}")

        # Giá — 20%
        if service.get("price_range") == profile["price_range"]:
            score += 0.2
            reasons.append("Phù hợp ngân sách")

        # Rating — 20%
        avg_rating = service.get("avg_rating", 0)
        score += (avg_rating / 5.0) * 0.2
        if avg_rating >= 4.5:
            reasons.append(f"Đánh giá cao: {avg_rating}★")

        return round(score, 4), reasons

    def recommend(self, profile: dict, services: list, top_k: int = 5) -> list:
        scored = []
        for svc in services:
            score, reasons = self.score_service(profile, svc)
            scored.append({
                "service_id":   svc["service_id"],
                "name":         svc["name"],
                "service_type": svc["service_type"],
                "avg_rating":   svc["avg_rating"],
                "match_score":  score,
                "match_percent": f"{int(score * 100)}%",
                "reasons":      reasons
            })

        scored.sort(key=lambda x: x["match_score"], reverse=True)
        return scored[:top_k]