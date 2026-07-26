import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile

app = FastAPI(title="VibeHue OCR Service")

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png"}
EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ocr")
async def run_ocr(file: UploadFile = File(...)) -> dict[str, object]:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Only image/jpeg and image/png are supported",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File is empty")

    suffix = EXTENSIONS[file.content_type]
    with tempfile.TemporaryDirectory(prefix="vibehue-ocr-") as temp_dir:
        input_path = Path(temp_dir) / f"input{suffix}"
        output_base = Path(temp_dir) / "output"
        output_tsv = Path(temp_dir) / "output.tsv"
        input_path.write_bytes(content)

        command = [
            "tesseract",
            str(input_path),
            str(output_base),
            "-l",
            os.getenv("TESSERACT_LANG", "vie+eng"),
            "--psm",
            os.getenv("TESSERACT_PSM", "6"),
            "tsv",
        ]

        try:
            subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
                timeout=int(os.getenv("OCR_TIMEOUT_SECONDS", "30")),
            )
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(status_code=504, detail="OCR timed out") from exc
        except subprocess.CalledProcessError as exc:
            raise HTTPException(
                status_code=500,
                detail=exc.stderr.strip() or "OCR processing failed",
            ) from exc

        return parse_tesseract_tsv(output_tsv.read_text(encoding="utf-8"))


def parse_tesseract_tsv(tsv: str) -> dict[str, object]:
    lines = [line for line in tsv.splitlines() if line.strip()]
    words: list[str] = []
    confidences: list[float] = []

    for line in lines[1:]:
        columns = line.split("\t")
        if len(columns) < 12:
            continue

        text = columns[11].strip()
        if text:
            words.append(text)

        try:
            confidence = float(columns[10])
        except ValueError:
            continue

        if confidence >= 0:
            confidences.append(confidence / 100)

    average_confidence = (
        sum(confidences) / len(confidences) if confidences else 0
    )

    return {
        "text": " ".join(words),
        "confidence": round(average_confidence, 2),
    }
