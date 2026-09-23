import os
import threading
import time
from typing import Protocol

from .schemas import TaggingRequest, TaggingResponse, TagSuggestion


TAGGING_VERSION = "local-embedding-v2"
DEFAULT_MODEL = "intfloat/multilingual-e5-small"
DEFAULT_MIN_SIMILARITY = 0.87
DEFAULT_TOP_K = 3


class EmbeddingModel(Protocol):
    def encode(self, sentences: list[str], **kwargs): ...


_model: EmbeddingModel | None = None
_model_name: str | None = None
_model_lock = threading.Lock()


def suggest_tags(request: TaggingRequest) -> TaggingResponse:
    """Suggest allowlisted tags using only the entity title and description."""
    started = time.monotonic()
    model_name = get_model_name()
    product_text = normalize_text(f"{request.title}. {request.description}")
    if not product_text:
        return TaggingResponse(
            status="SUCCESS",
            suggestions=[],
            model=model_name,
            prompt_version=TAGGING_VERSION,
            latency_ms=elapsed_ms(started),
        )

    try:
        model = get_model(model_name)
        query = f"query: {product_text}"
        passages = [
            f"passage: {normalize_text(tag.description)}" for tag in request.allowed_tags
        ]
        vectors = model.encode(
            [query, *passages],
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        query_vector = vectors[0]
        tag_vectors = vectors[1:]
        scores = tag_vectors @ query_vector
    except Exception as error:
        print(f"[smart-tagging] Local embedding unavailable: {type(error).__name__}")
        return TaggingResponse(
            status="UNAVAILABLE",
            suggestions=[],
            model=model_name,
            prompt_version=TAGGING_VERSION,
            latency_ms=elapsed_ms(started),
            error_code="LOCAL_EMBEDDING_UNAVAILABLE",
        )

    ranked = sorted(
        zip(request.allowed_tags, scores, strict=True),
        key=lambda item: float(item[1]),
        reverse=True,
    )
    threshold = get_min_similarity()
    # Keep only the strongest semantic match in each taxonomy group. This
    # prevents mutually exclusive style tags (for example TRUYEN_THONG and
    # CACH_TAN) from being suggested together merely because their wording is
    # similar. Ungrouped tags remain independently eligible for compatibility.
    selected = []
    selected_groups: set[str] = set()
    for tag, score in ranked:
        if float(score) < threshold:
            continue
        if tag.group and tag.group in selected_groups:
            continue
        selected.append((tag, score))
        if tag.group:
            selected_groups.add(tag.group)
        if len(selected) >= get_top_k():
            break

    suggestions = [
        TagSuggestion(
            code=tag.code,
            confidence=round(max(0.0, min(1.0, float(score))), 4),
            explanation=(
                "Tên và mô tả sản phẩm có mức tương đồng ngữ nghĩa "
                f"{max(0.0, min(1.0, float(score))):.2f} với thẻ {tag.code}."
            ),
        )
        for tag, score in selected
    ]

    return TaggingResponse(
        status="SUCCESS",
        suggestions=suggestions,
        model=model_name,
        prompt_version=TAGGING_VERSION,
        latency_ms=elapsed_ms(started),
    )


def get_model(model_name: str) -> EmbeddingModel:
    global _model, _model_name
    if _model is not None and _model_name == model_name:
        return _model

    with _model_lock:
        if _model is not None and _model_name == model_name:
            return _model
        from sentence_transformers import SentenceTransformer

        local_only = os.environ.get("SMART_TAG_LOCAL_FILES_ONLY", "false").lower() == "true"
        _model = SentenceTransformer(model_name, local_files_only=local_only)
        _model_name = model_name
        return _model


def get_model_name() -> str:
    return os.environ.get("SMART_TAG_EMBEDDING_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL


def get_min_similarity() -> float:
    try:
        value = float(
            os.environ.get("SMART_TAG_MIN_SIMILARITY", DEFAULT_MIN_SIMILARITY)
        )
    except ValueError:
        return DEFAULT_MIN_SIMILARITY
    return max(0.0, min(1.0, value))


def get_top_k() -> int:
    try:
        value = int(os.environ.get("SMART_TAG_TOP_K", DEFAULT_TOP_K))
    except ValueError:
        return DEFAULT_TOP_K
    return max(1, min(10, value))


def normalize_text(value: str) -> str:
    return " ".join(value.split()).strip()


def elapsed_ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)
