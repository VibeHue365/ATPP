from typing import List, Optional
from pydantic import BaseModel, Field


class ProductInfo(BaseModel):
    id: Optional[str] = None
    name: str = ""
    description: Optional[str] = ""
    category: Optional[str] = ""
    materials: Optional[List[str]] = Field(default_factory=list)
    colors: Optional[List[str]] = Field(default_factory=list)
    sizes: Optional[List[str]] = Field(default_factory=list)
    basePrice: Optional[float] = 0.0
    images: Optional[List[str]] = Field(default_factory=list)


class PhotographyPackageInfo(BaseModel):
    id: Optional[str] = None
    name: str = ""
    description: Optional[str] = ""
    price: Optional[float] = 0.0
    durationMinutes: Optional[int] = 60
    maxPeople: Optional[int] = 1
    locationType: Optional[str] = ""
    deliverables: Optional[List[str]] = Field(default_factory=list)
    images: Optional[List[str]] = Field(default_factory=list)


class ComboSuggestionRequest(BaseModel):
    product: ProductInfo
    photography_package: PhotographyPackageInfo
    vibe: Optional[str] = "Tự động phân tích"
    notes: Optional[str] = ""


class ComboSuggestionResponse(BaseModel):
    name: str
    description: str
    suggested_discount_percent: int = 15
    suggested_price: int = 0
    suggested_shoot_people_count: int = 1
    suggested_aodai_quantity: int = 1
    concept_theme: str = ""
    target_audience: str = ""
    ideal_locations: List[str] = Field(default_factory=list)
    styling_tips: List[str] = Field(default_factory=list)
    marketing_highlights: List[str] = Field(default_factory=list)
    source: str = "gemini_ai"
