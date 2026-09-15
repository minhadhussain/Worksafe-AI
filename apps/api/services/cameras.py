import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from pathlib import Path
from time import perf_counter, time

from core.config import Settings
from services.incidents import IncidentStore
from services.realtime import AdminEventHub
from services.vision import RELEVANT_CLASSES, VisionService, VisionServiceUnavailable

logger = logging.getLogger(__name__)


class CameraProcessor:
    def __init__(self, camera_id: str, video: Path, vision: VisionService,
                 incidents: IncidentStore, hub: AdminEventHub, max_fps: float) -> None:
        self.camera_id = camera_id
        self.video = video
        self.vision = vision
        self.incidents = incidents
        self.hub = hub
        self.max_fps = max_fps
        self.capture = None
        self.jpeg: bytes | None = None
        self.sequence = 0
        self.condition = asyncio.Condition()
        self.stopping = asyncio.Event()
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix=camera_id)
        self.task: asyncio.Task | None = None
        self.loop_count = 0
        self.frame_index = 0
        self.source_frames = 0
        self.source_fps = 0.0
        self.state = {
            "camera_id": camera_id, "camera_name": camera_id, "location": "PRODUCTION FLOOR",
            "source_file": video.name, "stream_url": f"/api/cameras/{camera_id}/stream",
            "status": "STARTING", "last_frame_time": None, "active": False,
            "incident_count": 0, "active_incidents": [], "current_detections": [],
            "workers_detected": 0, "hardhats": 0, "no_hardhats": 0,
            "safety_vests": 0, "no_safety_vests": 0, "fps": 0.0, "inference_ms": 0.0,
            "frame_width": 0, "frame_height": 0, "processed_frames": 0,
            "loop_count": 0, "frame_index": 0, "source_frames": 0,
            "interpretation": "AWAITING INFERENCE", "error": None,
        }

    def _read_and_infer(self):
        import cv2

        if not self.video.is_file():
            raise FileNotFoundError(f"Video not found: {self.video}")
        if not self.vision.available:
            raise VisionServiceUnavailable(self.vision.status_message)
        if self.capture is None:
            self.capture = cv2.VideoCapture(str(self.video), cv2.CAP_FFMPEG)
            if not self.capture.isOpened():
                self._release()
                raise RuntimeError(f"Cannot open video: {self.video.name}")
            self.source_frames = int(self.capture.get(cv2.CAP_PROP_FRAME_COUNT))
            self.source_fps = self.capture.get(cv2.CAP_PROP_FPS) or self.max_fps
        ok, frame = self.capture.read()
        if not ok:
            self.capture.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ok, frame = self.capture.read()
            if not ok:
                self._release()
                raise RuntimeError(f"Cannot decode video after rewind: {self.video.name}")
            self.loop_count += 1
            logger.info("camera=%s state=looped loop_count=%d", self.camera_id, self.loop_count)
        self.frame_index = int(self.capture.get(cv2.CAP_PROP_POS_FRAMES))
        return self.vision.process_bgr(frame)

    def _release(self) -> None:
        if self.capture is not None:
            self.capture.release()
            self.capture = None

    async def _wait(self, seconds: float) -> None:
        try:
            await asyncio.wait_for(self.stopping.wait(), timeout=seconds)
        except TimeoutError:
            pass

    async def run(self) -> None:
        loop = asyncio.get_running_loop()
        previous_frame = None
        last_error = None
        try:
            while not self.stopping.is_set():
                started = perf_counter()
                try:
                    result = await loop.run_in_executor(self.executor, self._read_and_infer)
                    detections = [asdict(d) for d in result.detections]
                    counts = {name: sum(d["label"] == name for d in detections)
                              for name in RELEVANT_CLASSES}
                    transitions = self.incidents.update_camera(self.camera_id, detections)
                    active = self.incidents.camera_incidents(self.camera_id)
                    completed = perf_counter()
                    fps = 1 / (completed - previous_frame) if previous_frame else 0.0
                    previous_frame = completed
                    violation = counts["NO-Hardhat"] + counts["NO-Safety Vest"] > 0
                    persons = counts["Person"]
                    # No negative detection does not prove all PPE is present.
                    interpretation = "PPE VIOLATION" if violation else (
                        "COMPLIANT" if persons and counts["Hardhat"] >= persons
                        and counts["Safety Vest"] >= persons else
                        "PPE UNCONFIRMED" if persons else "NO WORKERS DETECTED"
                    )
                    self.sequence += 1
                    self.state = {
                        **self.state, "status": "ONLINE", "error": None,
                        "last_frame_time": time(), "current_detections": detections,
                        "workers_detected": persons, "hardhats": counts["Hardhat"],
                        "no_hardhats": counts["NO-Hardhat"], "safety_vests": counts["Safety Vest"],
                        "no_safety_vests": counts["NO-Safety Vest"], "fps": round(fps, 2),
                        "inference_ms": result.inference_ms, "frame_width": result.width,
                        "frame_height": result.height, "processed_frames": self.sequence,
                        "frame_index": self.frame_index, "loop_count": self.loop_count,
                        "source_frames": self.source_frames, "active": bool(active),
                        "incident_count": len(active), "active_incidents": active,
                        "interpretation": interpretation,
                    }
                    async with self.condition:
                        self.jpeg = result.jpeg
                        self.condition.notify_all()
                    if previous_frame and self.sequence == 1:
                        logger.info("camera=%s state=online source=%s resolution=%dx%d",
                                    self.camera_id, self.video.name, result.width, result.height)
                    for event in transitions:
                        logger.info("camera=%s event=%s incident=%s", self.camera_id,
                                    event["type"], event["incident"]["id"])
                        await self.hub.broadcast(event)
                    await self.hub.broadcast({"type": "camera.updated", "camera": self.state})
                    last_error = None
                    interval = 1 / min(self.max_fps, max(1, self.source_fps))
                    await self._wait(max(0.001, interval - (perf_counter() - started)))
                except Exception as exc:
                    error = str(exc)
                    if error != last_error:
                        logger.exception("camera=%s state=error", self.camera_id)
                    last_error = error
                    self.incidents.reset_confirmation(self.camera_id)
                    await loop.run_in_executor(self.executor, self._release)
                    self.state = {**self.state, "status": "ERROR", "error": error,
                                  "current_detections": [], "fps": 0.0}
                    async with self.condition:
                        self.jpeg = None
                        self.condition.notify_all()
                    await self.hub.broadcast({"type": "camera.updated", "camera": self.state})
                    await self._wait(3)
        finally:
            await loop.run_in_executor(self.executor, self._release)
            self.jpeg = None
            self.state = {**self.state, "status": "OFFLINE"}
            async with self.condition:
                self.condition.notify_all()

    async def stream(self):
        last_sequence = -1
        while not self.stopping.is_set():
            async with self.condition:
                try:
                    await asyncio.wait_for(self.condition.wait_for(
                        lambda previous=last_sequence: self.stopping.is_set() or self.jpeg is None
                        or self.sequence != previous,
                    ), timeout=5)
                except TimeoutError:
                    continue
                if self.stopping.is_set() or self.jpeg is None:
                    return
                jpeg = self.jpeg
                last_sequence = self.sequence
            # Every client consumes the same latest frame; slow clients don't queue video.
            yield (b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: "
                   + str(len(jpeg)).encode() + b"\r\n\r\n" + jpeg + b"\r\n")

    async def stop(self) -> None:
        self.stopping.set()
        if self.task:
            await self.task
        self.executor.shutdown(wait=True)


class CameraManager:
    def __init__(self, settings: Settings, vision: VisionService,
                 incidents: IncidentStore, hub: AdminEventHub) -> None:
        self.cameras = {
            camera_id: CameraProcessor(camera_id, video, vision, incidents, hub,
                                       settings.camera_max_fps)
            for camera_id, video in [("CAM-LEFT", settings.camera_left_video),
                                     ("CAM-RIGHT", settings.camera_right_video)]
        }

    def start(self) -> None:
        for camera in self.cameras.values():
            camera.task = asyncio.create_task(camera.run(), name=camera.camera_id)

    def snapshot(self) -> list[dict]:
        return [camera.state for camera in self.cameras.values()]

    async def stop(self) -> None:
        await asyncio.gather(*(camera.stop() for camera in self.cameras.values()))
