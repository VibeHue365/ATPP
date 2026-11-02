import logging
import os
import threading

from .ao_dai_gate import get_prompt_vectors, looks_like_ao_dai
from .clip_engine import decode_base64_image
from .schemas import VisualMatch, VisualMatchRequest
from .similarity import extract_features
from .visual_index import VisualIndex


logger = logging.getLogger(__name__)

# Below this a result is just "another Ao Dai"; 0.80+ is shown as "very similar".
DEFAULT_MIN_SCORE = 0.62

_index: VisualIndex | None = None


def match_products(request: VisualMatchRequest) -> list[VisualMatch]:
    """Catalog products that look like the uploaded photo, best first.

    An empty list means either the photo shows no Ao Dai or nothing is close enough;
    the caller shows the same "no matching Ao Dai" message for both.
    """
    if not is_enabled():
        return []
    image = decode_base64_image(request.image_base64)
    query = extract_features([image])[0]
    if not looks_like_ao_dai(query.vector):
        return []
    matches = get_index().search(query, request.limit, get_min_score())
    return [
        VisualMatch(productId=product_id, score=round(max(0.0, min(1.0, score)), 4))
        for product_id, score in matches
    ]


def start_warm_up() -> None:
    """Load CLIP and build the index in the background so the first customer does
    not wait ~20s (longer than the backend's timeout). Skipped when disabled."""
    if not is_enabled():
        return

    def warm_up() -> None:
        try:
            get_prompt_vectors()
            get_index().refresh(only_if_empty=True)
        except Exception as error:  # noqa: BLE001 - the first request will retry
            logger.warning("Visual search warm-up failed: %s", error)

    threading.Thread(target=warm_up, name="visual-search-warm-up", daemon=True).start()


def get_index() -> VisualIndex:
    global _index
    if _index is None:
        _index = VisualIndex()
    return _index


def is_enabled() -> bool:
    return os.environ.get("VISUAL_SEARCH_ENABLED", "true").lower() == "true"


def get_min_score() -> float:
    try:
        value = float(os.environ.get("VISUAL_SEARCH_MIN_SCORE", DEFAULT_MIN_SCORE))
    except ValueError:
        return DEFAULT_MIN_SCORE
    return max(0.0, min(1.0, value))
