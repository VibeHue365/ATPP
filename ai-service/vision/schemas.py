from typing import Literal

from pydantic import BaseModel, Field


class VisualMatchRequest(BaseModel):
    # 5MB image as base64 is about 7M characters.
    image_base64: str = Field(min_length=1, max_length=7_000_000)
    mime_type: Literal["image/jpeg", "image/png", "image/webp"] = "image/jpeg"
    limit: int = Field(default=5, ge=1, le=20)


class VisualMatch(BaseModel):
    """Field names follow the backend contract (`ai-visual.uc.spec.ts`)."""

    productId: str
    score: float = Field(ge=0, le=1)
