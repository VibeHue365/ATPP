"""UC-C10: suggest an Ao Dai listing (attributes, name, description) from product photos.

Everything runs on the local CLIP model of the visual search; no external API.
An attribute is only reported when it is clearly detected, so the provider never
gets a confident-looking guess. Which attributes are used, and their thresholds,
come from the UC-C10 spike on the catalog photos (28 photos):
  colour  — 0.6 × CLIP (several prompts per colour) + 0.4 × garment colour histogram: 89% correct
  pattern — CLIP; right ~13/14 times once its share is ≥ 0.65
  male    — CLIP; women's photos scored ≥ 0.79 female, so "nam" needs ≥ 0.8
  avant-garde style — CLIP; only clear-cut streetwear designs reach 0.9
Traditional vs modern style and the occasion were not reliable and are left to the provider.
"""
import os
from dataclasses import dataclass, field

import numpy as np
from PIL import Image

from .ao_dai_gate import looks_like_ao_dai
from .clip_engine import encode_images, encode_texts
from .color_features import HUE_BINS, color_histogram


@dataclass(frozen=True)
class AttributeOption:
    key: str
    label: str  # Vietnamese wording used in the name/description
    prompts: tuple[str, ...]  # English: clip-ViT-B-32's text tower is English-only


@dataclass(frozen=True)
class DetectedAttribute:
    group: str
    key: str
    label: str
    confidence: float
    on_cover: bool = True  # False: a colour seen only in the other photos (another variant)


@dataclass
class ProductDraft:
    status: str = "SUCCESS"  # or NOT_AO_DAI when the cover photo shows no Ao Dai
    attributes: list[DetectedAttribute] = field(default_factory=list)
    name: str = ""
    description: str = ""
    colors: list[str] = field(default_factory=list)  # wizard colour keys, e.g. ["RED"]


# Wizard colour keys (ProductWizardModal ALL_COLORS), their Vietnamese names and the
# CLIP wordings that count as that colour (purple/lilac fall under PINK, as in the wizard).
COLORS: dict[str, tuple[str, tuple[str, ...]]] = {
    "RED": ("đỏ", ("red", "crimson red", "dark red")),
    "PINK": ("hồng", ("pink", "light pink", "hot pink magenta", "purple", "lilac lavender")),
    "WHITE": ("trắng", ("white", "cream off-white")),
    "GOLD": ("vàng", ("yellow", "golden", "orange")),
    "BLUE": ("xanh dương", ("blue", "light blue", "pastel sky blue", "navy blue")),
    "GREEN": ("xanh lá", ("green", "olive green", "mint green")),
    "BLACK": ("đen", ("black",)),
}
# Histogram bins (30° hues centred on red, then black/grey/white) -> wizard colour key.
HUE_BIN_COLORS = ["RED", "GOLD", "GOLD", "GREEN", "GREEN", "GREEN",
                  "BLUE", "BLUE", "BLUE", "PINK", "PINK", "PINK"]
ACHROMATIC_COLORS = ["BLACK", "WHITE", "WHITE"]
CLIP_COLOR_WEIGHT = 0.6

ATTRIBUTE_GROUPS: dict[str, tuple[AttributeOption, ...]] = {
    "pattern": (
        AttributeOption("PLAIN", "trơn", ("a plain solid-colour ao dai without any pattern",)),
        AttributeOption("EMBROIDERED", "thêu hoa", (
            "an ao dai with embroidered flowers on the fabric",
            "an ao dai decorated with hand embroidery",
        )),
        AttributeOption("BROCADE", "gấm hoa văn", ("an ao dai made of shiny brocade with woven patterns",)),
        AttributeOption("PRINTED", "in họa tiết", ("an ao dai with an all-over printed pattern",)),
    ),
    "gender": (
        AttributeOption("FEMALE", "nữ", ("a woman wearing an ao dai",)),
        AttributeOption("MALE", "nam", ("a man wearing an ao dai",)),
    ),
    "style": (
        AttributeOption("TRUYEN_THONG", "truyền thống", (
            "a traditional Vietnamese ao dai with a classic long fitted silhouette",
        )),
        AttributeOption("CACH_TAN", "cách tân", (
            "a modern cach tan ao dai with a loose or shortened contemporary cut",
        )),
        AttributeOption("PHA_CACH", "phá cách", (
            "an avant-garde streetwear ao dai with an unconventional design",
            "an experimental fashion ao dai with bold graphic elements",
        )),
    ),
}
# Only these winners are reported, and only above their threshold.
REPORTED = {
    ("color", None): 0.4,
    ("pattern", None): 0.65,
    ("gender", "MALE"): 0.8,
    ("style", "PHA_CACH"): 0.9,
}
SECOND_COLOR_SHARE = 0.3
MAX_COLORS = 3
LOGIT_SCALE = 100.0

