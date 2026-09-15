r"""Verify the RUNNING real camera service (not a mocked inference pipeline).

Run from apps/api: .venv\Scripts\python scripts/verify_live_system.py
"""

import asyncio
import json
from uuid import uuid4

import cv2
import httpx
import numpy as np
from websockets.asyncio.client import connect

BASE = "http://127.0.0.1:8000"
ALLOWED = {"Person", "Hardhat", "NO-Hardhat", "Safety Vest", "NO-Safety Vest"}


async def read_frames(camera_id: str):
    frames = []
    async with httpx.AsyncClient(timeout=30) as client:
        async with client.stream("GET", f"{BASE}/api/cameras/{camera_id}/stream") as response:
            assert response.status_code == 200
            assert "multipart/x-mixed-replace" in response.headers["content-type"]
            buffer = b""
            async for chunk in response.aiter_bytes():
                buffer += chunk
                while b"\xff\xd8" in buffer and b"\xff\xd9" in buffer:
                    start = buffer.index(b"\xff\xd8")
                    end = buffer.index(b"\xff\xd9", start) + 2
                    jpeg = buffer[start:end]
                    frame = cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)
                    assert frame is not None and frame.shape[1] <= 640 and frame.shape[0] <= 384
                    frames.append(jpeg)
                    buffer = buffer[end:]
                    if len(frames) == 3:
                        assert len(set(frames)) > 1, "Expected changing annotated video frames"
                        return camera_id, frame.shape, len(frames)


async def wait_event(socket, kind, incident_id):
    async with asyncio.timeout(15):
        while True:
            event = json.loads(await socket.recv())
            if event["type"] == kind and event.get("incident", {}).get("id") == incident_id:
                return event


async def main():
    async with httpx.AsyncClient(timeout=30) as client:
        health = (await client.get(f"{BASE}/health")).json()
        assert health["model_loaded"] is True
        platform = (await client.get(f"{BASE}/v1")).json()
        assert platform["vision"]["weights_path"].endswith("best.pt")
        cameras = (await client.get(f"{BASE}/api/cameras")).json()
        assert {c["camera_id"] for c in cameras} == {"CAM-LEFT", "CAM-RIGHT"}
        for camera in cameras:
            assert camera["status"] == "ONLINE", camera
            assert camera["loop_count"] >= 1, "Wait for one full source loop and retry"
            assert camera["processed_frames"] > camera["source_frames"]
            assert all(d["label"] in ALLOWED for d in camera["current_detections"])
            assert camera["inference_ms"] > 0
            print(json.dumps({key: camera[key] for key in (
                "camera_id", "status", "source_file", "processed_frames", "loop_count",
                "fps", "inference_ms", "workers_detected", "no_hardhats", "no_safety_vests",
            )}))
        print("MJPEG:", await asyncio.gather(read_frames("CAM-LEFT"), read_frames("CAM-RIGHT")))

        headers = {"Authorization": "Bearer dev_device_worker_001"}
        worker_id = "VERIFY-WORKER"
        async with connect(
            "ws://127.0.0.1:8000/ws/admin", origin="http://localhost:3000",
        ) as socket:
            snapshot = json.loads(await socket.recv())
            assert snapshot["type"] == "snapshot"
            # Observe a genuine model-driven transition in the looping source videos.
            async with asyncio.timeout(180):
                while True:
                    event = json.loads(await socket.recv())
                    incident = event.get("incident", {})
                    if event["type"] in {"incident.created", "incident.resolved"} and incident.get(
                        "camera_id"
                    ) in {"CAM-LEFT", "CAM-RIGHT"}:
                        assert incident["type"] in {"NO_HARDHAT", "NO_SAFETY_VEST"}
                        assert all(d["label"] in ALLOWED for d in incident["detections"])
                        print("Real camera transition:", event["type"], incident["type"])
                        break
            payload = {"worker_id": worker_id, "event_id": str(uuid4()), "accel_g": 3.4}
            response = await client.post(f"{BASE}/api/worker/fall", json=payload, headers=headers)
            assert response.status_code == 202
            incident_id = response.json()["incident"]["id"]
            created = await wait_event(socket, "incident.created", incident_id)
            assert created["incident"]["severity"] == "CRITICAL"
            repeat = await client.post(f"{BASE}/api/worker/fall", json=payload, headers=headers)
            assert repeat.json()["created"] is False
            response = await client.post(f"{BASE}/api/worker/fall/resolve", headers=headers,
                                         json={"worker_id": worker_id, "incident_id": incident_id})
            assert response.status_code == 200
            assert (await wait_event(socket, "incident.resolved", incident_id))["incident"][
                "status"] == "resolved"
        print("PASS: real model, looping streams, HTTP fall/resolve, WebSocket, deduplication")


if __name__ == "__main__":
    asyncio.run(main())
