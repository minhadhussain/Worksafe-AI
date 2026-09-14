import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from core.config import Settings
from main import create_app
from services.vision import VisionDetection, VisionFrameResult


@pytest.fixture
def client_and_redis():
    redis = AsyncMock()
    redis.ping.return_value = True
    settings = Settings(_env_file=None, app_env="test", cors_origins=["http://localhost:3000"])
    with patch("main.Redis.from_url", return_value=redis):
        with TestClient(create_app(settings)) as client:
            yield client, redis
    redis.aclose.assert_awaited_once()


def test_worker_telemetry_websocket_requires_valid_token(client_and_redis):
    client, _ = client_and_redis

    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect("/ws/telemetry/worker/W-001?token=invalid-token"):
            pass

    assert excinfo.value.code == 1008


def test_worker_telemetry_buffers_state_and_broadcasts_to_admin(client_and_redis):
    client, redis = client_and_redis
    payload = {
        "client_type": "worker_mobile",
        "worker_id": "W-001",
        "timestamp": 1718362911,
        "motion": {"accel_g": 1.12, "gyro_rad": 0.31},
        "location": {"lat": 27.4728, "lng": 94.9119},
    }
    worker_socket_path = "/ws/telemetry/worker/W-001?token=dev_device_worker_001"

    with client.websocket_connect("/ws/admin/alerts") as admin_ws:
        with client.websocket_connect(worker_socket_path) as worker_ws:
            connected = worker_ws.receive_json()
            assert connected["type"] == "worker.connected"

            admin_connected = admin_ws.receive_json()
            assert admin_connected["type"] == "worker.connection"
            assert admin_connected["status"] == "connected"
            assert admin_connected["worker_id"] == "W-001"

            worker_ws.send_json(payload)

            accepted = worker_ws.receive_json()
            assert accepted["type"] == "worker.accepted"
            assert accepted["worker_id"] == "W-001"
            assert accepted["state_key"] == "telemetry:worker:W-001"
            assert accepted["zone_label"] == "Unmapped Zone"

            admin_event = admin_ws.receive_json()
            assert admin_event["type"] == "worker.telemetry"
            assert admin_event["worker_id"] == "W-001"
            assert admin_event["motion"]["accel_g"] == pytest.approx(1.12)

        disconnected = admin_ws.receive_json()
        assert disconnected["type"] == "worker.connection"
        assert disconnected["status"] == "disconnected"
        assert disconnected["worker_id"] == "W-001"

    redis.setex.assert_awaited_once()
    key, ttl_seconds, raw_payload = redis.setex.await_args.args
    assert key == "telemetry:worker:W-001"
    assert ttl_seconds == 30
    buffered = json.loads(raw_payload)
    assert buffered["worker_id"] == "W-001"
    assert buffered["zone_label"] == "Unmapped Zone"


def test_vision_endpoint_broadcasts_processed_frame_to_admin(client_and_redis):
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
    with client.websocket_connect("/ws/admin/alerts") as admin_ws:
        response = client.post(
            "/v1/vision/frame",
            json={
                "camera_id": "cam-1",
                "frame_base64": "ZHVtbXk=",
                "annotate": True,
                "timestamp": 1718362911,
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["timestamp"] == 1718362911

        event = admin_ws.receive_json()
        assert event["type"] == "vision.frame.processed"
        assert event["camera_id"] == "cam-1"
        assert event["timestamp"] == 1718362911
        assert event["missing_classes"] == ["vest"]
        assert event["detections"][0]["label"] == "hardhat"
