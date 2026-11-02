import logging
import os
import threading
import time
from collections.abc import Callable
from pathlib import Path

import numpy as np
from PIL import Image

from .catalog import CatalogProduct, fetch_public_products
from .clip_engine import download_image, get_model_name
from .similarity import ImageFeatures, extract_features, product_score


logger = logging.getLogger(__name__)

DEFAULT_REFRESH_SECONDS = 600
RETRY_AFTER_FAILURE_SECONDS = 30
DEFAULT_CACHE_PATH = "model-cache/visual-index.npz"


class VisualIndex:
    """Image features of every public product, refreshed from the backend catalog.

    Features are cached per image URL, so a refresh only downloads photos it has
    not seen and the cache file lets a restart skip the work entirely.
    """

    def __init__(
        self,
        fetch_products: Callable[[], list[CatalogProduct]] = fetch_public_products,
        load_image: Callable[[str], Image.Image] = download_image,
        featurize: Callable[[list[Image.Image]], list[ImageFeatures]] = extract_features,
        cache_path: Path | None = None,
        refresh_seconds: float | None = None,
    ):
        self._fetch_products = fetch_products
        self._load_image = load_image
        self._featurize = featurize
        self._cache_path = cache_path if cache_path is not None else get_cache_path()
        self._refresh_seconds = refresh_seconds if refresh_seconds is not None else get_refresh_seconds()
        self._by_url: dict[str, ImageFeatures] = {}
        self._products: dict[str, list[ImageFeatures]] = {}
        self._refreshed_at: float | None = None
        self._refresh_lock = threading.Lock()
        self._cache_loaded = False

    def search(self, query: ImageFeatures, limit: int, min_score: float) -> list[tuple[str, float]]:
        self._ensure_fresh()
        products = self._products  # Swapped atomically by refresh(); never mutated.
        scores = [(product_id, product_score(query, images)) for product_id, images in products.items()]
        scores = [item for item in scores if item[1] >= min_score]
        return sorted(scores, key=lambda item: item[1], reverse=True)[:limit]

    def refresh(self, only_if_empty: bool = False) -> None:
        with self._refresh_lock:
            if only_if_empty and self._refreshed_at is not None:
                return  # A warm-up or another request built it while we waited.
            self._load_cache()
            try:
                catalog = self._fetch_products()
            except Exception as error:  # noqa: BLE001 - keep serving the last good index
                logger.warning("Visual index refresh skipped, catalog unavailable: %s", error)
                # Try again soon instead of waiting a full refresh period.
                self._refreshed_at = time.monotonic() - self._refresh_seconds + RETRY_AFTER_FAILURE_SECONDS
                return

            known = dict(self._by_url)
            products: dict[str, list[ImageFeatures]] = {}
            for product in catalog:
                missing = [url for url in product.image_urls if url not in known]
                images, urls = [], []
                for url in missing:
                    try:
                        images.append(self._load_image(url))
                        urls.append(url)
                    except Exception as error:  # noqa: BLE001 - one broken photo must not stop the index
                        logger.warning("Visual index skipped %s: %s", url, error)
                if images:
                    known.update(zip(urls, self._featurize(images)))
                features = [known[url] for url in product.image_urls if url in known]
                if features:
                    products[product.product_id] = features

            used = {url for product in catalog for url in product.image_urls}
            self._by_url = {url: value for url, value in known.items() if url in used}
            self._products = products
            self._refreshed_at = time.monotonic()
            self._save_cache()

    def _ensure_fresh(self) -> None:
        if self._refreshed_at is None:
            self.refresh(only_if_empty=True)  # The first search has to wait for an index.
        elif time.monotonic() - self._refreshed_at >= self._refresh_seconds and not self._refresh_lock.locked():
            threading.Thread(target=self.refresh, name="visual-index-refresh", daemon=True).start()

    def _load_cache(self) -> None:
        if self._cache_loaded:
            return
        self._cache_loaded = True
        if not self._cache_path.exists():
            return
        try:
            with np.load(self._cache_path, allow_pickle=False) as data:
                if str(data["model"]) != get_model_name():
                    return
                self._by_url = {
                    str(url): ImageFeatures(vector, colors)
                    for url, vector, colors in zip(data["urls"], data["vectors"], data["colors"])
                }
        except Exception as error:  # noqa: BLE001 - a bad cache only costs a rebuild
            logger.warning("Visual index cache ignored: %s", error)

    def _save_cache(self) -> None:
        if not self._by_url:
            return
        try:
            self._cache_path.parent.mkdir(parents=True, exist_ok=True)
            urls = list(self._by_url)
            np.savez(
                self._cache_path,
                model=np.array(get_model_name()),
                urls=np.array(urls),
                vectors=np.stack([self._by_url[url].vector for url in urls]),
                colors=np.stack([self._by_url[url].colors for url in urls]),
            )
        except Exception as error:  # noqa: BLE001 - the in-memory index still works
            logger.warning("Visual index cache not saved: %s", error)


def get_refresh_seconds() -> float:
    try:
        return max(30.0, float(os.environ.get("VISUAL_INDEX_REFRESH_SECONDS", DEFAULT_REFRESH_SECONDS)))
    except ValueError:
        return DEFAULT_REFRESH_SECONDS


def get_cache_path() -> Path:
    return Path(os.environ.get("VISUAL_INDEX_CACHE_PATH", DEFAULT_CACHE_PATH))
