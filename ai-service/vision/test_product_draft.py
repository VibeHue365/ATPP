import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image

from vision.clip_engine import InvalidImageError
from vision.product_describer import (
    ATTRIBUTE_GROUPS,
    DetectedAttribute,
    build_description,
    build_name,
    describe_product,
    detect_attributes,
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

    @patch("vision.product_draft.describe_product")
    @patch("vision.product_draft.download_image")
    def test_describes_the_photos_that_loaded(self, download, describe):
        download.side_effect = [PHOTO, OSError("404")]
        describe.return_value.status = "SUCCESS"
        describe.return_value.attributes = [color("RED", "đỏ")]
        describe.return_value.name = "Áo dài đỏ"
        describe.return_value.description = "Mẫu áo dài màu đỏ."
        describe.return_value.colors = ["RED"]

        response = draft_from_photos(self.request("https://a/1.jpg", "https://a/2.jpg"))

        self.assertEqual(len(describe.call_args.args[0]), 1)
        self.assertEqual(response.model_dump()["attributes"][0]["key"], "RED")
        self.assertEqual((response.name, response.colors), ("Áo dài đỏ", ["RED"]))


if __name__ == "__main__":
    unittest.main()
