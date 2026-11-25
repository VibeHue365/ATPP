"""UC-C10 (optional): what CLIP cannot see in an ao dai photo, read by Gemini.

Gemini only picks values from fixed lists (structured output, temperature 0); the listing
text is still built by product_describer, so a reply can never put free text in a name.
Anything unexpected, slow or failing returns None and the suggestion falls back to CLIP.

Spike 2026-11-25 (16 catalog photos, gemini-3.1-flash-lite): answers matched the photos
and repeated runs gave identical answers, but ~1 in 4 calls failed with 503/504 when the
model was busy and slow replies took up to ~18 s, hence the short timeout and no retry.
"""
import hashlib
import io
import logging
import os
import threading
from collections import OrderedDict
from enum import Enum

from PIL import Image
from pydantic import BaseModel, Field

from .product_describer import DetectedAttribute


logger = logging.getLogger(__name__)

PROMPT_VERSION = "uc-c10-gemini-v1"
DEFAULT_MODEL = "gemini-3.1-flash-lite"
# Gemini rejects deadlines under 10 s; the backend waits 20 s for the whole suggestion.
MIN_TIMEOUT_MS = 10000
MAX_TIMEOUT_MS = 15000
DEFAULT_TIMEOUT_MS = MIN_TIMEOUT_MS
MAX_PHOTOS = 3
PHOTO_SIZE = 512
CACHE_SIZE = 256
# Gemini's own certainty; LOW answers are dropped instead of shown as a guess.
CERTAINTY_SCORES = {"HIGH": 0.9, "MEDIUM": 0.7}

STYLE_LABELS = {"TRUYEN_THONG": "truyền thống", "CACH_TAN": "cách tân", "PHA_CACH": "phá cách"}
MATERIAL_LABELS = {
    "LUA": "lụa", "GAM": "gấm", "VOAN": "voan", "NHUNG": "nhung",
    "REN": "ren", "TO_TAM": "tơ tằm", "DUI": "đũi",
}
MOTIF_LABELS = {
    "TRON": "trơn", "HOA_SEN": "hoa sen", "HOA_MAI": "hoa mai", "HOA_DAO": "hoa đào",
    "HOA_CUC": "hoa cúc", "HOA_HONG": "hoa hồng", "HOA_NHI": "hoa nhí", "HOA_LA": "họa tiết lá",
    "PHUONG": "phượng", "RONG": "rồng", "CHIM_HAC": "chim hạc",
    "HOA_VAN_HINH_HOC": "hoa văn hình học", "PHONG_CANH": "phong cảnh",
}
# Keys are the smart-tag occasion codes.
OCCASION_LABELS = {
    "PHU_HOP_LE_CUOI": "lễ cưới", "CHUP_ANH_KY_YEU": "kỷ yếu",
    "LE_HOI_TRUYEN_THONG": "lễ hội", "BIEU_DIEN_SU_KIEN": "biểu diễn",
}

Style = Enum("Style", {key: key for key in [*STYLE_LABELS, "UNKNOWN"]}, type=str)
Material = Enum("Material", {key: key for key in [*MATERIAL_LABELS, "UNKNOWN"]}, type=str)
Motif = Enum("Motif", {key: key for key in [*MOTIF_LABELS, "UNKNOWN"]}, type=str)
Occasion = Enum("Occasion", {key: key for key in OCCASION_LABELS}, type=str)
Certainty = Enum("Certainty", {key: key for key in ["HIGH", "MEDIUM", "LOW"]}, type=str)


class GeminiAttributes(BaseModel):
    style: Style
    style_certainty: Certainty
    material: Material
    material_certainty: Certainty
    motif: Motif
    motif_certainty: Certainty
    occasions: list[Occasion] = Field(max_length=2)
    occasions_certainty: Certainty


PROMPT = """You look at product photos of a Vietnamese ao dai listed for rent. Classify ONLY what is visible.
style:
- TRUYEN_THONG: classic ao dai: long fitted tunic to below the knee/ankle, high mandarin collar, long sleeves,
  two long flaps split from the waist, usually worn with loose trousers; also Nhat Binh / ngu than court styles.
- CACH_TAN: modernised ao dai: shorter tunic (knee or above) or flared/pleated skirt flaps, non-mandarin collar
  (round, V, square, boat), short/puff/cap sleeves, 3D appliques, or worn with a skirt instead of trousers.
- PHA_CACH: avant-garde: asymmetric or torn cuts, streetwear or graffiti prints, unconventional fabrics or silhouettes.
- UNKNOWN when the silhouette is not clear.
material: the fabric only if it is visually evident (GAM = brocade with a woven pattern, LUA = smooth shiny
  silk/satin, VOAN = sheer chiffon, NHUNG = velvet, REN = lace, TO_TAM = raw silk, DUI = linen-like slub).
motif: the dominant decoration. TRON = plain, HOA_NHI = many small flowers, HOA_LA = leaves or foliage,
  PHONG_CANH = a landscape scene.
occasions: at most 2, only with a clear visual cue, otherwise an empty list:
  PHU_HOP_LE_CUOI (red/gold wedding ao dai, phoenix or dragon, khan dong headpiece),
  CHUP_ANH_KY_YEU (plain white school-style ao dai), LE_HOI_TRUYEN_THONG (bright Tet or festival look),
  BIEU_DIEN_SU_KIEN (stage costume: sequins, dramatic shapes).
Give each answer a certainty; use LOW or UNKNOWN instead of guessing."""

