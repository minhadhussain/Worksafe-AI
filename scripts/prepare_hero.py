"""Retouch the supplied factory photo and export the full composition for web.

Run with Python plus opencv-python-headless and Pillow. Only the small mark in
the lower-right background is retouched; the original image is preserved.
"""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "Gemini_Generated_Image_zhpuhtzhpuhtzhpu.png"
TARGET = ROOT / "apps" / "web" / "public" / "industrial-workers.webp"


def main() -> None:
    image = np.array(Image.open(SOURCE).convert("RGB"))
    height, width = image.shape[:2]
    # Coordinates reference the supplied 2000 x 1178 image. The small mask
    # touches only background, preserving every worker, helmet, and safety vest.
    polygon = np.array(
        [[1818, 953], [1836, 980], [1864, 998], [1837, 1017],
         [1818, 1044], [1799, 1018], [1773, 998], [1799, 979]],
        dtype=np.float32,
    )
    polygon *= [width / 2000, height / 1178]
    mask = np.zeros((height, width), dtype=np.uint8)
    cv2.fillPoly(mask, [polygon.astype(np.int32)], 255)
    restored = cv2.inpaint(image, mask, 7, cv2.INPAINT_TELEA)
    Image.fromarray(restored).save(TARGET, "WEBP", quality=93, method=6)
    print(f"Prepared {TARGET.name}: {width} x {height}; original image preserved.")


if __name__ == "__main__":
    main()
