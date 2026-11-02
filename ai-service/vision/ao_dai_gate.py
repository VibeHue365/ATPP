import os

import numpy as np

from .clip_engine import encode_texts


# clip-ViT-B-32's text tower only understands English.
AO_DAI_PROMPTS = [
    "a photo of a Vietnamese ao dai",
    "a woman wearing a long Vietnamese ao dai dress",
    "a traditional Vietnamese long dress with side slits worn over trousers",
]
OTHER_PROMPTS = [
    "a photo of a motorcycle",
    "a photo of a car",
    "a photo of food",
    "a photo of a landscape",
    "a photo of a building",
    "a photo of an animal",
    "a photo of a person wearing a t-shirt and jeans",
    "a photo of a man in a suit",
    "a photo of a phone or other gadget",
    "a screenshot of text",
]
# CLIP's learned logit scale; turns cosine similarities into a sharp softmax.
LOGIT_SCALE = 100.0
DEFAULT_MIN_PROBABILITY = 0.5

_prompt_vectors: np.ndarray | None = None


def ao_dai_probability(image_vector: np.ndarray) -> float:
    """Share of the zero-shot softmax that lands on the Ao Dai prompts."""
    logits = LOGIT_SCALE * (get_prompt_vectors() @ image_vector)
    logits -= logits.max()
    weights = np.exp(logits)
    return float(weights[: len(AO_DAI_PROMPTS)].sum() / weights.sum())


def looks_like_ao_dai(image_vector: np.ndarray) -> bool:
    return ao_dai_probability(image_vector) >= get_min_probability()


def get_prompt_vectors() -> np.ndarray:
    global _prompt_vectors
    if _prompt_vectors is None:
        _prompt_vectors = encode_texts([*AO_DAI_PROMPTS, *OTHER_PROMPTS])
    return _prompt_vectors


def get_min_probability() -> float:
    try:
        value = float(os.environ.get("VISUAL_SEARCH_GATE_MIN", DEFAULT_MIN_PROBABILITY))
    except ValueError:
        return DEFAULT_MIN_PROBABILITY
    return max(0.0, min(1.0, value))