_cache: "OrderedDict[str, list[DetectedAttribute]]" = OrderedDict()
_cache_lock = threading.Lock()


def is_enabled() -> bool:
    return os.environ.get("PRODUCT_DRAFT_GEMINI_ENABLED", "true").lower() == "true" and bool(_api_key())


def analyze(images: list[Image.Image], client=None) -> list[DetectedAttribute] | None:
    """Style, fabric, motif and occasions for the photos (cover first), or None."""
    if client is None and not is_enabled():
        return None
    photos = [_jpeg(image) for image in images[:MAX_PHOTOS]]
    key = _cache_key(photos)
    with _cache_lock:
        if key in _cache:
            _cache.move_to_end(key)
            return list(_cache[key])
    try:
        attributes = to_attributes(_ask(photos, client))
    except Exception as error:  # noqa: BLE001 - any failure falls back to the CLIP suggestion
        logger.warning(
            "Product draft Gemini unavailable: type=%s code=%s",
            type(error).__name__, getattr(error, "code", "-"),
        )
        return None
    with _cache_lock:
        _cache[key] = attributes
        while len(_cache) > CACHE_SIZE:
            _cache.popitem(last=False)
    return list(attributes)


def to_attributes(answer: GeminiAttributes) -> list[DetectedAttribute]:
    found = []
    for group, value, certainty, labels in (
        ("style", answer.style, answer.style_certainty, STYLE_LABELS),
        ("material", answer.material, answer.material_certainty, MATERIAL_LABELS),
        ("motif", answer.motif, answer.motif_certainty, MOTIF_LABELS),
    ):
        score = CERTAINTY_SCORES.get(certainty.value)
        if score and value.value in labels:
            found.append(DetectedAttribute(group, value.value, labels[value.value], score))
    score = CERTAINTY_SCORES.get(answer.occasions_certainty.value)
    if score:
        for occasion in list(dict.fromkeys(o.value for o in answer.occasions))[:2]:
            found.append(DetectedAttribute("occasion", occasion, OCCASION_LABELS[occasion], score))
    return found


def clear_cache() -> None:
    with _cache_lock:
        _cache.clear()


def _ask(photos: list[bytes], client=None) -> GeminiAttributes:
    owns_client = client is None
    if owns_client:
        from google import genai
        client = genai.Client(api_key=_api_key(), http_options={
            "timeout": _timeout_ms(),
            "retry_options": {"attempts": 1},
        })
    from google.genai import types
    try:
        response = client.models.generate_content(
            model=_model(),
            contents=[*(types.Part.from_bytes(data=p, mime_type="image/jpeg") for p in photos), PROMPT],
            config={"response_mime_type": "application/json", "response_schema": GeminiAttributes, "temperature": 0},
        )
    finally:
        if owns_client:
            client.close()
    return GeminiAttributes.model_validate_json(response.text or "")


def _jpeg(image: Image.Image) -> bytes:
    small = image.convert("RGB")
    small.thumbnail((PHOTO_SIZE, PHOTO_SIZE))
    buffer = io.BytesIO()
    small.save(buffer, "JPEG", quality=88)
    return buffer.getvalue()


def _cache_key(photos: list[bytes]) -> str:
    digest = hashlib.sha256(f"{PROMPT_VERSION}|{_model()}".encode())
    for photo in photos:
        digest.update(hashlib.sha256(photo).digest())
    return digest.hexdigest()


def _api_key() -> str:
    # A key of its own (ideally from another Google project) keeps UC-C10 off the shared quota.
    return (os.environ.get("PRODUCT_DRAFT_GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY") or "").strip()


def _model() -> str:
    return os.environ.get("PRODUCT_DRAFT_GEMINI_MODEL", "").strip() or DEFAULT_MODEL


def _timeout_ms() -> int:
    try:
        value = int(os.environ.get("PRODUCT_DRAFT_GEMINI_TIMEOUT_MS", DEFAULT_TIMEOUT_MS))
    except ValueError:
        return DEFAULT_TIMEOUT_MS
    return min(max(value, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS)
