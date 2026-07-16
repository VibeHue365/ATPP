import json
import os
import time

from google import genai
from google.genai import types

from .schemas import TaggingRequest, TaggingResponse, TagSuggestion


PROMPT_VERSION = "smart-tag-v1"
DEFAULT_GEMINI_TIMEOUT_MS = 6000
MIN_CONFIDENCE = 0.65


def suggest_tags(request: TaggingRequest) -> TaggingResponse:
    api_key = os.environ.get("GEMINI_API_KEY")
    model = os.environ.get("SMART_TAG_GEMINI_MODEL", "gemini-3.5-flash")
    if not api_key:
        return TaggingResponse(
            status="UNAVAILABLE",
            suggestions=[],
            model=model,
            prompt_version=PROMPT_VERSION,
            latency_ms=0,
            error_code="MISSING_API_KEY",
        )

    allowed_codes = {tag.code for tag in request.allowed_tags}
    prompt = build_prompt(request)
    started = time.monotonic()
    try:
        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=get_timeout_ms()),
        )
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        parsed = json.loads(response.text or "{}")
    except Exception as error:
        # Do not expose request content or API credentials in logs or responses.
        print(f"[smart-tagging] Gemini request failed: {type(error).__name__}")
        return TaggingResponse(
            status="UNAVAILABLE",
            suggestions=[],
            model=model,
            prompt_version=PROMPT_VERSION,
            latency_ms=elapsed_ms(started),
            error_code="GEMINI_REQUEST_FAILED",
        )

    suggestions: list[TagSuggestion] = []
    for item in parsed.get("suggestions", []):
        if not isinstance(item, dict):
            continue
        code = item.get("code")
        if not isinstance(code, str) or code not in allowed_codes:
            continue
        try:
            confidence = max(0.0, min(1.0, float(item.get("confidence", 0))))
        except (TypeError, ValueError):
            continue
        if confidence < MIN_CONFIDENCE:
            continue
        suggestions.append(
            TagSuggestion(
                code=code,
                confidence=confidence,
                explanation=str(item.get("explanation", "AI suggestion"))[:500],
            )
        )

    return TaggingResponse(
        status="SUCCESS",
        suggestions=suggestions,
        model=model,
        prompt_version=PROMPT_VERSION,
        latency_ms=elapsed_ms(started),
    )


def build_prompt(request: TaggingRequest) -> str:
    return (
        "Return JSON only: {\"suggestions\":[{\"code\":string,\"confidence\":number,"
        "\"explanation\":string}]}. Select only codes from the provided allowlist. "
        "Never infer sensitive attributes, pricing, or financial information.\n"
        f"Entity: {request.entity_type}\n"
        f"Title: {request.title}\n"
        f"Description: {request.description}\n"
        "Structured attributes: "
        f"{json.dumps(request.structured_attributes, ensure_ascii=False)}\n"
        "Allowed tags: "
        f"{json.dumps([tag.model_dump() for tag in request.allowed_tags], ensure_ascii=False)}"
    )


def get_timeout_ms() -> int:
    try:
        configured = int(
            os.environ.get("SMART_TAG_GEMINI_TIMEOUT_MS", DEFAULT_GEMINI_TIMEOUT_MS)
        )
    except ValueError:
        return DEFAULT_GEMINI_TIMEOUT_MS
    return min(max(configured, 1000), 30000)


def elapsed_ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)
