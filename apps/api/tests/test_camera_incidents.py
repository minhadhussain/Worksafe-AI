import asyncio
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from core.config import Settings
from main import create_app
from services.cameras import CameraManager
from services.incidents import IncidentStore
from services.vision import RELEVANT_CLASSES, VisionService


def detection(label):
    return {"label": label, "confidence": 0.9, "x1": 1, "y1": 2, "x2": 10, "y2": 20}


def test_seven_frames_are_required_and_one_incident_persists():
    store = IncidentStore()
    unsafe = [detection("NO-Hardhat")]
    for _ in range(6):
        assert store.update_camera("CAM-LEFT", unsafe) == []
    created = store.update_camera("CAM-LEFT", unsafe)
    assert len(created) == 1
    incident_id = created[0]["incident"]["id"]
    for _ in range(20):
        assert store.update_camera("CAM-LEFT", unsafe) == []
    assert len(store.snapshot()) == 1
    for _ in range(6):
        assert store.update_camera("CAM-LEFT", []) == []
    assert store.snapshot()[0]["status"] == "active"
    cleared = store.update_camera("CAM-LEFT", [])
    assert cleared[0]["type"] == "incident.resolved"
    assert cleared[0]["incident"]["id"] == incident_id
    assert len(store.snapshot()) == 1


def test_streaks_are_consecutive_and_separate_per_camera_and_class():
    store = IncidentStore()
    for _ in range(6):
        store.update_camera("CAM-LEFT", [detection("NO-Hardhat")])
    store.update_camera("CAM-LEFT", [])
    for _ in range(6):
        assert store.update_camera("CAM-LEFT", [detection("NO-Hardhat")]) == []
        assert store.update_camera("CAM-RIGHT", [detection("NO-Safety Vest")]) == []
    left = store.update_camera("CAM-LEFT", [detection("NO-Hardhat")])
    right = store.update_camera("CAM-RIGHT", [detection("NO-Safety Vest")])
    assert left[0]["incident"]["type"] == "NO_HARDHAT"
    assert right[0]["incident"]["type"] == "NO_SAFETY_VEST"
    for _ in range(7):
        store.update_camera("CAM-LEFT", [detection("Mask"), detection("NO-Mask")])
    assert not store.camera_incidents("CAM-LEFT")
    assert len(store.camera_incidents("CAM-RIGHT")) == 1


def test_outage_is_not_clear_evidence_and_recurrence_gets_new_id():
    store = IncidentStore()
    for _ in range(7):
        store.update_camera("CAM-LEFT", [detection("NO-Hardhat")])
    old_id = store.snapshot()[0]["id"]
    for _ in range(6):
        store.update_camera("CAM-LEFT", [])
    store.reset_confirmation("CAM-LEFT")
    assert store.update_camera("CAM-LEFT", []) == []
    for _ in range(6):
        store.update_camera("CAM-LEFT", [])
    for _ in range(7):
        store.update_camera("CAM-LEFT", [detection("NO-Hardhat")])
    assert len(store.snapshot()) == 2
    assert store.camera_incidents("CAM-LEFT")[0]["id"] != old_id


@pytest.fixture
def client(tmp_path):
    settings = Settings(_env_file=None, cameras_enabled=False,
                        vision_model_weights=tmp_path / "missing.pt")
    with patch("main.Redis.from_url", return_value=AsyncMock()):
        with TestClient(create_app(settings)) as client:
            yield client


