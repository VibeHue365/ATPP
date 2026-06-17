import asyncio
import sys

# Cấu hình UTF-8 cho stdout trên Windows để tránh lỗi UnicodeEncodeError khi in tiếng Việt
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from database import users_col, services_col, bookings_col
from datetime import datetime

sample_users = [
    {
        "_id": "user_001",
        "name": "Nguyễn Thị An",
        "preferences": {
            "preferred_styles": ["vintage", "cổ điển"],
            "preferred_colors": ["đỏ", "vàng"],
            "price_range": "medium"
        }
    },
    {
        "_id": "user_002",
        "name": "Trần Thị Bình",
        "preferences": {
            "preferred_styles": ["hiện đại", "tối giản"],
            "preferred_colors": ["trắng", "xanh"],
            "price_range": "high"
        }
    }
]

sample_services = [
    {
        "service_id": "svc_001",
        "name": "Áo Dài Hoàng Hậu",
        "service_type": "ao_dai",
        "style_tags": ["cổ điển", "vintage"],
        "color_tags": ["đỏ", "vàng"],
        "price_range": "medium",
        "avg_rating": 4.8,
        "description": "Áo dài cung đình thêu tay tinh xảo",
        "provider_id": "shop_001",
        "status": "active"
    },
    {
        "service_id": "svc_002",
        "name": "Áo Dài Sen Trắng",
        "service_type": "ao_dai",
        "style_tags": ["tối giản", "hiện đại"],
        "color_tags": ["trắng"],
        "price_range": "high",
        "avg_rating": 4.9,
        "description": "Thiết kế tối giản vải lụa cao cấp",
        "provider_id": "shop_002",
        "status": "active"
    },
    {
        "service_id": "svc_003",
        "name": "Photographer Minh Khoa",
        "service_type": "photographer",
        "style_tags": ["vintage", "ngoại cảnh", "cinematic"],
        "color_tags": [],
        "price_range": "medium",
        "avg_rating": 4.7,
        "description": "Chuyên chụp ngoại cảnh phong cách vintage film",
        "provider_id": "photo_001",
        "status": "active"
    },
    {
        "service_id": "svc_004",
        "name": "Áo Dài Vintage Hà Nội",
        "service_type": "ao_dai",
        "style_tags": ["vintage", "cổ điển"],
        "color_tags": ["đỏ", "nâu", "vàng"],
        "price_range": "low",
        "avg_rating": 4.5,
        "description": "Phong cách Hà Nội xưa họa tiết truyền thống",
        "provider_id": "shop_003",
        "status": "active"
    },
    {
        "service_id": "svc_005",
        "name": "Photographer Lan Anh",
        "service_type": "photographer",
        "style_tags": ["cổ điển", "studio", "chân dung"],
        "color_tags": [],
        "price_range": "high",
        "avg_rating": 5.0,
        "description": "Studio cao cấp chuyên ảnh cưới và áo dài",
        "provider_id": "photo_002",
        "status": "active"
    }
]

sample_bookings = [
    {
        "user_id": "user_001",
        "service_id": "svc_003",
        "service_type": "ao_dai",
        "style_tags": ["vintage", "ngoại cảnh"],
        "rating_given": 5.0,
        "booked_at": datetime(2025, 1, 10)
    },
    {
        "user_id": "user_001",
        "service_id": "svc_005",
        "service_type": "photographer",
        "style_tags": ["cổ điển"],
        "rating_given": 4.0,
        "booked_at": datetime(2025, 2, 15)
    }
]

async def seed():
    print("Đang xóa dữ liệu cũ...")
    await users_col.delete_many({})
    await services_col.delete_many({})
    await bookings_col.delete_many({})

    print("Đang thêm dữ liệu mẫu...")
    await users_col.insert_many(sample_users)
    await services_col.insert_many(sample_services)
    await bookings_col.insert_many(sample_bookings)

    print("✅ Seed xong!")
    print(f"   - {len(sample_users)} users")
    print(f"   - {len(sample_services)} services")
    print(f"   - {len(sample_bookings)} bookings")

asyncio.run(seed())