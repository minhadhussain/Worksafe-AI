import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel, Field
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/telemetry", tags=["Hardware"])


class HardwareMetrics(BaseModel):
    temperature_c: float = Field(ge=-55.0, le=250.0)
    vibration_rms: float = Field(ge=0.0)


class HardwareTelemetryRequest(BaseModel):
    client_type: Literal["machine_node"] = "machine_node"
    node_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._:-]+$")
    timestamp: int = Field(ge=0)
    metrics: HardwareMetrics


class HardwareTelemetryResponse(BaseModel):
    status: Literal["accepted"] = "accepted"
    node_id: str
    state_key: str


def _extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.casefold() != "bearer" or not token.strip():
        return None
    return token.strip()


@router.post(
    "/hardware",
    response_model=HardwareTelemetryResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def ingest_hardware_telemetry(
    payload: HardwareTelemetryRequest,
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> HardwareTelemetryResponse:
    settings = request.app.state.settings
    token = _extract_bearer_token(authorization)
    if token not in settings.hardware_api_tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid hardware bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    state_key = f"telemetry:hardware:{payload.node_id}"
    try:
        await request.app.state.redis.setex(
            state_key,
            settings.hardware_telemetry_ttl_seconds,
            payload.model_dump_json(),
        )
    except (OSError, RedisError) as exc:
        logger.warning("hardware_telemetry state=buffer_failed node_id=%s", payload.node_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis unavailable for hardware telemetry buffering",
        ) from exc

    logger.info(
        "hardware_telemetry state=accepted node_id=%s temperature_c=%.2f vibration_rms=%.4f",
        payload.node_id,
        payload.metrics.temperature_c,
        payload.metrics.vibration_rms,
    )
    return HardwareTelemetryResponse(node_id=payload.node_id, state_key=state_key)
