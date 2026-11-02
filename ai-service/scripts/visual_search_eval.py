"""Measure visual search quality on the real catalog (VIB-93 spike).

Usage (from ai-service/, backend running):
    python -m scripts.visual_search_eval --negatives path/to/non_ao_dai_photos --query photo.jpg

Re-upload test: every catalog photo is cropped, resized, darkened and re-compressed
(like a screenshot of a dress seen online), and its product must come back on top.
Variant test: a product's first photo must find the product through its *other*
photos; those are usually other colours, so this only shows how much colour weighs.
The negatives folder holds photos that are not Ao Dai to check the rejection rule.
"""
import argparse
import io
import pathlib
import time

import numpy as np
from PIL import Image, ImageEnhance

from vision.ao_dai_gate import ao_dai_probability
from vision.catalog import fetch_public_products
from vision.clip_engine import download_image, open_image
from vision.similarity import ImageFeatures, extract_features, product_score


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-products", type=int, default=200)
    parser.add_argument("--negatives", type=pathlib.Path)
    parser.add_argument("--query", type=pathlib.Path, action="append", default=[])
    args = parser.parse_args()

    products = fetch_public_products(args.max_products)
    names = {product.product_id: product.name for product in products}
    print(f"Catalog: {len(products)} public products with images")

    photos: dict[str, list[Image.Image]] = {}
    failed = 0
    started = time.monotonic()
    for product in products:
        for url in product.image_urls:
            try:
                image = download_image(url)
            except Exception as error:  # noqa: BLE001 - report and keep measuring
                failed += 1
                print(f"  skip {url}: {type(error).__name__}")
                continue
            photos.setdefault(product.product_id, []).append(image)
    downloaded = time.monotonic() - started

    started = time.monotonic()
    features = {product_id: extract_features(images) for product_id, images in photos.items()}
    image_count = sum(len(images) for images in photos.values())
    print(f"Downloaded {image_count} images in {downloaded:.1f}s, {failed} failed; "
          f"features {1000 * (time.monotonic() - started) / max(image_count, 1):.0f} ms/image")

    reupload_queries = [
        (product_id, extract_features([reupload(image)])[0])
        for product_id, images in photos.items()
        for image in images
    ]
    report_ranking("Re-upload test", reupload_queries, features)

    variant_ids = {product_id for product_id, own in features.items() if len(own) >= 2}
    report_ranking(
        "Variant test",
        [(product_id, features[product_id][0]) for product_id in variant_ids],
        {product_id: own[1:] if product_id in variant_ids else own for product_id, own in features.items()},
    )

    report_gate("Catalog photos accepted as Ao Dai",
                [image.vector for own in features.values() for image in own], expect=True)
    if args.negatives:
        negatives = [
            extract_features([open_image(path.read_bytes())])[0].vector
            for path in sorted(args.negatives.iterdir())
            if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        ]
        report_gate("Non-Ao-Dai photos rejected", negatives, expect=False)

    for path in args.query:
        query = extract_features([open_image(path.read_bytes())])[0]
        print(f"\nQuery {path.name}: ao dai probability {ao_dai_probability(query.vector):.2f}")
        for product_id, score in rank_products(query, features)[:5]:
            print(f"  {score:.3f}  {names[product_id]}")


def reupload(image: Image.Image) -> Image.Image:
    width, height = image.size
    cropped = image.crop((width * 0.08, height * 0.06, width * 0.92, height * 0.94))
    cropped = cropped.resize((int(cropped.width * 0.7), int(cropped.height * 0.7)))
    cropped = ImageEnhance.Brightness(cropped).enhance(0.9)
    buffer = io.BytesIO()
    cropped.save(buffer, format="JPEG", quality=70)
    return open_image(buffer.getvalue())


def rank_products(query: ImageFeatures, features: dict[str, list[ImageFeatures]]) -> list[tuple[str, float]]:
    scores = [(product_id, product_score(query, own)) for product_id, own in features.items()]
    return sorted(scores, key=lambda item: item[1], reverse=True)


def report_ranking(label: str, queries: list[tuple[str, ImageFeatures]], features: dict[str, list[ImageFeatures]]) -> None:
    if not queries:
        print(f"{label}: no queries")
        return
    ranks, own_scores, other_scores = [], [], []
    for product_id, query in queries:
        ranked = rank_products(query, features)
        ranks.append(1 + [item[0] for item in ranked].index(product_id))
        own_scores.append(dict(ranked)[product_id])
        other_scores.append(next(score for other, score in ranked if other != product_id))
    ranks_array = np.array(ranks)
    print(f"\n{label} over {len(ranks)} queries: "
          f"top-1 {np.mean(ranks_array <= 1):.0%}, top-5 {np.mean(ranks_array <= 5):.0%}")
    print_distribution("  correct product score", own_scores)
    print_distribution("  best other product score", other_scores)
    for threshold in (0.62, 0.70, 0.80, 0.85):
        print(f"  threshold {threshold:.2f}: keeps {np.mean(np.array(own_scores) >= threshold):.0%} "
              f"of correct products, {np.mean(np.array(other_scores) >= threshold):.0%} of runner-ups")


def report_gate(label: str, image_vectors: list[np.ndarray], expect: bool) -> None:
    if not image_vectors:
        return
    probabilities = [ao_dai_probability(vector) for vector in image_vectors]
    print()
    for threshold in (0.3, 0.5, 0.7):
        passed = np.mean([(p >= threshold) == expect for p in probabilities])
        print(f"{label} @gate {threshold}: {passed:.0%} of {len(probabilities)}")


def print_distribution(label: str, scores: list[float]) -> None:
    p10, p50, p90 = np.percentile(scores, [10, 50, 90])
    print(f"{label}: p10 {p10:.3f} | median {p50:.3f} | p90 {p90:.3f}")


if __name__ == "__main__":
    main()
