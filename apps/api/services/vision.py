from __future__ import annotations

import asyncio
import base64
import binascii
import logging
from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
from typing import Any

from core.config import Settings

logger = logging.getLogger(__name__)


class VisionServiceUnavailable(RuntimeError):
    """Raised when the vision service is configured but not ready."""


class VisionFrameDecodeError(ValueError):
    """Raised when a provided frame cannot be decoded into an image."""


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


class VisionService:
    def __init__(self, settings: Settings) -> None:
        self._app_env = settings.app_env
        self._weights_path = settings.vision_model_weights
        self._confidence_threshold = settings.vision_confidence_threshold
        self._monitored_classes = tuple(settings.monitored_ppe_classes)
        self._model: Any | None = None
        self._load_error: str | None = None

    @property
    def available(self) -> bool:
        return self._model is not None

    @property
    def weights_path(self) -> Path:
        return self._weights_path

    @property
    def status_message(self) -> str:
        if self.available:
            return f"Loaded from {self._weights_path}"
        if self._load_error:
            return self._load_error
        return "Model has not been loaded"

    async def load(self) -> None:
        try:
            self._model = await asyncio.to_thread(self._load_model)
            self._load_error = None
            logger.info("vision_model state=loaded weights=%s", self._weights_path)
        except Exception as exc:
            self._model = None
            self._load_error = str(exc)
            logger.warning("vision_model state=unavailable reason=%s", self._load_error)
            if self._app_env == "production":
                raise RuntimeError("Vision model must load successfully in production") from exc

    async def process_frame(self, frame_base64: str, annotate: bool = True) -> VisionFrameResult:
        if not self.available:
            raise VisionServiceUnavailable(self.status_message)
        return await asyncio.to_thread(self._process_frame_sync, frame_base64, annotate)

    def _load_model(self) -> Any:
        if not self._weights_path.is_file():
            raise FileNotFoundError(
                "YOLOv8 weights file was not found at "
                f"{self._weights_path}. Place the Roboflow export there before using "
                "/v1/vision/frame."
            )
        try:
            from ultralytics import YOLO
        except ImportError as exc:
            raise VisionServiceUnavailable(
                "The ultralytics package is not installed. Install the Phase 3 vision "
                "dependencies first."
            ) from exc
        return YOLO(str(self._weights_path))

    def _process_frame_sync(self, frame_base64: str, annotate: bool) -> VisionFrameResult:
        try:
            import cv2
            import numpy as np
        except ImportError as exc:
            raise VisionServiceUnavailable(
                "OpenCV and numpy are required for frame processing."
            ) from exc

        frame = self._decode_frame(frame_base64, cv2, np)
        started_at = perf_counter()
        raw_results = self._model.predict(frame, conf=self._confidence_threshold, verbose=False)
        inference_ms = (perf_counter() - started_at) * 1000

        result = raw_results[0] if raw_results else None
        detections, missing_classes = self._parse_detections(result)

        annotated_frame_base64: str | None = None
        if annotate:
            annotated_frame_base64 = self._encode_annotated_frame(
                frame,
                detections,
                missing_classes,
                cv2,
            )

        return VisionFrameResult(
            detections=detections,
            missing_classes=missing_classes,
            annotated_frame_base64=annotated_frame_base64,
            inference_ms=inference_ms,
        )

    def _decode_frame(self, frame_base64: str, cv2: Any, np: Any) -> Any:
        encoded = frame_base64.strip()
        if encoded.startswith("data:"):
            _, _, encoded = encoded.partition(",")
        try:
            payload = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error) as exc:
            raise VisionFrameDecodeError(
                "frame_base64 is not valid base64-encoded image data"
            ) from exc

        image = cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise VisionFrameDecodeError("frame_base64 could not be decoded into an image")
        return image

    def _parse_detections(self, result: Any) -> tuple[list[VisionDetection], list[str]]:
        if result is None or getattr(result, "boxes", None) is None:
            return [], list(self._monitored_classes)

        names = self._result_names(result)
        xyxy = result.boxes.xyxy.tolist() if hasattr(result.boxes, "xyxy") else []
        confidences = result.boxes.conf.tolist() if hasattr(result.boxes, "conf") else []
        class_ids = result.boxes.cls.tolist() if hasattr(result.boxes, "cls") else []

        detections: list[VisionDetection] = []
        present_classes: set[str] = set()

        for coordinates, confidence, class_id in zip(xyxy, confidences, class_ids, strict=False):
            label = self._resolve_label(names, int(class_id))
            normalized_label = self._normalize_label(label)
            classification = self._classify_label(label, normalized_label)
            if classification != "critical" and normalized_label in self._monitored_classes:
                present_classes.add(normalized_label)

            x1, y1, x2, y2 = [int(round(value)) for value in coordinates]
            detections.append(
                VisionDetection(
                    label=label,
                    confidence=float(confidence),
                    x1=x1,
                    y1=y1,
                    x2=x2,
                    y2=y2,
                    classification=classification,
                )
            )

        missing_classes = sorted(set(self._monitored_classes) - present_classes)
        return detections, missing_classes

    def _encode_annotated_frame(
        self,
        frame: Any,
        detections: list[VisionDetection],
        missing_classes: list[str],
        cv2: Any,
    ) -> str:
        annotated = frame.copy()
        for detection in detections:
            color = self._box_color(detection.classification)
            cv2.rectangle(
                annotated,
                (detection.x1, detection.y1),
                (detection.x2, detection.y2),
                color,
                2,
            )
            caption = f"{detection.label} {detection.confidence:.2f}"
            cv2.putText(
                annotated,
                caption,
                (detection.x1, max(18, detection.y1 - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                2,
                cv2.LINE_AA,
            )

        if missing_classes:
            cv2.putText(
                annotated,
                f"Missing: {', '.join(missing_classes)}",
                (12, 28),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 0, 255),
                2,
                cv2.LINE_AA,
            )

        encoded, buffer = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        if not encoded:
            raise VisionFrameDecodeError("Annotated frame could not be encoded as JPEG")
        return base64.b64encode(buffer.tobytes()).decode("ascii")

    @staticmethod
    def _result_names(result: Any) -> dict[int, str] | list[str]:
        names = getattr(result, "names", None)
        if names is None:
            return {}
        return names

    @staticmethod
    def _resolve_label(names: dict[int, str] | list[str], class_id: int) -> str:
        if isinstance(names, dict):
            return str(names.get(class_id, class_id))
        if 0 <= class_id < len(names):
            return str(names[class_id])
        return str(class_id)

    @staticmethod
    def _normalize_label(label: str) -> str:
        normalized = label.casefold().replace("_", " ").replace("-", " ").strip()
        if "helmet" in normalized or "hardhat" in normalized:
            return "hardhat"
        if "vest" in normalized:
            return "vest"
        if "mask" in normalized or "goggle" in normalized or "eye" in normalized:
            return "mask"
        return normalized

    @staticmethod
    def _classify_label(label: str, normalized_label: str) -> str:
        raw = label.casefold().replace("_", " ").replace("-", " ")
        if any(keyword in raw for keyword in ("no ", "without", "missing")):
            return "critical"
        if normalized_label in {"hardhat", "vest", "mask"}:
            return "compliant"
        return "observed"

    @staticmethod
    def _box_color(classification: str) -> tuple[int, int, int]:
        if classification == "critical":
            return (0, 0, 255)
        if classification == "compliant":
            return (0, 200, 0)
        return (255, 180, 0)
