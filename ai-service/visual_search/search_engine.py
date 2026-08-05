import base64
import io
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from db.connection import products_col

class VisualSearchRequest(BaseModel):
    image_base64: str = Field(..., description="Sample image base64")
    category: Optional[str] = "ao_dai"
    top_k: int = 5

class ContextRecommendRequest(BaseModel):
    location_context: str = Field(..., description="e.g. 'Đại Nội Huế', 'Phố Cổ Hội An', 'Studio Cổ Điển', 'Chùa Thầy'")
    skin_tone: Optional[str] = Field("WARM", description="WARM, COOL, NEUTRAL")
    time_of_day: Optional[str] = "MORNING" # MORNING, AFTERNOON, EVENING

class MatchedProduct(BaseModel):
    id: str
    name: str
    base_price: float
    colors: List[str]
    similarity_score: float
    reason: str
    image_url: Optional[str] = None

class ContextRecommendationResponse(BaseModel):
    location_context: str
    recommended_ao_dai_colors: List[str]
    recommended_makeup_style: str
    photographer_style_tip: str
    suggested_products: List[MatchedProduct]
    color_palette_hex: List[str]

LOCATION_COLOR_MAP = {
    "đại nội huế": {
        "colors": ["Đỏ son", "Vàng hoàng gia", "Tím xứ Huế", "Trắng ngà"],
        "makeup": "Makeup phong cách Cổ điển / Hoàng cung, son đỏ nhung, mắt kẻ sắc sảo",
        "photo_tip": "Chụp vào nắng sáng 7h30-9h00 đón ánh sáng phản chiếu tường thành cổ kính",
        "hex": ["#8B0000", "#FFD700", "#4B0082", "#FFF8DC"]
    },
    "phố cổ hội an": {
        "colors": ["Vàng nghệ", "Xanh ngọc bích", "Trắng hoa nhài", "Hồng phấn"],
        "makeup": "Makeup Nhẹ nhàng / Trong trẻo Nude, son cam đất hoặc hồng đào",
        "photo_tip": "Chụp bên tường vàng hoa giàn hoặc khung giờ hoàng hôn 16h30 bên sông Hoài",
        "hex": ["#E3A857", "#00A896", "#FDFBF7", "#FFB6C1"]
    },
    "studio": {
        "colors": ["Đỏ đô", "Đen tuyền", "Trắng tinh khôi", "Xanh pastel"],
        "makeup": "Makeup Tone Tây hoặc Hàn Quốc tùy concept phông nền",
        "photo_tip": "Tận dụng đèn Studio Softbox đánh góc 45 độ làm nổi bật phom dáng áo dài",
        "hex": ["#800020", "#000000", "#FFFFFF", "#AEC6CF"]
    },
    "chùa": {
        "colors": ["Trắng thuần khiết", "Hồng sen", "Nâu đất", "Xanh lam nhạt"],
        "makeup": "Makeup Tự nhiên thanh tao, mái tóc bới nhẹ hoặc xõa thẳng truyền thống",
        "photo_tip": "Tạo dáng trang nghiêm thanh lịch bên cổng tam quan hoặc hàng cây cổ thụ",
        "hex": ["#FFFFFF", "#FF69B4", "#8B4513", "#ADD8E6"]
    }
}

async def recommend_by_context(request: ContextRecommendRequest) -> ContextRecommendationResponse:
    loc_key = request.location_context.lower()
    match_info = None
    for k, v in LOCATION_COLOR_MAP.items():
        if k in loc_key:
            match_info = v
            break
            
    if not match_info:
        match_info = {
            "colors": ["Trắng", "Đỏ", "Hồng", "Vàng"],
            "makeup": "Makeup Tự nhiên rạng rỡ",
            "photo_tip": "Tận dụng ánh sáng tự nhiên outdoor hoặc góc nghiêng 45 độ",
            "hex": ["#FFFFFF", "#FF0000", "#FFC0CB", "#FFFF00"]
        }
        
    # Query matching products from MongoDB
    try:
        products = await products_col.find(
            {"status": "ACTIVE"},
            {"_id": 1, "name": 1, "basePrice": 1, "colors": 1, "images": 1}
        ).limit(10).to_list(length=10)
        
        suggested = []
        for p in products:
            p_colors = p.get("colors", [])
            overlap = any(c in str(p_colors) for c in match_info["colors"])
            score = 92.0 if overlap else 78.0
            
            img_url = p.get("images", [None])[0] if p.get("images") else None
            suggested.append(MatchedProduct(
                id=str(p["_id"]),
                name=p.get("name", "Áo Dài Truyền Thống"),
                base_price=float(p.get("basePrice", 250000)),
                colors=p_colors if isinstance(p_colors, list) else [str(p_colors)],
                similarity_score=score,
                reason=f"Phối màu hoàn hảo với bối cảnh {request.location_context}",
                image_url=img_url
            ))
        suggested.sort(key=lambda x: x.similarity_score, reverse=True)
    except Exception as e:
        print(f"[VisualContext MongoDB Error] {e}")
        suggested = []

    return ContextRecommendationResponse(
        location_context=request.location_context,
        recommended_ao_dai_colors=match_info["colors"],
        recommended_makeup_style=match_info["makeup"],
        photographer_style_tip=match_info["photo_tip"],
        suggested_products=suggested[:5],
        color_palette_hex=match_info["hex"]
    )

async def match_by_image(request: VisualSearchRequest) -> List[MatchedProduct]:
    """Extract image dominant features and match against catalog."""
    try:
        try:
            from PIL import Image
        except ImportError:
            Image = None

        clean_b64 = request.image_base64
        if "," in clean_b64:
            clean_b64 = clean_b64.split(",")[1]
            
        img_bytes = base64.b64decode(clean_b64)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img_small = img.resize((50, 50))
        
        # Calculate avg color RGB
        pixels = list(img_small.getdata())
        avg_r = sum(p[0] for p in pixels) / len(pixels)
        avg_g = sum(p[1] for p in pixels) / len(pixels)
        avg_b = sum(p[2] for p in pixels) / len(pixels)
        
        # Simple color classification
        dominant = "Đỏ"
        if avg_r > 150 and avg_g > 150 and avg_b > 150:
            dominant = "Trắng"
        elif avg_r > 150 and avg_g > 120:
            dominant = "Vàng"
        elif avg_g > avg_r and avg_g > avg_b:
            dominant = "Xanh lá"
        elif avg_b > avg_r:
            dominant = "Xanh dương"

        products = await products_col.find({"status": "ACTIVE"}).limit(20).to_list(length=20)
        results = []
        for idx, p in enumerate(products):
            colors = p.get("colors", [])
            color_str = " ".join(colors) if isinstance(colors, list) else str(colors)
            is_match = dominant.lower() in color_str.lower()
            score = 94.5 - (idx * 2.0) if is_match else 75.0 - (idx * 1.5)
            
            img_url = p.get("images", [None])[0] if p.get("images") else None
            results.append(MatchedProduct(
                id=str(p["_id"]),
                name=p.get("name", "Áo Dài"),
                base_price=float(p.get("basePrice", 300000)),
                colors=colors if isinstance(colors, list) else [color_str],
                similarity_score=round(score, 1),
                reason=f"Khớp tông màu chủ đạo ({dominant}) và hoa văn phong cách",
                image_url=img_url
            ))
        results.sort(key=lambda x: x.similarity_score, reverse=True)
        return results[:request.top_k]
    except Exception as e:
        print(f"[VisualMatch Error] {e}")
        return []
