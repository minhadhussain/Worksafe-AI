from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter(prefix="/v1", tags=["Platform"])


class VisionInfo(BaseModel):
    model_loaded: bool
    weights_path: str
    status: str


class HardwareInfo(BaseModel):
    transport: Literal["http"] = "http"
    telemetry_ttl_seconds: int
    token_count: int


class PlatformInfo(BaseModel):
    name: str = "WorkVision API"
    version: str = "0.4.0"
    phase: Literal["vision-hardware"] = "vision-hardware"
    monitoring_enabled: bool = True
    vision: VisionInfo
    hardware: HardwareInfo


@router.get("", response_model=PlatformInfo)
async def platform_info(request: Request) -> PlatformInfo:
    settings = request.app.state.settings
    vision = request.app.state.vision
    return PlatformInfo(
        vision=VisionInfo(
            model_loaded=vision.available,
            weights_path=str(vision.weights_path),
            status=vision.status_message,
        ),
        hardware=HardwareInfo(
            telemetry_ttl_seconds=settings.hardware_telemetry_ttl_seconds,
            token_count=len(settings.hardware_api_tokens),
        ),
    )
