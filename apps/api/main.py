import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis
from redis.backoff import NoBackoff
from redis.retry import Retry

from api.hardware import router as hardware_router
from api.health import router as health_router
from api.v1 import router as v1_router
from api.vision import router as vision_router
from core.config import Settings
from services.vision import VisionService

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        logging.basicConfig(
            level=settings.log_level,
            format="%(asctime)s %(levelname)s %(name)s %(message)s",
        )
        app.state.settings = settings
        app.state.redis = Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
            retry=Retry(NoBackoff(), 0),
        )
        app.state.vision = VisionService(settings)
        await app.state.vision.load()
        logger.info("service=workvision-api state=starting environment=%s", settings.app_env)
        try:
            yield
        finally:
            await app.state.redis.aclose()
            logger.info("service=workvision-api state=stopped")

    app = FastAPI(
        title="WorkVision API",
        description="Vision-first industrial safety platform — Phases 1 to 4.",
        version="0.4.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(health_router)
    app.include_router(v1_router)
    app.include_router(vision_router)
    app.include_router(hardware_router)
    return app


app = create_app()
