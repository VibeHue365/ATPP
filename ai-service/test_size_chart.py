import base64
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from fastapi import HTTPException
from pydantic import ValidationError
from size_chart import ImageRequest, RESPONSE_SCHEMA, decode_image, extract, extract_endpoint

class SizeChartTests(unittest.TestCase):
    def request(self):
        return ImageRequest(image_base64=base64.b64encode(b"\x89PNG\r\n\x1a\nexample").decode(), mime_type="image/png")

    def client(self, result):
        generate = Mock(return_value=SimpleNamespace(text=json.dumps(result)))
        return SimpleNamespace(models=SimpleNamespace(generate_content=generate))

    def test_extracts_ranges_without_recommending_or_confirming(self):
        client = self.client({"lengthUnit": "CM", "measurementType": "BODY", "rows": [{"size": " m ", "chest": {"min": 86, "max": 89}}]})
        result = extract(self.request(), client)
        self.assertEqual(result.rows[0].size, "M")
        self.assertEqual(result.rows[0].chest.min, 86)
        self.assertIsNone(result.rows[0].waist)
        self.assertNotIn("status", result.model_dump())
        client.models.generate_content.assert_called_once()

    def test_extracts_explicit_shoulder_and_upper_arm_ranges(self):
        result = extract(self.request(), self.client({"lengthUnit": "CM", "rows": [{
            "size": "M", "shoulder": {"min": 38, "max": 40}, "bicep": {"min": 27, "max": 30}
        }]}))
        self.assertEqual((result.rows[0].shoulder.min, result.rows[0].shoulder.max), (38, 40))
        self.assertEqual((result.rows[0].bicep.min, result.rows[0].bicep.max), (27, 30))

    def test_unknown_units_remove_unreliable_numeric_values(self):
        result = extract(self.request(), self.client({"rows": [{"size": "M", "chest": {"min": 86, "max": 89}, "weight": {"min": 50, "max": 55}}]}))
        self.assertIsNone(result.rows[0].chest)
        self.assertIsNone(result.rows[0].weight)
        self.assertIsNone(result.measurementType)
        self.assertGreater(len(result.warnings), 0)

    def test_single_printed_number_is_not_invented_as_a_range(self):
        result = extract(self.request(), self.client({
            "lengthUnit": "CM", "rows": [{"size": "M", "chest": {"min": 86, "max": 86}, "waist": {"min": 68, "max": 71}, "length": {"min": 138, "max": 138}}]
        }))
        self.assertIsNone(result.rows[0].chest)
        self.assertEqual((result.rows[0].waist.min, result.rows[0].waist.max), (68, 71))
        self.assertEqual((result.rows[0].length.min, result.rows[0].length.max), (138, 138))
        self.assertTrue(any("một số" in warning for warning in result.warnings))

    def test_primary_503_uses_one_fallback_model_attempt(self):
        error = RuntimeError("model busy")
        error.code = 503
        client = self.client({"lengthUnit": "CM", "rows": [{"size": "M", "chest": {"min": 86, "max": 89}}]})
        with patch.dict(os.environ, {"SIZE_CHART_GEMINI_MODEL": "", "SIZE_CHART_GEMINI_FALLBACK_MODEL": "gemini-3.6-flash"}):
            result = extract(self.request(), client)
        self.assertEqual(result.rows[0].chest.max, 89)
        self.assertEqual(client.models.generate_content.call_args.kwargs["model"], "gemini-3.1-flash-lite")
        response = SimpleNamespace(text=json.dumps({"lengthUnit": "CM", "rows": [{"size": "M", "chest": {"min": 86, "max": 89}}]}))
        client.models.generate_content.reset_mock()
        client.models.generate_content.side_effect = [error, response]
        with patch.dict(os.environ, {"SIZE_CHART_GEMINI_MODEL": "", "SIZE_CHART_GEMINI_FALLBACK_MODEL": "gemini-3.6-flash"}):
            result = extract(self.request(), client)
        self.assertEqual(result.rows[0].chest.max, 89)
        self.assertEqual([call.kwargs["model"] for call in client.models.generate_content.call_args_list], ["gemini-3.1-flash-lite", "gemini-3.6-flash"])
        self.assertEqual(RESPONSE_SCHEMA["required"], ["rows"])

        owned_client = self.client({"lengthUnit": "CM", "rows": [{"size": "M", "chest": {"min": 86, "max": 89}}]})
        owned_client.close = Mock()
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-only-key"}), patch("google.genai.Client", return_value=owned_client) as constructor:
            extract(self.request())
        options = constructor.call_args.kwargs["http_options"]
        self.assertEqual(options["timeout"], 35000)
        self.assertEqual(options["retry_options"]["attempts"], 1)
        owned_client.close.assert_called_once()

    def test_never_uses_fallback_for_quota_or_auth_errors(self):
        for code in (400, 401, 403, 429):
            with self.subTest(code=code):
                error = RuntimeError("private SDK response")
                error.code = code
                client = self.client({"rows": []})
                client.models.generate_content.side_effect = error
                with patch.dict(os.environ, {"SIZE_CHART_GEMINI_FALLBACK_MODEL": "gemini-3.6-flash"}), self.assertRaises(RuntimeError):
                    extract(self.request(), client)
                client.models.generate_content.assert_called_once()

    def test_fallback_failure_keeps_primary_503_and_closes_owned_client(self):
        primary = RuntimeError("primary unavailable")
        primary.code = 503
        fallback = RuntimeError("fallback unavailable")
        fallback.code = 429
        client = self.client({"rows": []})
        client.close = Mock()
        client.models.generate_content.side_effect = [primary, fallback]
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-only-key", "SIZE_CHART_GEMINI_FALLBACK_MODEL": "gemini-3.6-flash"}), patch("google.genai.Client", return_value=client), self.assertRaises(RuntimeError) as context:
            extract(self.request())
        self.assertIs(context.exception, primary)
        self.assertEqual(client.models.generate_content.call_count, 2)
        client.close.assert_called_once()

    def test_explicit_model_override_and_safe_quota_error(self):
        client = self.client({"rows": []})
        with patch.dict(os.environ, {"SIZE_CHART_GEMINI_MODEL": "gemini-3.6-flash"}):
            extract(self.request(), client)
        self.assertEqual(client.models.generate_content.call_args.kwargs["model"], "gemini-3.6-flash")
        error = RuntimeError("private quota details")
        error.code = 429
        with patch("size_chart.extract", side_effect=error), self.assertRaises(HTTPException) as context:
            extract_endpoint(self.request())
        self.assertEqual(context.exception.status_code, 429)
        self.assertNotIn("private", context.exception.detail)

    def test_model_unavailable_is_reported_without_private_sdk_details(self):
        error = RuntimeError("private model response")
        error.code = 503
        with patch("size_chart.extract", side_effect=error), self.assertRaises(HTTPException) as context:
            extract_endpoint(self.request())
        self.assertEqual(context.exception.status_code, 503)
        self.assertIn("Gemini", context.exception.detail)
        self.assertNotIn("private", context.exception.detail)

    def test_model_timeout_remains_distinct_from_unavailable(self):
        error = RuntimeError("private timeout response")
        error.code = 504
        with patch("size_chart.extract", side_effect=error), self.assertRaises(HTTPException) as context:
            extract_endpoint(self.request())
        self.assertEqual(context.exception.status_code, 504)
        self.assertIn("quá thời gian", context.exception.detail)
        self.assertNotIn("private", context.exception.detail)

    def test_rejects_reversed_ranges_and_injected_confirmation_fields(self):
        for result in [
            {"rows": [{"size": "M", "chest": {"min": 90, "max": 80}}]},
            {"rows": [], "status": "CONFIRMED"},
            {"rows": [{"size": "M", "ease": 2}]},
            {"rows": [{"size": "   "}]},
        ]:
            with self.subTest(result=result), self.assertRaises((ValueError, ValidationError)):
                extract(self.request(), self.client(result))

    def test_rejects_bad_base64_and_mime_mismatch(self):
        for request in [ImageRequest(image_base64="bad!", mime_type="image/png"), ImageRequest(image_base64=self.request().image_base64, mime_type="image/jpeg")]:
            with self.assertRaises(ValueError):
                decode_image(request)

    def test_missing_key_returns_safe_error(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            with self.assertRaises(HTTPException) as context:
                extract_endpoint(self.request())
        self.assertEqual(context.exception.status_code, 503)
        self.assertNotIn("API_KEY", context.exception.detail)

    def test_invalid_image_does_not_call_gemini(self):
        client = self.client({"rows": []})
        with self.assertRaises(ValueError):
            extract(ImageRequest(image_base64="bad!", mime_type="image/png"), client)
        client.models.generate_content.assert_not_called()

if __name__ == "__main__":
    unittest.main()
