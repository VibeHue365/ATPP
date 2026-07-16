from typing import Literal
from pydantic import BaseModel, Field


class AllowedTag(BaseModel):
    code: str = Field(pattern=r"^[A-Z0-9_]+$")
    description: str = Field(max_length=500)


class TaggingRequest(BaseModel):
    entity_type: Literal["PRODUCT", "PORTFOLIO"]
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    structured_attributes: dict[str, object] = Field(default_factory=dict)
    allowed_tags: list[AllowedTag] = Field(min_length=1, max_length=50)
    taxonomy_version: int = Field(ge=1)


class TagSuggestion(BaseModel):
    code: str
    confidence: float = Field(ge=0, le=1)
    source: Literal["AI_TEXT"] = "AI_TEXT"
    explanation: str = Field(max_length=500)


class TaggingResponse(BaseModel):
    status: Literal["SUCCESS", "UNAVAILABLE"] = "SUCCESS"
    suggestions: list[TagSuggestion]
    model: str
    prompt_version: str
    latency_ms: int = Field(ge=0)
    error_code: str | None = None
