import itertools
import json
import unicodedata
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image

from vision import gemini_attributes
from vision.clip_engine import InvalidImageError
from vision.gemini_attributes import MATERIAL_LABELS, MOTIF_LABELS, OCCASION_LABELS, STYLE_LABELS
from vision.product_describer import (
    ATTRIBUTE_GROUPS,
    COLORS,
    DetectedAttribute,
    build_description,
    build_name,
    describe_product,
    detect_attributes,
    merge_attributes,
)
from vision.product_draft import draft_from_photos
from vision.schemas import ProductDraftRequest


def color(key, label, on_cover=True):
    return DetectedAttribute("color", key, label, 0.9, on_cover)


def option(group, key):
    return next(o for o in ATTRIBUTE_GROUPS[group] if o.key == key)


PHOTO = Image.new("RGB", (40, 60), (200, 20, 30))


class ListingTextTests(unittest.TestCase):
    def test_name_uses_cover_colour_and_a_visible_pattern(self):
        attributes = [color("RED", "đỏ"), DetectedAttribute("pattern", "EMBROIDERED", "thêu hoa", 0.8)]
        self.assertEqual(build_name(attributes), "Áo dài đỏ thêu hoa")

    def test_plain_pattern_and_variant_colours_stay_out_of_the_name(self):
        attributes = [
            color("WHITE", "trắng"),
            color("PINK", "hồng", on_cover=False),
            DetectedAttribute("pattern", "PLAIN", "trơn", 0.9),
        ]
        self.assertEqual(build_name(attributes), "Áo dài trắng")

    def test_no_name_without_a_confident_cover_attribute(self):
        self.assertEqual(build_name([color("GOLD", "vàng", on_cover=False)]), "")

    def test_male_and_avant_garde_appear_in_the_name(self):
        attributes = [
            DetectedAttribute("gender", "MALE", "nam", 0.9),
            DetectedAttribute("style", "PHA_CACH", "phá cách", 0.95),
            color("BLACK", "đen"),
        ]
        self.assertEqual(build_name(attributes), "Áo dài nam phá cách đen")

    def test_description_separates_cover_colours_from_other_variants(self):
        text = build_description([
            color("RED", "đỏ"),
            color("GOLD", "vàng"),
            color("BLUE", "xanh dương", on_cover=False),
            DetectedAttribute("pattern", "BROCADE", "gấm hoa văn", 0.8),
        ])
        self.assertIn("Mẫu áo dài màu đỏ phối vàng, chất liệu gấm dệt hoa văn nổi bật.", text)
        self.assertIn("Có thêm các màu: xanh dương.", text)
        self.assertLessEqual(len(text), 1000)

    def test_no_description_when_nothing_was_detected(self):
        self.assertEqual(build_description([]), "")

    def test_gemini_attributes_give_a_descriptive_name_without_the_colour(self):
        attributes = [
            color("PINK", "hồng"),
            DetectedAttribute("pattern", "PRINTED", "in họa tiết", 0.7),
            DetectedAttribute("style", "CACH_TAN", "cách tân", 0.9),
            DetectedAttribute("material", "LUA", "lụa", 0.7),
            DetectedAttribute("motif", "HOA_SEN", "hoa sen", 0.9),
            DetectedAttribute("occasion", "PHU_HOP_LE_CUOI", "lễ cưới", 0.7),
            DetectedAttribute("occasion", "CHUP_ANH_KY_YEU", "kỷ yếu", 0.7),
        ]
        self.assertEqual(build_name(attributes), "Áo dài cách tân lụa hoa sen")
        self.assertEqual(
            build_description(attributes),
            "Mẫu áo dài phong cách cách tân, chất liệu lụa, màu hồng, họa tiết hoa sen. "
            "Gam hồng nhẹ nhàng, tôn nét dịu dàng, nữ tính. Phù hợp lễ cưới và chụp ảnh kỷ yếu.",
        )

    def test_a_plain_motif_or_style_alone_keeps_the_colour_in_the_name(self):
        attributes = [
            color("RED", "đỏ"),
            DetectedAttribute("style", "TRUYEN_THONG", "truyền thống", 0.9),
            DetectedAttribute("motif", "TRON", "trơn", 0.9),
        ]
        self.assertEqual(build_name(attributes), "Áo dài truyền thống đỏ")
        self.assertIn("thiết kế trơn tối giản", build_description(attributes))

    def test_gemini_style_replaces_the_clip_style(self):
        merged = merge_attributes(
            [color("RED", "đỏ"), DetectedAttribute("style", "PHA_CACH", "phá cách", 0.95)],
            [DetectedAttribute("style", "CACH_TAN", "cách tân", 0.9)],
        )
        self.assertEqual([(a.group, a.key) for a in merged], [("color", "RED"), ("style", "CACH_TAN")])


