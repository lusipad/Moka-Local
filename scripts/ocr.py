"""PaddleOCR bridge — called from Node.js via subprocess.
Usage: python scripts/ocr.py <image_path>
Output: JSON with text and per-line results to stdout.
"""
import os

# Must set BEFORE paddle import to disable ONEDNN
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["KMP_AFFINITY"] = "disabled"
os.environ["GLOG_logtostderr"] = "1"  # PaddlePaddle logs → stderr
os.environ["GLOG_v"] = "0"

import json
import sys
from pathlib import Path

from paddleocr import PaddleOCR

_ocr: PaddleOCR | None = None


def get_ocr() -> PaddleOCR:
    global _ocr
    if _ocr is None:
        _ocr = PaddleOCR(lang="ch", use_doc_orientation_classify=False, use_doc_unwarping=False)
    return _ocr


def ocr_image(image_path: str) -> dict:
    ocr = get_ocr()
    # PaddleOCR v3: predict() returns a generator, wrap in list
    result = list(ocr.predict(image_path))

    if not result:
        return {"text": "", "lines": []}

    lines: list[str] = []
    all_text_parts: list[str] = []

    # PaddleOCR v3 predict() returns a list of dicts per page
    # Each dict has keys: dt_polys, rec_texts, rec_scores, rec_polys
    for page in result:
        rec_texts = page.get("rec_texts", [])
        rec_scores = page.get("rec_scores", [])
        for idx, text in enumerate(rec_texts):
            conf = float(rec_scores[idx]) if idx < len(rec_scores) else 1.0
            lines.append({"text": str(text), "confidence": round(conf, 4)})
            all_text_parts.append(str(text))

    return {"text": "\n".join(all_text_parts), "lines": lines}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python scripts/ocr.py <image_path>"}))
        sys.exit(1)

    image_path = sys.argv[1]
    if not Path(image_path).exists():
        print(json.dumps({"error": f"File not found: {image_path}"}))
        sys.exit(1)

    result = ocr_image(image_path)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
