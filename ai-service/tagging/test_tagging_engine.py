import os
import unittest
from unittest.mock import patch

from tagging.schemas import AllowedTag, TaggingRequest
from tagging.tagging_engine import suggest_tags


class FakeResponse:
    text = (
        '{"suggestions":[{"code":"TRUYEN_THONG","confidence":0.87,'
        '"explanation":"Matches the traditional style"},'
        '{"code":"NOT_ALLOWED","confidence":0.99,"explanation":"Ignore"},'
        '{"code":"TRUYEN_THONG","confidence":0.40,"explanation":"Too low"}]}'
    )


class TaggingEngineTests(unittest.TestCase):
    def setUp(self):
        self.request = TaggingRequest(
            entity_type="PRODUCT",
            title="Ao dai truyen thong",
            description="Lua theu hoa",
            structured_attributes={"style": "traditional"},
            allowed_tags=[
                AllowedTag(
                    code="TRUYEN_THONG",
                    description="Ao dai theo phong cach truyen thong",
                )
            ],
            taxonomy_version=1,
        )
        self.previous_key = os.environ.get("GEMINI_API_KEY")

    def tearDown(self):
        if self.previous_key is None:
            os.environ.pop("GEMINI_API_KEY", None)
        else:
            os.environ["GEMINI_API_KEY"] = self.previous_key

    def test_reports_unavailable_without_key(self):
        os.environ.pop("GEMINI_API_KEY", None)

        result = suggest_tags(self.request)

        self.assertEqual(result.status, "UNAVAILABLE")
        self.assertEqual(result.error_code, "MISSING_API_KEY")

    @patch("tagging.tagging_engine.genai.Client")
    def test_keeps_only_allowed_high_confidence_tags(self, client):
        os.environ["GEMINI_API_KEY"] = "test-key"
        client.return_value.models.generate_content.return_value = FakeResponse()

        result = suggest_tags(self.request)

        self.assertEqual(result.status, "SUCCESS")
        self.assertEqual(len(result.suggestions), 1)
        self.assertEqual(result.suggestions[0].code, "TRUYEN_THONG")
        self.assertEqual(result.suggestions[0].confidence, 0.87)

    @patch("tagging.tagging_engine.genai.Client")
    def test_reports_unavailable_when_gemini_fails(self, client):
        os.environ["GEMINI_API_KEY"] = "test-key"
        client.return_value.models.generate_content.side_effect = RuntimeError("down")

        result = suggest_tags(self.request)

        self.assertEqual(result.status, "UNAVAILABLE")
        self.assertEqual(result.error_code, "GEMINI_REQUEST_FAILED")


if __name__ == "__main__":
    unittest.main()