# The smart-tag keyword rules read the product name and description. Fixed wording in the
# draft must not trigger a tag the photo did not show (e.g. "sự kiện" on every product).
TAXONOMY_FILE = Path(__file__).resolve().parents[2] / "backend/scripts/data/smart-tag-taxonomy.default.json"


def normalize_like_smart_tag(value):
    # Same normalisation as backend rule-based-tagging.service.ts.
    text = unicodedata.normalize("NFD", value)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return " ".join(text.replace("đ", "d").replace("Đ", "d").lower().split())


@unittest.skipUnless(TAXONOMY_FILE.exists(), "smart-tag taxonomy file is not available (e.g. inside the Docker image)")
class SmartTagKeywordTests(unittest.TestCase):
    def setUp(self):
        data = json.loads(TAXONOMY_FILE.read_text(encoding="utf-8"))
        definitions = data if isinstance(data, list) else next(v for v in data.values() if isinstance(v, list))
        self.keywords = {
            d["code"]: [normalize_like_smart_tag(k) for k in (d.get("ruleConfig") or {}).get("keywords", [])]
            for d in definitions
        }

    def matched_tags(self, text):
        normalized = normalize_like_smart_tag(text)
        return {code for code, words in self.keywords.items() if any(w and w in normalized for w in words)}

    def test_fixed_wording_never_suggests_a_tag_the_photo_did_not_show(self):
        patterns = [None, *ATTRIBUTE_GROUPS["pattern"]]
        for cover, variant, pattern, male, avant_garde in itertools.product(
            COLORS, [None, *COLORS], patterns, [False, True], [False, True]
        ):
            attributes = [color(cover, COLORS[cover][0])]
            if variant and variant != cover:
                attributes.append(color(variant, COLORS[variant][0], on_cover=False))
            if pattern:
                attributes.append(DetectedAttribute("pattern", pattern.key, pattern.label, 0.8))
            if male:
                attributes.append(DetectedAttribute("gender", "MALE", "nam", 0.9))
            if avant_garde:
                attributes.append(DetectedAttribute("style", "PHA_CACH", "phá cách", 0.95))
            text = f"{build_name(attributes)} {build_description(attributes)}"
            allowed = {"PHA_CACH"} if avant_garde else set()
            with self.subTest(text=text):
                self.assertLessEqual(self.matched_tags(text), allowed)

    def test_gemini_wording_only_suggests_the_style_and_occasions_it_found(self):
        for style, material, motif in itertools.product(
            [None, *STYLE_LABELS], [None, *MATERIAL_LABELS], [None, *MOTIF_LABELS]
        ):
            attributes = [color("RED", "đỏ")]
            if style:
                attributes.append(DetectedAttribute("style", style, STYLE_LABELS[style], 0.9))
            if material:
                attributes.append(DetectedAttribute("material", material, MATERIAL_LABELS[material], 0.9))
            if motif:
                attributes.append(DetectedAttribute("motif", motif, MOTIF_LABELS[motif], 0.9))
            text = f"{build_name(attributes)} {build_description(attributes)}"
            with self.subTest(text=text):
                self.assertLessEqual(self.matched_tags(text), {style} if style else set())

    def test_each_occasion_sentence_suggests_exactly_that_occasion(self):
        for occasions in itertools.combinations(OCCASION_LABELS, 2):
            attributes = [color("WHITE", "trắng")] + [
                DetectedAttribute("occasion", key, OCCASION_LABELS[key], 0.7) for key in occasions
            ]
            with self.subTest(occasions=occasions):
                self.assertEqual(self.matched_tags(build_description(attributes)), set(occasions))


