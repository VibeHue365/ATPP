from typing import Literal

from pydantic import BaseModel, Field


class VisualMatchRequest(BaseModel):
    # 5MB image as base64 is about 7M characters.
    image_base64: str = Field(min_length=1, max_length=7_000_000)
    mime_type: Literal["image/jpeg", "image/png", "image/webp"] = "image/jpeg"
    limit: int = Field(default=5, ge=1, le=20)


class ProductDraftRequest(BaseModel):
    """UC-C10. The backend only forwards URLs of photos the provider uploaded."""

    image_urls: list[str] = Field(min_length=1, max_length=3)


class DraftAttribute(BaseModel):
    group: Literal["color", "pattern", "gender", "style"]
    key: str
    label: str
    confidence: float = Field(ge=0, le=1)
    on_cover: bool


class ProductDraftResponse(BaseModel):
    status: Literal["SUCCESS", "NOT_AO_DAI", "UNAVAILABLE"]
    attributes: list[DraftAttribute] = Field(default_factory=list)
    name: str = ""
    description: str = ""
    colors: list[str] = Field(default_factory=list)


class VisualMatch(BaseModel):
    """Field names follow the backend contract (`ai-visual.uc.spec.ts`)."""

    productId: str
    score: float = Field(ge=0, le=1)
