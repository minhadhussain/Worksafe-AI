import asyncio
from time import time
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter(tags=["Safety operations"])


@router.get("/health")
async def health(request: Request):
    return {
        "status": "ok", "service": "vigil-os-api",
        "model_loaded": request.app.state.vision.available,
        "model_status": request.app.state.vision.status_message,
        "cameras": {c["camera_id"]: c["status"] for c in request.app.state.cameras.snapshot()},
    }


@router.get("/api/cameras")
async def cameras(request: Request):
    return request.app.state.cameras.snapshot()


def find_camera(request: Request, camera_id: str):
    camera = request.app.state.cameras.cameras.get(camera_id)
    if camera is None:
        raise HTTPException(404, "Camera not found")
    return camera


@router.get("/api/cameras/{camera_id}")
async def camera_details(camera_id: str, request: Request):
    return find_camera(request, camera_id).state


@router.get("/api/cameras/{camera_id}/stream")
async def stream_camera(camera_id: str, request: Request):
    camera = find_camera(request, camera_id)
    if camera.jpeg is None and camera.state["status"] == "STARTING":
        async with camera.condition:
            try:
                await asyncio.wait_for(camera.condition.wait_for(
                    lambda: camera.jpeg is not None or camera.state["status"] != "STARTING",
                ), timeout=15)
            except TimeoutError:
                pass
    if camera.jpeg is None:
        raise HTTPException(503, camera.state["error"] or "Camera is starting")
    return StreamingResponse(
        camera.stream(), media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate", "X-Accel-Buffering": "no"},
    )


@router.get("/api/admin/incidents")
async def incidents(request: Request):
    return request.app.state.incidents.snapshot()


@router.get("/api/admin/workers")
async def workers(request: Request):
    return request.app.state.incidents.workers_snapshot()


@router.websocket("/ws/admin")
async def admin_socket(websocket: WebSocket):
    origin = websocket.headers.get("origin")
    if origin and origin not in websocket.app.state.settings.cors_origins:
        await websocket.close(code=1008)
        return
    hub = websocket.app.state.admin_events
    await hub.connect(websocket, {
        "type": "snapshot", "timestamp": time(),
        "cameras": websocket.app.state.cameras.snapshot(),
        "incidents": websocket.app.state.incidents.snapshot(),
        "workers": websocket.app.state.incidents.workers_snapshot(),
    })
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(websocket)


class FallReport(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    worker_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._:-]+$")
    event_id: str | None = Field(default=None, max_length=128)
    timestamp: float | None = Field(default=None, ge=0)
    accel_g: float | None = Field(default=None, ge=0, le=1000)


class FallResolution(BaseModel):
    worker_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._:-]+$")
    incident_id: str | None = Field(default=None, max_length=128)


def require_worker_token(request: Request, authorization: str | None):
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or token not in request.app.state.settings.worker_api_tokens:
        raise HTTPException(401, "Invalid worker token", headers={"WWW-Authenticate": "Bearer"})


@router.post("/api/worker/fall", status_code=202)
async def report_fall(payload: FallReport, request: Request,
                      authorization: Annotated[str | None, Header()] = None):
    require_worker_token(request, authorization)
    store = request.app.state.incidents
    incident, created = store.report_fall(payload.worker_id, payload.event_id)
    if created:
        await request.app.state.admin_events.broadcast({
            "type": "incident.created", "incident": incident,
        })
    worker = store.workers.get(payload.worker_id)
    if worker:
        await request.app.state.admin_events.broadcast({"type": "worker.updated", "worker": worker})
    return {"status": "accepted", "incident": incident, "created": created}


@router.post("/api/worker/fall/resolve")
async def resolve_fall(payload: FallResolution, request: Request,
                       authorization: Annotated[str | None, Header()] = None):
    require_worker_token(request, authorization)
    store = request.app.state.incidents
    try:
        incident, changed = store.resolve_fall(payload.worker_id, payload.incident_id)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    if changed:
        await request.app.state.admin_events.broadcast({
            "type": "incident.resolved", "incident": incident,
        })
        await request.app.state.admin_events.broadcast({
            "type": "worker.updated", "worker": store.workers[payload.worker_id],
        })
    return {"status": "resolved", "incident": incident}
