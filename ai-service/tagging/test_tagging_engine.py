import os
import unittest
from unittest.mock import patch

from tagging.schemas import AllowedTag, TaggingRequest
from tagging.tagging_engine import suggest_tags


class FakeTagVectors:
    def __init__(self, scores):
        self.scores = scores

    def __matmul__(self, _query_vector):
        return self.scores


class FakeVectors:
    def __init__(self, scores):
        self.scores = scores

    def __getitem__(self, key):
        if isinstance(key, slice):
            return FakeTagVectors(self.scores)
        return object()


class FakeModel:
    def __init__(self, scores):
        self.scores = scores
        self.received = []

    def encode(self, sentences, **_kwargs):
        self.received = sentences
        return FakeVectors(self.scores)


class TaggingEngineTests(unittest.TestCase):
    def setUp(self):
        self.request = TaggingRequest(
            entity_type="PRODUCT",
            title="Áo dài truyền thống",
            description="Phù hợp chụp ảnh cưới",
            structured_attributes={"materials": ["SILK"]},
            allowed_tags=[
                AllowedTag(
                    code="TRUYEN_THONG",
                    description="Áo dài mang phong cách truyền thống Việt Nam",
                    group="STYLE",
                ),
                AllowedTag(
                    code="PHU_HOP_LE_CUOI",
                    description="Áo dài phù hợp lễ cưới, đám cưới và lễ hỏi",
                    group="OCCASION",
                ),
                AllowedTag(
                    code="PHA_CACH",
                    description="Áo dài có thiết kế phá cách và sáng tạo",
                    group="STYLE",
                ),
            ],
            taxonomy_version=1,
        )
        self.previous_threshold = os.environ.get("SMART_TAG_MIN_SIMILARITY")
        self.previous_top_k = os.environ.get("SMART_TAG_TOP_K")
        os.environ["SMART_TAG_MIN_SIMILARITY"] = "0.65"
        os.environ["SMART_TAG_TOP_K"] = "2"

    def tearDown(self):
        self._restore("SMART_TAG_MIN_SIMILARITY", self.previous_threshold)
        self._restore("SMART_TAG_TOP_K", self.previous_top_k)

    @patch("tagging.tagging_engine.get_model")
    def test_ranks_allowlisted_tags_and_applies_threshold(self, get_model):
        model = FakeModel([0.82, 0.91, 0.40])
        get_model.return_value = model

        result = suggest_tags(self.request)

        self.assertEqual(result.status, "SUCCESS")
        self.assertEqual(
            [suggestion.code for suggestion in result.suggestions],
            ["PHU_HOP_LE_CUOI", "TRUYEN_THONG"],
        )
        self.assertEqual(result.suggestions[0].confidence, 0.91)

    @patch("tagging.tagging_engine.get_model")
    def test_uses_only_title_description_and_taxonomy_descriptions(self, get_model):
        model = FakeModel([0.80, 0.60, 0.50])
        get_model.return_value = model

        suggest_tags(self.request)

        combined_input = " ".join(model.received)
        self.assertIn(self.request.title, combined_input)
        self.assertIn(self.request.description, combined_input)
        self.assertNotIn("SILK", combined_input)

    @patch("tagging.tagging_engine.get_model")
    def test_returns_only_best_tag_per_group(self, get_model):
        model = FakeModel([0.92, 0.90, 0.89])
        get_model.return_value = model

        result = suggest_tags(self.request)

        self.assertEqual(
            [suggestion.code for suggestion in result.suggestions],
            ["TRUYEN_THONG", "PHU_HOP_LE_CUOI"],
        )

    @patch("tagging.tagging_engine.get_model")
    def test_reports_unavailable_when_local_model_fails(self, get_model):
        get_model.side_effect = RuntimeError("model missing")

        result = suggest_tags(self.request)

        self.assertEqual(result.status, "UNAVAILABLE")
        self.assertEqual(result.error_code, "LOCAL_EMBEDDING_UNAVAILABLE")
        self.assertEqual(result.suggestions, [])

    @staticmethod
    def _restore(name, value):
        if value is None:
            os.environ.pop(name, None)
        else:
            os.environ[name] = value


if __name__ == "__main__":
    unittest.main()
