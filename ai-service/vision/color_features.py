import numpy as np
from PIL import Image


HUE_BINS = 12
# Black, grey and white sit outside the hue wheel.
ACHROMATIC_BINS = 3
MIN_SATURATION = 0.18
BLACK_MAX_VALUE = 0.2
WHITE_MIN_VALUE = 0.8
BACKGROUND_WEIGHT = 1.0


def color_histogram(image: Image.Image) -> np.ndarray:
    """Colour mix of the garment area, as a histogram that sums to 1.

    Product photos frame the model in the middle, so the centre crop is mostly the
    dress and little background. Colours come from the photo itself because the
    product's `colors` field often lists every variant, not what this photo shows.
    """
    width, height = image.size
    garment = _histogram(image.crop((width * 0.25, height * 0.25, width * 0.75, height * 0.85)))
    # The outer strips are almost always backdrop (walls, studio paper); remove
    # those colours so a small model in front of a big white wall still reads as red.
    strip = max(1, int(min(width, height) * 0.08))
    border = (
        _histogram(image.crop((0, 0, width, strip)))
        + _histogram(image.crop((0, 0, strip, height)))
        + _histogram(image.crop((width - strip, 0, width, height)))
    ) / 3
    foreground = np.clip(garment - BACKGROUND_WEIGHT * border, 0, None)
    if foreground.sum() < 0.15:  # The dress has the backdrop's colour; keep it as is.
        return garment
    return foreground / foreground.sum()


def _histogram(region: Image.Image) -> np.ndarray:
    hsv = np.asarray(region.convert("HSV"), dtype=np.float32) / 255.0
    hue, saturation, value = hsv[..., 0], hsv[..., 1], hsv[..., 2]

    bins = np.empty(hue.shape, dtype=np.int64)
    chromatic = (saturation >= MIN_SATURATION) & (value >= BLACK_MAX_VALUE)
    # Shift by half a bin so red (hue near both 0 and 1) lands in a single bin.
    bins[chromatic] = ((hue[chromatic] * HUE_BINS + 0.5).astype(np.int64)) % HUE_BINS
    bins[value < BLACK_MAX_VALUE] = HUE_BINS
    grey_or_white = ~chromatic & (value >= BLACK_MAX_VALUE)
    bins[grey_or_white] = np.where(value[grey_or_white] >= WHITE_MIN_VALUE, HUE_BINS + 2, HUE_BINS + 1)

    histogram = np.bincount(bins.ravel(), minlength=HUE_BINS + ACHROMATIC_BINS).astype(np.float32)
    return histogram / max(histogram.sum(), 1.0)


def color_similarity(first: np.ndarray, second: np.ndarray) -> float:
    """Histogram intersection: 1 for the same colour mix, 0 for no colour in common."""
    return float(np.minimum(first, second).sum())
