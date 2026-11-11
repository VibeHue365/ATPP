from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class UserShopInteractionItem(BaseModel):
    customer_id: str = ""
    customer_name: str = ""
    customer_email: str = ""
    provider_id: str = ""
    provider_name: str = ""
    total_bookings: int = 0
    completed_bookings: int = 0
    total_spent: float = 0.0
    review_count: int = 0
    average_rating_given: float = 0.0
    recent_comment: Optional[str] = ""
    loyalty_tier: str = "REGULAR"


class NegativeCommentItem(BaseModel):
    rating: int = 1
    comment: str = ""
    customer_name: str = ""
    created_at: Optional[str] = ""


class ShopRiskProfileItem(BaseModel):
    provider_id: str = ""
    business_name: str = ""
    total_reviews: int = 0
    average_rating: float = 0.0
    bad_review_count: int = 0
    bad_review_percentage: float = 0.0
    positive_review_count: int = 0
    reported_reviews_count: int = 0
    dispute_count: int = 0
    risk_level: str = "HEALTHY"
    primary_issues: List[str] = Field(default_factory=list)
    recent_negative_comments: List[NegativeCommentItem] = Field(default_factory=list)


class SentimentClusterItem(BaseModel):
    topic: str = ""
    sentiment: str = "NEUTRAL"
    count: int = 0
    sample_quotes: List[str] = Field(default_factory=list)


class AdminInsightsRequest(BaseModel):
    summary: Dict[str, Any] = Field(default_factory=dict)
    user_shop_interactions: List[UserShopInteractionItem] = Field(default_factory=list)
    shop_risk_profiles: List[ShopRiskProfileItem] = Field(default_factory=list)
    sentiment_clusters: List[SentimentClusterItem] = Field(default_factory=list)
    question: Optional[str] = None


class AdminInsightsResponse(BaseModel):
    executive_summary: str = ""
    bad_shops_analysis: str = ""
    user_behavior_analysis: str = ""
    top_recommendations: List[str] = Field(default_factory=list)
    copilot_answer: Optional[str] = None
    source: str = "ai_engine"