PATTERN_PHRASES = {
    "PLAIN": "thiết kế trơn tối giản, thanh lịch",
    "EMBROIDERED": "điểm xuyết họa tiết thêu hoa tinh tế",
    "BROCADE": "chất liệu gấm dệt hoa văn nổi bật",
    "PRINTED": "họa tiết in nổi bật, trẻ trung",
}
COLOR_MOODS = {
    "RED": "Sắc đỏ rực rỡ, rất hợp những dịp vui như lễ Tết, cưới hỏi.",
    "PINK": "Gam hồng nhẹ nhàng, tôn nét dịu dàng, nữ tính.",
    "WHITE": "Màu trắng tinh khôi, trang nhã và dễ phối phụ kiện.",
    "GOLD": "Sắc vàng sang trọng, nổi bật khi lên ảnh.",
    "BLUE": "Gam xanh dịu mát, thanh lịch.",
    "GREEN": "Sắc xanh tươi mới, gần gũi thiên nhiên.",
    "BLACK": "Màu đen sang trọng, tôn dáng và dễ phối phụ kiện.",
}

_prompt_cache: dict[str, np.ndarray] = {}


def describe_product(images: list[Image.Image]) -> ProductDraft:
    vectors = encode_images(images)
    if not looks_like_ao_dai(vectors[0]):
        return ProductDraft(status="NOT_AO_DAI")
    attributes = detect_attributes(images, vectors)
    return ProductDraft(
        attributes=attributes,
        name=build_name(attributes),
        description=build_description(attributes),
        colors=[a.key for a in attributes if a.group == "color"],
    )


def detect_attributes(images: list[Image.Image], vectors: np.ndarray) -> list[DetectedAttribute]:
    """Colours per photo (a listing's photos are usually its colour variants); the other
    attributes from the first photo, which is the cover the provider chose."""
    colors: dict[str, tuple[float, bool]] = {}
    for index, (image, vector) in enumerate(zip(images, vectors)):
        ranked = rank_colors(image, vector)
        # The cover photo may add a clear second colour; other photos add their main one.
        for key, share in ranked if index == 0 else ranked[:1]:
            previous, on_cover = colors.get(key, (0.0, False))
            colors[key] = (max(previous, share), on_cover or index == 0)
    attributes = [
        DetectedAttribute("color", key, COLORS[key][0], round(share, 3), on_cover)
        for key, (share, on_cover) in list(colors.items())[:MAX_COLORS]
    ]
    for group in ATTRIBUTE_GROUPS:
        option, share = classify(vectors[0], group)
        threshold = REPORTED.get((group, option.key), REPORTED.get((group, None)))
        if threshold is not None and share >= threshold:
            attributes.append(DetectedAttribute(group, option.key, option.label, round(share, 3)))
    return attributes


