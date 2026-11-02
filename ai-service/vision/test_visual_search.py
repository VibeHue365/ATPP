import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image

from vision.catalog import CatalogProduct, resolve_media_url
from vision.color_features import color_histogram, color_similarity
from vision.schemas import VisualMatchRequest
from vision.similarity import ImageFeatures
from vision.visual_index import VisualIndex
from vision.visual_search import match_products


RED = color_histogram(Image.new("RGB", (60, 90), (200, 20, 30)))
WHITE = color_histogram(Image.new("RGB", (60, 90), (250, 250, 250)))


def features(direction: int, colors: np.ndarray = RED) -> ImageFeatures:
    vector = np.zeros(4, dtype=np.float32)
    vector[direction] = 1.0
    return ImageFeatures(vector, colors)


class ColorFeatureTests(unittest.TestCase):
    def test_same_colour_matches_and_different_colour_does_not(self):
        self.assertAlmostEqual(color_similarity(RED, RED), 1.0, places=5)
        self.assertLess(color_similarity(RED, WHITE), 0.05)

    def test_red_on_both_ends_of_the_hue_wheel_is_one_colour(self):
        warm_red = color_histogram(Image.new("RGB", (40, 40), (220, 30, 10)))
        cool_red = color_histogram(Image.new("RGB", (40, 40), (220, 10, 35)))
        self.assertGreater(color_similarity(warm_red, cool_red), 0.95)

    def test_backdrop_colour_is_removed_from_a_small_model_on_a_white_wall(self):
        photo = Image.new("RGB", (300, 400), (245, 245, 245))
        photo.paste((200, 20, 30), (120, 120, 180, 340))  # The dress, centred and small.
        self.assertGreater(color_similarity(color_histogram(photo), RED), 0.9)


class CatalogTests(unittest.TestCase):
    @patch.dict("os.environ", {"BACKEND_URL": "http://api:3000", "FRONTEND_URL": "http://web:5173"})
    def test_media_urls_follow_the_web_rule(self):
        self.assertEqual(resolve_media_url("https://cdn/x.jpg"), "https://cdn/x.jpg")
        self.assertEqual(resolve_media_url("/uploads/a.jpg"), "http://api:3000/uploads/a.jpg")
        self.assertEqual(resolve_media_url("tuyet_mai.webp"), "http://web:5173/tuyet_mai.webp")


class FakeCatalog:
    def __init__(self, products):
        self.products = products
        self.fail = False
        self.featurized: list[str] = []

    def fetch(self):
        if self.fail:
            raise ConnectionError("backend down")
        return self.products

    def load(self, url):
        if url.endswith("broken"):
            raise OSError("404")
        return url

    def featurize(self, images):
        self.featurized.extend(images)
        return [features(int(url[-1])) for url in images]


class VisualIndexTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.cache = Path(self.temp.name) / "index.npz"
        self.catalog = FakeCatalog([
            CatalogProduct("red-dress", "Red", ("img/0",)),
            CatalogProduct("blue-dress", "Blue", ("img/1", "img/broken")),
            CatalogProduct("green-dress", "Green", ("img/2",)),
        ])

    def tearDown(self):
        self.temp.cleanup()

    def index(self):
        return VisualIndex(
            fetch_products=self.catalog.fetch,
            load_image=self.catalog.load,
            featurize=self.catalog.featurize,
            cache_path=self.cache,
            refresh_seconds=600,
        )

    def test_ranks_by_score_and_applies_threshold_and_limit(self):
        index = self.index()
        self.assertEqual([pid for pid, _ in index.search(features(0), limit=5, min_score=0.9)], ["red-dress"])
        self.assertEqual(len(index.search(features(0), limit=2, min_score=0.0)), 2)

    def test_refresh_only_featurizes_new_photos_and_drops_removed_products(self):
        index = self.index()
        index.refresh()
        self.catalog.products = self.catalog.products[:1] + [CatalogProduct("new", "New", ("img/3",))]
        index.refresh()
        self.assertEqual(self.catalog.featurized, ["img/0", "img/1", "img/2", "img/3"])
        found = {pid for pid, _ in index.search(features(1), limit=5, min_score=0.0)}
        self.assertEqual(found, {"red-dress", "new"})

    def test_first_search_after_warm_up_does_not_build_the_index_twice(self):
        index = self.index()
        index.refresh(only_if_empty=True)  # Warm-up.
        index.search(features(0), limit=5, min_score=0.0)
        self.assertEqual(self.catalog.featurized, ["img/0", "img/1", "img/2"])

    def test_keeps_the_last_index_when_the_catalog_is_unavailable(self):
        index = self.index()
        index.refresh()
        self.catalog.fail = True
        index.refresh()
        self.assertEqual(len(index.search(features(0), limit=5, min_score=0.0)), 3)

    def test_cache_file_lets_a_restart_skip_featurizing(self):
        self.index().refresh()
        self.catalog.featurized.clear()
        restarted = self.index()
        restarted.refresh()
        self.assertEqual(self.catalog.featurized, [])
        self.assertEqual(restarted.search(features(2), limit=1, min_score=0.0)[0][0], "green-dress")


class MatchProductsTests(unittest.TestCase):
    def request(self):
        return VisualMatchRequest(image_base64="aW1n", mime_type="image/jpeg", limit=5)

    @patch("vision.visual_search.get_index")
    @patch("vision.visual_search.looks_like_ao_dai", return_value=False)
    @patch("vision.visual_search.extract_features", return_value=[features(0)])
    @patch("vision.visual_search.decode_base64_image")
    def test_a_photo_without_ao_dai_returns_no_match(self, _decode, _extract, _gate, get_index):
        self.assertEqual(match_products(self.request()), [])
        get_index.assert_not_called()

    @patch("vision.visual_search.get_index")
    @patch("vision.visual_search.looks_like_ao_dai", return_value=True)
    @patch("vision.visual_search.extract_features", return_value=[features(0)])
    @patch("vision.visual_search.decode_base64_image")
    def test_returns_matches_in_the_backend_contract(self, _decode, _extract, _gate, get_index):
        get_index.return_value.search.return_value = [("p1", 0.912345), ("p2", 1.0000001)]
        result = [match.model_dump() for match in match_products(self.request())]
        self.assertEqual(result, [{"productId": "p1", "score": 0.9123}, {"productId": "p2", "score": 1.0}])

    @patch.dict("os.environ", {"VISUAL_SEARCH_ENABLED": "false"})
    @patch("vision.visual_search.decode_base64_image")
    def test_disabled_search_skips_the_model(self, decode):
        self.assertEqual(match_products(self.request()), [])
        decode.assert_not_called()


if __name__ == "__main__":
    unittest.main()
