"""
Convert PDF pages to images for OCR processing.
Usage: python scripts/pdf_to_images.py <pdf_path> <output_dir>
Output: JSON array of image paths to stdout.
"""
import json
import sys
import tempfile
from pathlib import Path

try:
    from pdf2image import convert_from_path
except ImportError:
    print(json.dumps({"error": "pdf2image not installed. Run: pip install pdf2image"}))
    sys.exit(1)


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python scripts/pdf_to_images.py <pdf_path> <output_dir>"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)

    if not Path(pdf_path).exists():
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)

    try:
        # Convert PDF to images (150 DPI is good enough for OCR)
        images = convert_from_path(pdf_path, dpi=200, fmt="png")

        paths = []
        for i, img in enumerate(images):
            img_path = output_dir / f"page_{i + 1}.png"
            img.save(str(img_path), "PNG")
            paths.append(str(img_path))

        print(json.dumps({"pages": len(paths), "images": paths}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
