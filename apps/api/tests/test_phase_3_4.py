import base64
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from core.config import Settings
from main import create_app
from services.vision import VisionDetection, VisionFrameResult


@pytest.fixture
def client_and_redis():
    redis = AsyncMock()
    redis.ping.return_value = True
    settings = Settings(_env_file=None, app_env="test", cameras_enabled=False,
                        vision_model_weights="missing-test-model.pt",
                        cors_origins=["http://localhost:3000"])
    with patch("main.Redis.from_url", return_value=redis):
        with TestClient(create_app(settings)) as client:
            yield client, redis
    redis.aclose.assert_awaited_once()


def test_vision_endpoint_returns_structured_503_when_model_is_unavailable(client_and_redis):
    client, _ = client_and_redis
    response = client.post(
        "/v1/vision/frame",
        json={
            "camera_id": "cam-1",
            "frame_base64": base64.b64encode(b"not-an-image").decode("ascii"),
        },
    )
    assert response.status_code == 503
    detail = response.json()["detail"].casefold()
    assert "weights" in detail or "model" in detail


def test_vision_endpoint_uses_loaded_service(client_and_redis):
    client, _ = client_and_redis

    class StubVisionService:
        available = True

        async def process_frame(
            self,
            frame_base64: str,
            annotate: bool = True,
        ) -> VisionFrameResult:
            assert frame_base64 == "ZHVtbXk="
            assert annotate is True
            return VisionFrameResult(
                detections=[
                    VisionDetection(
                        label="hardhat",
                        confidence=0.97,
                        x1=10,
                        y1=20,
                        x2=110,
                        y2=140,
                        classification="compliant",
                    )
                ],
                missing_classes=["vest"],
                annotated_frame_base64="YW5ub3RhdGVk",
                inference_ms=12.5,
            )

    client.app.state.vision = StubVisionService()
    response = client.post(
        "/v1/vision/frame",
        json={"camera_id": "cam-1", "frame_base64": "ZHVtbXk=", "annotate": True},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["camera_id"] == "cam-1"
    assert body["missing_classes"] == ["vest"]
    assert body["detections"][0]["label"] == "hardhat"
    assert body["annotated_frame_base64"] == "YW5ub3RhdGVk"


def test_hardware_ingest_requires_bearer_token(client_and_redis):
    client, _ = client_and_redis
    payload = {
        "client_type": "machine_node",
        "node_id": "M-EXTRUDER-1",
        "timestamp": 1718362912,
        "metrics": {"temperature_c": 72.4, "vibration_rms": 14.2},
    }
    response = client.post("/v1/telemetry/hardware", json=payload)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_hardware_ingest_buffers_last_known_state_in_redis(client_and_redis):
    client, redis = client_and_redis
    payload = {
        "client_type": "machine_node",
        "node_id": "M-EXTRUDER-1",
        "timestamp": 1718362912,
        "metrics": {"temperature_c": 72.4, "vibration_rms": 14.2},
    }
    response = client.post(
        "/v1/telemetry/hardware",
        json=payload,
        headers={"Authorization": "Bearer dev_device_machine_001"},
    )
    assert response.status_code == 202
    redis.setex.assert_awaited_once()
    key, ttl_seconds, raw_payload = redis.setex.await_args.args
    assert key == "telemetry:hardware:M-EXTRUDER-1"
    assert ttl_seconds == 60
    assert '"temperature_c":72.4' in raw_payload
