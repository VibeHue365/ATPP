from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class UserPreference(BaseModel):
    user_id: str
    preferred_styles: List[str]
    preferred_colors: List[str]
    price_range: str
    body_type: Optional[str] = None

class BookingHistory(BaseModel):
    user_id: str
    service_id: str
    service_type: str
    style_tags: List[str]
    rating_given: Optional[float] = None
    booked_at: Optional[datetime] = None

class Service(BaseModel):
    service_id: str
    name: str
    service_type: str
    style_tags: List[str]
    color_tags: List[str]
    price_range: str
    avg_rating: float
    description: str
    provider_id: str