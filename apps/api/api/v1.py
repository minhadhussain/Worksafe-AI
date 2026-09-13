from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/v1", tags=["Platform"])


class PlatformInfo(BaseModel):
    name: str = "WorkVision API"
    version: str = "0.1.0"
    phase: Literal["foundation"] = "foundation"
    monitoring_enabled: bool = False


@router.get("", response_model=PlatformInfo)
async def platform_info() -> PlatformInfo:
    return PlatformInfo()
