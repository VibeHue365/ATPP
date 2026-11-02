import os
from dataclasses import dataclass

import numpy as np
from PIL import Image

from .clip_engine import encode_images
from .color_features import color_histogram, color_similarity


# Measured on the catalog (VIB-93 spike): 0.2 lifts same-colour dresses into the
# top 5 without hurting exact re-uploads; 0.3+ starts to push the exact match down.
DEFAULT_COLOR_WEIGHT = 0.2


@dataclass(frozen=True)
class ImageFeatures:
    vector: np.ndarray
    colors: np.ndarray


def extract_features(images: list[Image.Image]) -> list[ImageFeatures]:
    vectors = encode_images(images)
    return [ImageFeatures(vector, color_histogram(image)) for vector, image in zip(vectors, images)]


def product_score(query: ImageFeatures, product_images: list[ImageFeatures]) -> float:
    """Best match over the product's photos; each photo is usually one colour variant."""
    weight = get_color_weight()
    return max(
        (1 - weight) * float(image.vector @ query.vector)
        + weight * color_similarity(query.colors, image.colors)
        for image in product_images
    )


def get_color_weight() -> float:
    try:
        value = float(os.environ.get("VISUAL_SEARCH_COLOR_WEIGHT", DEFAULT_COLOR_WEIGHT))
    except ValueError:
        return DEFAULT_COLOR_WEIGHT
    return max(0.0, min(1.0, value))
