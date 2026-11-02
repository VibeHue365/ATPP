import logging
import os

from .clip_engine import InvalidImageError, download_image
from .product_describer import describe_product
from .schemas import DraftAttribute, ProductDraftRequest, ProductDraftResponse


logger = logging.getLogger(__name__)


def draft_from_photos(request: ProductDraftRequest) -> ProductDraftResponse:
    """UC-C10: name/description suggestion for the provider's uploaded photos."""
    if not is_enabled():
        return ProductDraftResponse(status="UNAVAILABLE")
    images = []
    for url in request.image_urls:
        if not url.startswith(("http://", "https://")):
            raise InvalidImageError("Đường dẫn ảnh không hợp lệ.")
        try:
            images.append(download_image(url))
        except Exception as error:  # noqa: BLE001 - describe from the photos that did load
            logger.warning("Product draft skipped %s: %s", url, error)
    if not images:
        raise InvalidImageError("Không tải được ảnh sản phẩm.")

    draft = describe_product(images)
    return ProductDraftResponse(
        status=draft.status,
        attributes=[
            DraftAttribute(group=a.group, key=a.key, label=a.label, confidence=a.confidence, on_cover=a.on_cover)
            for a in draft.attributes
        ],
        name=draft.name,
        description=draft.description,
        colors=draft.colors,
    )


def is_enabled() -> bool:
    # Shares the CLIP model with visual search; disabling that frees the model for both.
    return (
        os.environ.get("PRODUCT_DRAFT_ENABLED", "true").lower() == "true"
        and os.environ.get("VISUAL_SEARCH_ENABLED", "true").lower() == "true"
    )