def test_fall_http_to_admin_websocket_and_idempotent_resolution(client):
    headers = {"Authorization": "Bearer dev_device_worker_001"}
    payload = {"worker_id": "W-001", "event_id": "request-1", "accel_g": 3.4}
    assert client.post("/api/worker/fall", json=payload).status_code == 401
    with client.websocket_connect("/ws/admin") as socket:
        assert socket.receive_json()["type"] == "snapshot"
        response = client.post("/api/worker/fall", json=payload, headers=headers)
        assert response.status_code == 202
        incident = response.json()["incident"]
        assert socket.receive_json()["type"] == "incident.created"
        assert socket.receive_json()["worker"]["fall_detected"] is True
        repeated = client.post("/api/worker/fall", json=payload, headers=headers).json()
        assert repeated["created"] is False
        assert repeated["incident"]["id"] == incident["id"]
        socket.receive_json()  # worker contact update
        response = client.post("/api/worker/fall/resolve", headers=headers, json={
            "worker_id": "W-001", "incident_id": incident["id"],
        })
        assert response.status_code == 200
        assert socket.receive_json()["type"] == "incident.resolved"
        assert socket.receive_json()["worker"]["fall_detected"] is False
        assert len(client.get("/api/admin/incidents").json()) == 1
        assert client.post("/api/worker/fall", headers=headers, json=payload).json()[
            "incident"]["status"] == "resolved"


def test_missing_assets_leave_api_and_routes_available(client):
    assert client.get("/health").json()["model_loaded"] is False
    assert len(client.get("/api/cameras").json()) == 2
    assert client.get("/api/cameras/unknown/stream").status_code == 404
    assert client.get("/v1").status_code == 200
    response = client.options("/api/worker/fall", headers={
        "Origin": "http://localhost:3001", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Authorization,Content-Type",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3001"


def test_inference_filters_model_class_ids_and_does_not_infer_absence(tmp_path):
    import numpy as np

    service = VisionService(Settings(_env_file=None, vision_model_weights=tmp_path / "best.pt"))
    model = SimpleNamespace(names={11: "Mask", 23: "Person", 40: "Hardhat", 80: "NO-Hardhat",
                                   90: "Safety Vest", 91: "NO-Safety Vest"})
    with (
        patch.object(Path, "is_file", return_value=True),
        patch("ultralytics.YOLO", return_value=model),
    ):
        loaded = service._load_model()
    assert service.class_ids == [23, 40, 80, 90, 91]
    calls = []

    def predict(frame, **kwargs):
        calls.append((frame.shape, kwargs))
        return [SimpleNamespace(boxes=[], names=model.names)]

    loaded.predict = predict
    service._model = loaded
    result = service.process_bgr(np.zeros((2160, 3840, 3), dtype=np.uint8))
    assert calls[0][0] == (360, 640, 3)
    assert calls[0][1]["classes"] == service.class_ids
    assert result.missing_classes == []
    assert result.jpeg.startswith(b"\xff\xd8")
    assert "Mask" not in RELEVANT_CLASSES


def test_one_bad_camera_does_not_stop_other_camera(tmp_path):
    import cv2
    import numpy as np

    video = tmp_path / "short.avi"
    writer = cv2.VideoWriter(str(video), cv2.VideoWriter_fourcc(*"MJPG"), 10, (64, 48))
    for _ in range(2):
        writer.write(np.zeros((48, 64, 3), dtype=np.uint8))
    writer.release()
    settings = Settings(_env_file=None, camera_left_video=tmp_path / "missing.mp4",
                        camera_right_video=video, camera_max_fps=30)
    vision = SimpleNamespace(available=True, process_bgr=lambda _: SimpleNamespace(
        detections=[], jpeg=b"jpeg", width=64, height=48, inference_ms=1,
    ))

    async def exercise():
        manager = CameraManager(settings, vision, IncidentStore(), AsyncMock())
        manager.start()
        try:
            for _ in range(100):
                if manager.cameras["CAM-RIGHT"].loop_count:
                    break
                await asyncio.sleep(0.02)
            assert manager.cameras["CAM-LEFT"].state["status"] == "ERROR"
            assert manager.cameras["CAM-RIGHT"].state["status"] == "ONLINE"
            assert manager.cameras["CAM-RIGHT"].loop_count >= 1
        finally:
            await manager.stop()
    asyncio.run(exercise())
