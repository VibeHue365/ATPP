import base64
import io
import os
import threading
import urllib.request
from typing import Protocol

import numpy as np
from PIL import Image, UnidentifiedImageError


DEFAULT_MODEL = "clip-ViT-B-32"
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGE_SIDE = 512
DOWNLOAD_TIMEOUT_SECONDS = 10


class ImageEmbeddingModel(Protocol):
    def encode(self, inputs: list, **kwargs): ...


class InvalidImageError(ValueError):
    """The uploaded or catalog image cannot be decoded."""


_model: ImageEmbeddingModel | None = None
_model_name: str | None = None
_model_lock = threading.Lock()


def encode_images(images: list[Image.Image]) -> np.ndarray:
    """Unit-length CLIP vectors, one row per image."""
    return _encode(images)


def encode_texts(texts: list[str]) -> np.ndarray:
    """Unit-length CLIP vectors in the same space as `encode_images`."""
    return _encode(texts)


def _encode(inputs: list) -> np.ndarray:
    model = get_model(get_model_name())
    vectors = model.encode(
        inputs,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return np.asarray(vectors, dtype=np.float32)


def decode_base64_image(value: str) -> Image.Image:
    # Browsers send data URLs; mobile and the backend send the raw payload.
    payload = value.split(",", 1)[1] if value.startswith("data:") else value
    try:
        raw = base64.b64decode(payload, validate=True)
    except (ValueError, TypeError) as error:
        raise InvalidImageError("Ảnh không đúng định dạng base64.") from error
    return open_image(raw)


def download_image(url: str) -> Image.Image:
    request = urllib.request.Request(url, headers={"User-Agent": "vibehue-ai-service"})
    with urllib.request.urlopen(request, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
        raw = response.read(MAX_IMAGE_BYTES + 1)
    return open_image(raw)


def open_image(raw: bytes) -> Image.Image:
    if not raw:
        raise InvalidImageError("Ảnh rỗng.")
    if len(raw) > MAX_IMAGE_BYTES:
        raise InvalidImageError("Ảnh vượt quá 5MB.")
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except (UnidentifiedImageError, OSError) as error:
        raise InvalidImageError("Không đọc được ảnh.") from error
    image = image.convert("RGB")
    # CLIP works at 224px; shrinking first keeps CPU time and memory low.
    image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
    return image


def get_model(model_name: str) -> ImageEmbeddingModel:
    global _model, _model_name
    if _model is not None and _model_name == model_name:
        return _model

    with _model_lock:
        if _model is not None and _model_name == model_name:
            return _model
        from sentence_transformers import SentenceTransformer

        local_only = os.environ.get("VISUAL_SEARCH_LOCAL_FILES_ONLY", "false").lower() == "true"
        _model = SentenceTransformer(model_name, local_files_only=local_only)
        _model_name = model_name
        return _model


def get_model_name() -> str:
    return os.environ.get("VISUAL_SEARCH_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
