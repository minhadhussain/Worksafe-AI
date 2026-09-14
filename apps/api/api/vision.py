import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from services.vision import VisionFrameDecodeError, VisionServiceUnavailable

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/vision", tags=["Vision"])


class VisionFrameRequest(BaseModel):
    camera_id: str = Field(min_length=1, max_length=64)
    frame_base64: str = Field(min_length=1)
    timestamp: int | None = Field(default=None, ge=0)
    annotate: bool = True


class VisionDetectionResponse(BaseModel):
    label: str
    confidence: float
    x1: int
    y1: int
    x2: int
    y2: int
    classification: Literal["compliant", "observed", "critical"]


class VisionFrameResponse(BaseModel):
    status: Literal["processed"] = "processed"
    camera_id: str
    inference_ms: float
    detections: list[VisionDetectionResponse]
    missing_classes: list[str]
    annotated_frame_base64: str | None = None


@router.post("/frame", response_model=VisionFrameResponse)
async def process_vision_frame(
    payload: VisionFrameRequest,
    request: Request,
) -> VisionFrameResponse:
    try:
        result = await request.app.state.vision.process_frame(
            payload.frame_base64,
            annotate=payload.annotate,
        )
    except VisionServiceUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except VisionFrameDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    logger.info(
        "vision_frame state=processed camera_id=%s detections=%d missing=%s inference_ms=%.2f",
        payload.camera_id,
        len(result.detections),
        ",".join(result.missing_classes) or "none",
        result.inference_ms,
    )
    return VisionFrameResponse(
        camera_id=payload.camera_id,
        inference_ms=result.inference_ms,
        missing_classes=result.missing_classes,
        detections=[
            VisionDetectionResponse(
                label=detection.label,
                confidence=detection.confidence,
                x1=detection.x1,
                y1=detection.y1,
                x2=detection.x2,
                y2=detection.y2,
                classification=detection.classification,
            )
            for detection in result.detections
        ],
        annotated_frame_base64=result.annotated_frame_base64,
    )
