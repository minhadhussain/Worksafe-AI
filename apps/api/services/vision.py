from __future__ import annotations

import asyncio
import base64
import binascii
import logging
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from time import perf_counter
from typing import Any

from core.config import Settings

logger = logging.getLogger(__name__)
RELEVANT_CLASSES = ("Person", "Hardhat", "NO-Hardhat", "Safety Vest", "NO-Safety Vest")


def canonical_label(label: str) -> str | None:
    normalized = " ".join(label.casefold().replace("_", " ").replace("-", " ").split())
    return {"person": "Person", "hardhat": "Hardhat", "no hardhat": "NO-Hardhat",
            "safety vest": "Safety Vest", "no safety vest": "NO-Safety Vest"}.get(normalized)


class VisionServiceUnavailable(RuntimeError):
    """The configured model is unavailable."""


class VisionFrameDecodeError(ValueError):
    """The supplied frame cannot be decoded."""


@dataclass(slots=True)
class VisionDetection:
    label: str
    confidence: float
    x1: int
    y1: int
    x2: int
    y2: int
    classification: str


@dataclass(slots=True)
class VisionFrameResult:
    detections: list[VisionDetection]
    missing_classes: list[str]
    annotated_frame_base64: str | None
    inference_ms: float
    jpeg: bytes = b""
    width: int = 0
    height: int = 0


class VisionService:
    """One local model, shared safely by HTTP inference and both camera processors."""

    def __init__(self, settings: Settings) -> None:
        self._weights_path = settings.vision_model_weights
        self._confidence_threshold = settings.vision_confidence_threshold
        self._width = settings.vision_width
        self._height = settings.vision_height
        self._threads = settings.vision_cpu_threads
        self._model: Any | None = None
        self._load_error: str | None = None
        self._predict_lock = Lock()
        self.class_ids: list[int] = []

    @property
    def available(self) -> bool:
        return self._model is not None

    @property
    def weights_path(self) -> Path:
        return self._weights_path

    @property
    def status_message(self) -> str:
        return "Model loaded" if self.available else self._load_error or "Model has not been loaded"

    async def load(self) -> None:
        try:
            self._model = await asyncio.to_thread(self._load_model)
            self._load_error = None
            logger.info("vision_model state=loaded weights=%s class_ids=%s",
                        self._weights_path, self.class_ids)
        except Exception as exc:
            self._model = None
            self._load_error = str(exc)
            logger.error("vision_model state=unavailable reason=%s", self._load_error)

    def _load_model(self) -> Any:
        if not self._weights_path.is_file():
            raise FileNotFoundError(f"YOLO weights not found: {self._weights_path}")
        import torch
        from ultralytics import YOLO

        torch.set_num_threads(self._threads)
        model = YOLO(str(self._weights_path))
        names = model.names if isinstance(model.names, dict) else dict(enumerate(model.names))
        self.class_ids = [int(key) for key, value in names.items() if canonical_label(value)]
        found = {canonical_label(names[key]) for key in self.class_ids}
        if found != set(RELEVANT_CLASSES):
            raise ValueError(
                f"Model is missing required PPE classes: {set(RELEVANT_CLASSES) - found}"
            )
        return model

    async def process_frame(self, frame_base64: str, annotate: bool = True) -> VisionFrameResult:
        if not self.available:
            raise VisionServiceUnavailable(self.status_message)
        return await asyncio.to_thread(self._process_encoded, frame_base64, annotate)

    def _process_encoded(self, encoded: str, annotate: bool) -> VisionFrameResult:
        import cv2
        import numpy as np

        if encoded.startswith("data:"):
            encoded = encoded.partition(",")[2]
        try:
            payload = base64.b64decode(encoded, validate=True)
            if not payload or len(payload) > 8_000_000:
                raise ValueError("Empty or oversized frame")
            frame = cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_COLOR)
            if frame is None:
                raise ValueError("Not an image")
        except (ValueError, binascii.Error, cv2.error) as exc:
            raise VisionFrameDecodeError("Invalid base64 image frame") from exc
        result = self.process_bgr(frame, annotate)
        if annotate:
            result.annotated_frame_base64 = base64.b64encode(result.jpeg).decode("ascii")
        return result

    def process_bgr(self, frame: Any, annotate: bool = True) -> VisionFrameResult:
        import cv2

        if not self.available:
            raise VisionServiceUnavailable(self.status_message)
        height, width = frame.shape[:2]
        ratio = min(self._width / width, self._height / height, 1.0)
        frame = cv2.resize(frame, (max(1, round(width * ratio)), max(1, round(height * ratio))))
        height, width = frame.shape[:2]
        # Ultralytics mutates predictor internals; serialise use of the shared model.
        with self._predict_lock:
            started = perf_counter()
            results = self._model.predict(
                frame, imgsz=(self._height, self._width), classes=self.class_ids,
                conf=self._confidence_threshold, verbose=False, max_det=100,
            )
            inference_ms = (perf_counter() - started) * 1000
            detections: list[VisionDetection] = []
            if results and results[0].boxes is not None:
                result = results[0]
                for box in result.boxes:
                    label = canonical_label(result.names[int(box.cls.item())])
                    if label is None:
                        continue
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    detections.append(VisionDetection(
                        label, float(box.conf.item()),
                        max(0, min(width - 1, round(x1))), max(0, min(height - 1, round(y1))),
                        max(0, min(width - 1, round(x2))), max(0, min(height - 1, round(y2))),
                        "critical" if label.startswith("NO-") else
                        "observed" if label == "Person" else "compliant",
                    ))

        # Missing PPE is based only on explicit negative model classes, not absence in a frame.
        missing = sorted({"hardhat" if d.label == "NO-Hardhat" else "vest"
                          for d in detections if d.label.startswith("NO-")})
        jpeg = b""
        if annotate:
            for detection in detections:
                color = (0, 0, 255) if detection.classification == "critical" else (230, 230, 230)
                if detection.classification == "compliant":
                    color = (0, 200, 0)
                cv2.rectangle(frame, (detection.x1, detection.y1),
                              (detection.x2, detection.y2), color, 2)
                caption = f"{detection.label} {detection.confidence:.0%}"
                cv2.putText(frame, caption, (detection.x1, max(16, detection.y1 - 5)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 3, cv2.LINE_AA)
                cv2.putText(frame, caption, (detection.x1, max(16, detection.y1 - 5)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA)
            ok, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 82])
            if not ok:
                raise VisionFrameDecodeError("Could not encode annotated frame")
            jpeg = buffer.tobytes()
        return VisionFrameResult(
            detections, missing, None, round(inference_ms, 2), jpeg, width, height,
        )