def rank_colors(image: Image.Image, vector: np.ndarray) -> list[tuple[str, float]]:
    """Main colour (and a clear second one) of one photo: CLIP blended with the colour histogram."""
    keys = list(COLORS)
    clip_shares = _option_shares(vector, _color_prompt_vectors(), [len(COLORS[k][1]) for k in keys], use_max=True)
    histogram = color_histogram(image)
    histogram_shares = dict.fromkeys(keys, 0.0)
    for index, weight in enumerate(histogram):
        key = HUE_BIN_COLORS[index] if index < HUE_BINS else ACHROMATIC_COLORS[index - HUE_BINS]
        histogram_shares[key] += float(weight)
    blended = {
        key: CLIP_COLOR_WEIGHT * clip_shares[i] + (1 - CLIP_COLOR_WEIGHT) * histogram_shares[key]
        for i, key in enumerate(keys)
    }
    ranked = sorted(blended.items(), key=lambda item: item[1], reverse=True)
    picked = [item for item in ranked[:1] if item[1] >= REPORTED[("color", None)]]
    if picked:
        picked += [item for item in ranked[1:2] if item[1] >= SECOND_COLOR_SHARE]
    return picked


def classify(query: np.ndarray, group: str) -> tuple[AttributeOption, float]:
    options = ATTRIBUTE_GROUPS[group]
    shares = _option_shares(query, _group_prompt_vectors(group), [len(o.prompts) for o in options])
    best = int(np.argmax(shares))
    return options[best], float(shares[best])


def build_name(attributes: list[DetectedAttribute]) -> str:
    found = _by_group(attributes)
    parts = ["Áo dài"]
    if "gender" in found:
        parts.append(found["gender"][0].label)
    if "style" in found:
        parts.append(found["style"][0].label)
    cover_colors = [a for a in found.get("color", []) if a.on_cover]
    if cover_colors:
        parts.append(cover_colors[0].label)
    pattern = found.get("pattern", [None])[0]
    if pattern and pattern.key != "PLAIN":
        parts.append(pattern.label)
    return " ".join(parts) if len(parts) > 1 else ""


def build_description(attributes: list[DetectedAttribute]) -> str:
    found = _by_group(attributes)
    if not found:
        return ""
    cover_colors = [a for a in found.get("color", []) if a.on_cover]
    variant_colors = [a.label for a in found.get("color", []) if not a.on_cover]
    subject = "Mẫu áo dài"
    if "gender" in found:
        subject += f" {found['gender'][0].label}"
    if "style" in found:
        subject += f" phong cách {found['style'][0].label}"
    if cover_colors:
        subject += f" màu {' phối '.join(a.label for a in cover_colors)}"
    pattern = found.get("pattern", [None])[0]
    if pattern:
        subject += f", {PATTERN_PHRASES[pattern.key]}"
    sentences = [subject + "."]
    if cover_colors:
        sentences.append(COLOR_MOODS[cover_colors[0].key])
    if variant_colors:
        sentences.append(f"Có thêm các màu: {', '.join(variant_colors)}.")
    sentences.append("Thích hợp dạo phố, chụp ảnh ngoại cảnh hoặc tham dự sự kiện.")
    return " ".join(sentences)


def _by_group(attributes: list[DetectedAttribute]) -> dict[str, list[DetectedAttribute]]:
    grouped: dict[str, list[DetectedAttribute]] = {}
    for attribute in attributes:
        grouped.setdefault(attribute.group, []).append(attribute)
    return grouped


def _option_shares(query: np.ndarray, prompt_vectors: np.ndarray, sizes: list[int], use_max: bool = False) -> np.ndarray:
    """Softmax across options; an option scores the mean (or best) of its prompts."""
    sims = prompt_vectors @ query
    logits, start = [], 0
    for size in sizes:
        chunk = sims[start:start + size]
        logits.append(LOGIT_SCALE * float(chunk.max() if use_max else chunk.mean()))
        start += size
    logits = np.array(logits) - max(logits)
    return np.exp(logits) / np.exp(logits).sum()


def _color_prompt_vectors() -> np.ndarray:
    if "color" not in _prompt_cache:
        _prompt_cache["color"] = encode_texts([
            f"a photo of a woman wearing a {wording} ao dai"
            for _, wordings in COLORS.values() for wording in wordings
        ])
    return _prompt_cache["color"]


def _group_prompt_vectors(group: str) -> np.ndarray:
    if group not in _prompt_cache:
        _prompt_cache[group] = encode_texts([p for option in ATTRIBUTE_GROUPS[group] for p in option.prompts])
    return _prompt_cache[group]
