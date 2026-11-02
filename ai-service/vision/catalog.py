import json
import os
import urllib.parse
import urllib.request
from dataclasses import dataclass


DEFAULT_BACKEND_URL = "http://127.0.0.1:3000"
DEFAULT_FRONTEND_URL = "http://127.0.0.1:5173"
PAGE_SIZE = 24  # The public product list caps `limit` at 24.
IMAGES_PER_PRODUCT = 3
REQUEST_TIMEOUT_SECONDS = 15


@dataclass(frozen=True)
class CatalogProduct:
    product_id: str
    name: str
    image_urls: tuple[str, ...]


def fetch_public_products(max_products: int | None = None) -> list[CatalogProduct]:
    """Products customers can see (ACTIVE + APPROVED), read from the backend's public API.

    The backend already applies the public visibility rules, so the AI service needs
    no database credentials of its own.
    """
    products: list[CatalogProduct] = []
    page = 1
    while True:
        payload = _get_json(f"/products?page={page}&limit={PAGE_SIZE}")
        for item in payload.get("data", []):
            image_urls = tuple(
                resolve_media_url(url)
                for url in (item.get("images") or [])[:IMAGES_PER_PRODUCT]
                if isinstance(url, str) and url.strip()
            )
            if image_urls:
                products.append(
                    CatalogProduct(str(item["_id"]), str(item.get("name", "")), image_urls)
                )
            if max_products and len(products) >= max_products:
                return products
        if page >= int(payload.get("meta", {}).get("totalPages", page)):
            return products
        page += 1


def resolve_media_url(value: str) -> str:
    """Same rule as the web `getMediaUrl`: CDN URLs as-is, `/uploads/...` from the
    backend, any other relative path from the frontend's public folder."""
    url = value.strip()
    if url.startswith(("http://", "https://")):
        return url
    path = url if url.startswith("/") else f"/{url}"
    base = get_media_base_url() if path.startswith("/uploads/") else get_frontend_url()
    return urllib.parse.urljoin(base + "/", path.lstrip("/"))


def _get_json(path: str) -> dict:
    request = urllib.request.Request(
        get_backend_url() + path, headers={"Accept": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def get_backend_url() -> str:
    return (os.environ.get("BACKEND_URL", DEFAULT_BACKEND_URL).strip() or DEFAULT_BACKEND_URL).rstrip("/")


def get_frontend_url() -> str:
    return (os.environ.get("FRONTEND_URL", DEFAULT_FRONTEND_URL).strip() or DEFAULT_FRONTEND_URL).rstrip("/")


def get_media_base_url() -> str:
    return (os.environ.get("MEDIA_BASE_URL", "").strip() or get_backend_url()).rstrip("/")
