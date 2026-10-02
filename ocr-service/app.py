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
    if len(lines) <= 1:
        return {"text": "", "confidence": 0.0, "lines": []}

    line_groups: dict[tuple[int, int, int], list[dict]] = {}
    valid_confidences: list[float] = []
    all_words: list[str] = []

    for line in lines[1:]:
        columns = line.split("\t")
        if len(columns) < 12:
            continue

        try:
            level = int(columns[0])
            block_num = int(columns[2])
            par_num = int(columns[3])
            line_num = int(columns[4])
            left = int(columns[6])
            top = int(columns[7])
            width = int(columns[8])
            height = int(columns[9])
            conf = float(columns[10])
        except ValueError:
            continue

        text = columns[11].strip()
        if not text:
            continue

        # Level 5 in Tesseract TSV represents individual words
        if level != 5:
            continue

        all_words.append(text)

        word_info = {
            "text": text,
            "conf": conf,
            "left": left,
            "top": top,
            "width": width,
            "height": height,
        }
        key = (block_num, par_num, line_num)
        if key not in line_groups:
            line_groups[key] = []
        line_groups[key].append(word_info)

        # Filter noise for global confidence
        if conf > 30 and len(text) >= 2:
            valid_confidences.append(conf / 100.0)

    formatted_lines: list[dict[str, object]] = []
    for words in line_groups.values():
        if not words:
            continue
        line_text = " ".join(w["text"] for w in words)
        min_left = min(w["left"] for w in words)
        min_top = min(w["top"] for w in words)
        max_right = max(w["left"] + w["width"] for w in words)
        max_bottom = max(w["top"] + w["height"] for w in words)
        line_conf = sum(w["conf"] for w in words) / len(words)
        formatted_lines.append({
            "text": line_text,
            "confidence": round(line_conf / 100.0, 2),
            "bbox": [min_left, min_top, max_right - min_left, max_bottom - min_top],
        })

    if valid_confidences:
        avg_conf = sum(valid_confidences) / len(valid_confidences)
    elif all_words:
        all_confs = [w["conf"] for words in line_groups.values() for w in words if w["conf"] >= 0]
        avg_conf = (sum(all_confs) / len(all_confs) / 100.0) if all_confs else 0.0
    else:
        avg_conf = 0.0

    return {
        "text": " ".join(all_words),
        "confidence": round(avg_conf, 2),
        "lines": formatted_lines,
    }
