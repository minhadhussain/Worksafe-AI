import logging
from typing import Literal

from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health", tags=["Health"])


class Liveness(BaseModel):
    status: Literal["alive"] = "alive"
    service: str = "workvision-api"


class Readiness(BaseModel):
    status: Literal["ready", "degraded"]
    service: str = "workvision-api"
    dependencies: dict[Literal["redis"], Literal["up", "down"]]


@router.get("/live", response_model=Liveness)
async def liveness() -> Liveness:
    """Process health, independent of external dependencies."""
    return Liveness()


@router.get(
    "/ready",
    response_model=Readiness,
    responses={503: {"model": Readiness, "description": "Redis unavailable"}},
)
async def readiness(request: Request, response: Response) -> Readiness:
    """Check Redis on each request so dependency recovery needs no restart."""
    response.headers["Cache-Control"] = "no-store"
    try:
        redis_up = bool(await request.app.state.redis.ping())
    except (RedisError, OSError):
        # Never include a connection URL: deployed Redis URLs can contain credentials.
        logger.warning("readiness dependency=redis status=down")
        redis_up = False

    if not redis_up:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return Readiness(
        status="ready" if redis_up else "degraded",
        dependencies={"redis": "up" if redis_up else "down"},
    )
