import json
import logging
from typing import Literal

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field, ValidationError
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Realtime"])


class WorkerMotion(BaseModel):
    accel_g: float = Field(ge=0.0)
    gyro_rad: float = Field(ge=0.0)


class WorkerLocation(BaseModel):
    lat: float = Field(ge=-90.0, le=90.0)
    lng: float = Field(ge=-180.0, le=180.0)


class WorkerTelemetryMessage(BaseModel):
    client_type: Literal["worker_mobile"] = "worker_mobile"
    worker_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._:-]+$")
    timestamp: int = Field(ge=0)
    motion: WorkerMotion
    location: WorkerLocation | None = None


def _resolve_zone_label(location: WorkerLocation | None) -> str:
    if location is None:
        return "Unknown Zone"
    return "Unmapped Zone"


@router.websocket("/ws/admin/alerts")
async def admin_alerts(websocket: WebSocket) -> None:
    hub = websocket.app.state.admin_events
    await hub.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await hub.disconnect(websocket)


@router.websocket("/ws/telemetry/worker/{worker_id}")
async def worker_telemetry(
    websocket: WebSocket,
    worker_id: str,
    token: str = Query(default="", min_length=1),
) -> None:
    settings = websocket.app.state.settings
    if token not in settings.worker_api_tokens:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Missing or invalid worker token",
        )
        return

    await websocket.accept()
    await websocket.send_json(
        {
            "type": "worker.connected",
            "worker_id": worker_id,
            "zone_label": "Unknown Zone",
            "status": "streaming_ready",
        }
    )
    await websocket.app.state.admin_events.broadcast(
        {
            "type": "worker.connection",
            "status": "connected",
            "worker_id": worker_id,
            "zone_label": "Unknown Zone",
        }
    )
    logger.info("worker_telemetry state=connected worker_id=%s", worker_id)

    try:
        while True:
            try:
                payload = WorkerTelemetryMessage.model_validate(await websocket.receive_json())
            except ValidationError as exc:
                await websocket.send_json(
                    {
                        "type": "worker.error",
                        "detail": "Telemetry payload validation failed",
                        "errors": exc.errors(),
                    }
                )
                continue

            if payload.worker_id != worker_id:
                await websocket.send_json(
                    {
                        "type": "worker.error",
                        "detail": "worker_id in the payload must match the socket path",
                    }
                )
                continue

            zone_label = _resolve_zone_label(payload.location)
            state_key = f"telemetry:worker:{worker_id}"
            state_payload = payload.model_dump(mode="json")
            state_payload["zone_label"] = zone_label

            try:
                await websocket.app.state.redis.setex(
                    state_key,
                    settings.worker_telemetry_ttl_seconds,
                    json.dumps(state_payload, separators=(",", ":")),
                )
            except (OSError, RedisError):
                logger.warning("worker_telemetry state=buffer_failed worker_id=%s", worker_id)
                await websocket.send_json(
                    {
                        "type": "worker.error",
                        "detail": "Redis unavailable for worker telemetry buffering",
                    }
                )
                await websocket.close(
                    code=status.WS_1011_INTERNAL_ERROR,
                    reason="Redis unavailable for worker telemetry buffering",
                )
                return

            await websocket.send_json(
                {
                    "type": "worker.accepted",
                    "worker_id": worker_id,
                    "timestamp": payload.timestamp,
                    "zone_label": zone_label,
                    "state_key": state_key,
                }
            )
            await websocket.app.state.admin_events.broadcast(
                {
                    "type": "worker.telemetry",
                    "worker_id": worker_id,
                    "timestamp": payload.timestamp,
                    "zone_label": zone_label,
                    "motion": payload.motion.model_dump(mode="json"),
                    "location": (
                        payload.location.model_dump(mode="json") if payload.location else None
                    ),
                }
            )
    except WebSocketDisconnect:
        await websocket.app.state.admin_events.broadcast(
            {
                "type": "worker.connection",
                "status": "disconnected",
                "worker_id": worker_id,
                "zone_label": "Unknown Zone",
            }
        )
        logger.info("worker_telemetry state=disconnected worker_id=%s", worker_id)
