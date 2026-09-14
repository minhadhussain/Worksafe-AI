from __future__ import annotations

import math
import shutil
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "apps" / "web" / "public" / "demo"
WIDTH = 1280
HEIGHT = 720
FPS = 24
DURATION_SECONDS = 8
FRAME_COUNT = FPS * DURATION_SECONDS


def industrial_background(frame_index: int) -> np.ndarray:
    base = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    gradient = np.linspace(18, 42, HEIGHT, dtype=np.uint8).reshape(HEIGHT, 1)
    base[:, :, 0] = gradient
    base[:, :, 1] = gradient
    base[:, :, 2] = gradient

    for x in range(80, WIDTH, 220):
        cv2.rectangle(base, (x, 0), (x + 22, HEIGHT), (32, 34, 36), -1)

    for y in range(120, HEIGHT, 90):
        cv2.line(base, (0, y), (WIDTH, y), (30, 32, 34), 1)

    for x in range(0, WIDTH, 180):
        cv2.line(base, (x, 0), (x + 140, 160), (34, 36, 38), 1)

    cv2.rectangle(base, (40, 470), (280, 690), (26, 28, 30), -1)
    cv2.rectangle(base, (980, 460), (1210, 690), (28, 30, 32), -1)
    cv2.rectangle(base, (500, 520), (780, 700), (24, 26, 28), -1)

    overlay = base.copy()
    pulse = 12 + int(4 * math.sin(frame_index / 14))
    cv2.circle(overlay, (WIDTH // 2, HEIGHT // 2), 260, (pulse, pulse, pulse), -1)
    base = cv2.addWeighted(overlay, 0.12, base, 0.88, 0)

    noise = np.random.default_rng(frame_index).integers(0, 8, size=(HEIGHT, WIDTH, 1), dtype=np.uint8)
    base = cv2.add(base, np.repeat(noise, 3, axis=2))

    for y in range(0, HEIGHT, 4):
        cv2.line(base, (0, y), (WIDTH, y), (18, 18, 18), 1)

    timestamp = f"2026-09-15 14:{32 + (frame_index // FPS):02d}:{(frame_index % FPS) * 2:02d}"
    cv2.putText(base, timestamp, (WIDTH - 365, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (205, 205, 205), 2, cv2.LINE_AA)

    return base


def draw_worker(
    image: np.ndarray,
    center_x: int,
    center_y: int,
    scale: float,
    *,
    compliant: bool,
    vest_present: bool,
) -> None:
    head_radius = int(18 * scale)
    torso_width = int(44 * scale)
    torso_height = int(118 * scale)
    shoulder_y = center_y - int(12 * scale)
    torso_top = shoulder_y + head_radius
    torso_left = center_x - torso_width // 2
    torso_right = center_x + torso_width // 2
    torso_bottom = torso_top + torso_height
    arm_span = int(62 * scale)
    leg_gap = int(10 * scale)
    leg_bottom = torso_bottom + int(70 * scale)

    skin = (172, 182, 194)
    body = (46, 50, 54)
    vest = (58, 170, 255)
    helmet = (198, 230, 243)

    cv2.circle(image, (center_x, shoulder_y), head_radius, skin, -1)
    cv2.rectangle(image, (torso_left, torso_top), (torso_right, torso_bottom), body, -1)
    cv2.line(image, (torso_left, torso_top + int(18 * scale)), (torso_left - arm_span // 2, torso_bottom - int(10 * scale)), body, int(14 * scale))
    cv2.line(image, (torso_right, torso_top + int(18 * scale)), (torso_right + arm_span // 2, torso_bottom - int(8 * scale)), body, int(14 * scale))
    cv2.line(image, (center_x - leg_gap, torso_bottom), (center_x - leg_gap - int(12 * scale), leg_bottom), body, int(14 * scale))
    cv2.line(image, (center_x + leg_gap, torso_bottom), (center_x + leg_gap + int(12 * scale), leg_bottom), body, int(14 * scale))

    if vest_present:
        cv2.rectangle(image, (torso_left + int(6 * scale), torso_top + int(12 * scale)), (torso_right - int(6 * scale), torso_bottom - int(10 * scale)), vest, -1)
        cv2.line(image, (center_x, torso_top + int(12 * scale)), (center_x, torso_bottom - int(10 * scale)), (220, 220, 220), int(4 * scale))

    if compliant:
        cv2.ellipse(image, (center_x, shoulder_y - int(4 * scale)), (head_radius + int(4 * scale), head_radius), 0, 180, 360, helmet, -1)
        cv2.rectangle(image, (center_x - head_radius - int(4 * scale), shoulder_y - int(2 * scale)), (center_x + head_radius + int(4 * scale), shoulder_y + int(5 * scale)), helmet, -1)


def render_camera(camera_name: str, *, compliant: bool) -> Path:
    temp_dir = Path(tempfile.mkdtemp(prefix=f"{camera_name.lower()}-", dir=str(OUTPUT_DIR)))
    raw_path = temp_dir / f"{camera_name.lower()}-raw.avi"
    final_path = OUTPUT_DIR / ("cam-01-compliant.mp4" if compliant else "cam-02-violation.mp4")

    writer = cv2.VideoWriter(str(raw_path), cv2.VideoWriter_fourcc(*"MJPG"), FPS, (WIDTH, HEIGHT))
    if not writer.isOpened():
        raise RuntimeError(f"Could not open video writer for {raw_path}")

    for frame_index in range(FRAME_COUNT):
        frame = industrial_background(frame_index)
        wave = math.sin(frame_index / 16.0)
        offset = int(12 * wave)

        draw_worker(frame, 370 + offset, 250, 1.22, compliant=compliant, vest_present=True)
        draw_worker(frame, 785 - offset, 248, 1.2, compliant=compliant, vest_present=(True if compliant else False))

        cv2.putText(frame, camera_name, (46, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (220, 220, 220), 2, cv2.LINE_AA)
        cv2.putText(frame, "PRODUCTION FLOOR", (46, 74), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (182, 186, 190), 2, cv2.LINE_AA)
        cv2.putText(frame, "LIVE CCTV FEED", (46, 108), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (150, 150, 150), 1, cv2.LINE_AA)

        writer.write(frame)

    writer.release()

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(raw_path),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(final_path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    shutil.rmtree(temp_dir, ignore_errors=True)
    return final_path


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    cam_01 = render_camera("CAM-01", compliant=True)
    cam_02 = render_camera("CAM-02", compliant=False)
    print(f"Generated demo CCTV loops:\n- {cam_01}\n- {cam_02}")


if __name__ == "__main__":
    main()