def gemini_reply(**overrides):
    reply = {
        "style": "CACH_TAN", "style_certainty": "HIGH",
        "material": "LUA", "material_certainty": "MEDIUM",
        "motif": "HOA_SEN", "motif_certainty": "HIGH",
        "occasions": ["PHU_HOP_LE_CUOI"], "occasions_certainty": "MEDIUM",
    }
    reply.update(overrides)
    return json.dumps(reply)


class FakeGemini:
    """Stands in for google.genai.Client; returns a JSON text or raises."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = 0
        self.models = self

    def generate_content(self, **_kwargs):
        self.calls += 1
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return type("Response", (), {"text": reply})()


class GeminiAttributesTests(unittest.TestCase):
    def setUp(self):
        gemini_attributes.clear_cache()

    def photo(self, rgb=(200, 20, 30)):
        return Image.new("RGB", (40, 60), rgb)

    def test_maps_certain_answers_and_drops_low_or_unknown_ones(self):
        client = FakeGemini(gemini_reply(material_certainty="LOW", motif="UNKNOWN"))
        found = gemini_attributes.analyze([self.photo()], client=client)
        self.assertEqual(
            [(a.group, a.key, a.label, a.confidence) for a in found],
            [("style", "CACH_TAN", "cách tân", 0.9), ("occasion", "PHU_HOP_LE_CUOI", "lễ cưới", 0.7)],
        )

    def test_any_failure_returns_none(self):
        for reply in (
            RuntimeError("503 UNAVAILABLE"),
            TimeoutError("deadline"),
            "not json",
            gemini_reply(style="AO_BA_BA"),  # outside the allowed list
            gemini_reply(occasions=["PHU_HOP_LE_CUOI", "LE_HOI_TRUYEN_THONG", "BIEU_DIEN_SU_KIEN"]),
        ):
            with self.subTest(reply=str(reply)[:40]):
                gemini_attributes.clear_cache()
                self.assertIsNone(gemini_attributes.analyze([self.photo()], client=FakeGemini(reply)))

    def test_the_same_photos_are_answered_from_the_cache(self):
        client = FakeGemini(gemini_reply(), gemini_reply(style="TRUYEN_THONG"))
        first = gemini_attributes.analyze([self.photo()], client=client)
        again = gemini_attributes.analyze([self.photo()], client=client)
        other = gemini_attributes.analyze([self.photo((10, 10, 200))], client=client)
        self.assertEqual((client.calls, first, again[0].key, other[0].key), (2, again, "CACH_TAN", "TRUYEN_THONG"))

    def test_a_failure_is_not_cached(self):
        client = FakeGemini(RuntimeError("503"), gemini_reply())
        self.assertIsNone(gemini_attributes.analyze([self.photo()], client=client))
        self.assertEqual(gemini_attributes.analyze([self.photo()], client=client)[0].key, "CACH_TAN")

    @patch.dict("os.environ", {"GEMINI_API_KEY": "", "PRODUCT_DRAFT_GEMINI_API_KEY": ""})
    def test_without_a_key_gemini_is_skipped(self):
        self.assertFalse(gemini_attributes.is_enabled())
        self.assertIsNone(gemini_attributes.analyze([self.photo()]))

    @patch.dict("os.environ", {"GEMINI_API_KEY": "k", "PRODUCT_DRAFT_GEMINI_ENABLED": "false"})
    def test_it_can_be_switched_off(self):
        self.assertFalse(gemini_attributes.is_enabled())


class DetectAttributesTests(unittest.TestCase):
    @patch("vision.product_describer.rank_colors", return_value=[])
    @patch("vision.product_describer.classify")
    def test_reports_only_confident_and_meaningful_winners(self, classify, _colors):
        classify.side_effect = lambda _vector, group: {
            "pattern": (option("pattern", "EMBROIDERED"), 0.6),  # below 0.65
            "gender": (option("gender", "FEMALE"), 0.99),  # women are the default, not reported
            "style": (option("style", "CACH_TAN"), 0.95),  # only avant-garde is reliable
        }[group]
        self.assertEqual(detect_attributes([PHOTO], np.ones((1, 4))), [])

    @patch("vision.product_describer.classify")
    @patch("vision.product_describer.rank_colors")
    def test_collects_colours_per_photo_and_marks_variants(self, rank_colors, classify):
        rank_colors.side_effect = [[("RED", 0.9), ("GOLD", 0.35)], [("BLUE", 0.7), ("BLACK", 0.5)]]
        classify.side_effect = lambda _vector, group: (option(group, ATTRIBUTE_GROUPS[group][0].key), 0.1)
        found = detect_attributes([PHOTO, PHOTO], np.ones((2, 4)))
        self.assertEqual(
            [(a.key, a.on_cover) for a in found],
            [("RED", True), ("GOLD", True), ("BLUE", False)],  # second photo adds its main colour only
        )

    @patch("vision.product_describer.looks_like_ao_dai", return_value=False)
    @patch("vision.product_describer.encode_images", return_value=np.ones((1, 4)))
    def test_a_cover_without_ao_dai_gets_no_suggestion(self, _encode, _gate):
        draft = describe_product([PHOTO])
        self.assertEqual((draft.status, draft.name, draft.attributes), ("NOT_AO_DAI", "", []))


class DraftFromPhotosTests(unittest.TestCase):
    def request(self, *urls):
        return ProductDraftRequest(image_urls=list(urls) or ["https://res.cloudinary.com/x/a.jpg"])

    @patch.dict("os.environ", {"PRODUCT_DRAFT_ENABLED": "false"})
    @patch("vision.product_draft.download_image")
    def test_disabled_feature_skips_the_model(self, download):
        self.assertEqual(draft_from_photos(self.request()).status, "UNAVAILABLE")
        download.assert_not_called()

    def test_rejects_non_http_urls(self):
        with self.assertRaises(InvalidImageError):
            draft_from_photos(self.request("file:///etc/passwd"))

    @patch("vision.product_draft.download_image", side_effect=OSError("404"))
    def test_fails_when_no_photo_can_be_loaded(self, _download):
        with self.assertRaises(InvalidImageError):
            draft_from_photos(self.request())

    @patch("vision.product_draft.analyze_with_gemini", return_value=None)
    @patch("vision.product_draft.describe_product")
    @patch("vision.product_draft.download_image")
    def test_describes_the_photos_that_loaded(self, download, describe, _gemini):
        download.side_effect = [PHOTO, OSError("404")]
        describe.return_value.status = "SUCCESS"
        describe.return_value.attributes = [color("RED", "đỏ")]
        describe.return_value.name = "Áo dài đỏ"
        describe.return_value.description = "Mẫu áo dài màu đỏ."
        describe.return_value.colors = ["RED"]

        response = draft_from_photos(self.request("https://a/1.jpg", "https://a/2.jpg"))

        self.assertEqual(len(describe.call_args.args[0]), 1)
        self.assertEqual(response.model_dump()["attributes"][0]["key"], "RED")
        self.assertEqual((response.name, response.colors, response.source), ("Áo dài đỏ", ["RED"], "CLIP_ONLY"))

    @patch("vision.product_draft.analyze_with_gemini")
    @patch("vision.product_draft.describe_product")
    @patch("vision.product_draft.download_image", return_value=PHOTO)
    def test_adds_what_gemini_read_to_the_clip_suggestion(self, _download, describe, gemini):
        describe.return_value.status = "SUCCESS"
        describe.return_value.attributes = [color("PINK", "hồng")]
        gemini.return_value = [
            DetectedAttribute("style", "CACH_TAN", "cách tân", 0.9),
            DetectedAttribute("material", "LUA", "lụa", 0.7),
            DetectedAttribute("motif", "HOA_SEN", "hoa sen", 0.9),
        ]

        response = draft_from_photos(self.request())

        self.assertEqual((response.source, response.name, response.colors), ("GEMINI", "Áo dài cách tân lụa hoa sen", ["PINK"]))

    @patch("vision.product_draft.analyze_with_gemini")
    @patch("vision.product_draft.describe_product")
    @patch("vision.product_draft.download_image", return_value=PHOTO)
    def test_gemini_is_not_asked_about_a_cover_without_ao_dai(self, _download, describe, gemini):
        describe.return_value.status = "NOT_AO_DAI"
        describe.return_value.attributes = []
        describe.return_value.name = ""
        describe.return_value.description = ""
        describe.return_value.colors = []

        self.assertEqual(draft_from_photos(self.request()).status, "NOT_AO_DAI")
        gemini.assert_not_called()


if __name__ == "__main__":
    unittest.main()
