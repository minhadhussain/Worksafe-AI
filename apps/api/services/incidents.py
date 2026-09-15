"""In-memory demo incident ledger. All mutations run on the API event loop."""

from copy import deepcopy
from dataclasses import dataclass
from time import time
from uuid import uuid4

VIOLATION_TYPES = {"NO-Hardhat": "NO_HARDHAT", "NO-Safety Vest": "NO_SAFETY_VEST"}
CONFIRMATION_FRAMES = 7


@dataclass
class Confirmation:
    present: int = 0
    clear: int = 0
    incident_id: str | None = None


class IncidentStore:
    def __init__(self) -> None:
        self.incidents: dict[str, dict] = {}
        self.confirmations: dict[tuple[str, str], Confirmation] = {}
        self.falls: dict[str, str] = {}
        self.workers: dict[str, dict] = {}
        self.fall_requests: dict[tuple[str, str], str] = {}

    def snapshot(self) -> list[dict]:
        return deepcopy(sorted(self.incidents.values(), key=lambda i: i["timestamp"], reverse=True))

    def workers_snapshot(self) -> list[dict]:
        return deepcopy(list(self.workers.values()))

    def _create(self, kind: str, message: str, *, camera_id: str | None = None,
                worker_id: str | None = None, detections: list | None = None) -> dict:
        now = time()
        incident = {
            "id": str(uuid4()), "camera_id": camera_id, "worker_id": worker_id,
            "type": kind, "severity": "HIGH" if kind == "NO_SAFETY_VEST" else "CRITICAL",
            "status": "active", "timestamp": now, "updated_at": now, "resolved_at": None,
            "message": message, "detections": deepcopy(detections or []),
        }
        self.incidents[incident["id"]] = incident
        # Bound historical memory; active incidents are never evicted.
        resolved = [i for i in self.incidents.values() if i["status"] == "resolved"]
        for old in sorted(resolved, key=lambda i: i["timestamp"])[:-1000]:
            del self.incidents[old["id"]]
        self.fall_requests = {k: v for k, v in self.fall_requests.items() if v in self.incidents}
        return incident

    def _resolve(self, incident: dict) -> dict:
        incident.update(status="resolved", updated_at=time(), resolved_at=time())
        return {"type": "incident.resolved", "incident": deepcopy(incident)}

    def reset_confirmation(self, camera_id: str) -> None:
        # A decode/inference outage is NOT a clear frame and must not resolve an incident.
        for (source, _), state in self.confirmations.items():
            if source == camera_id:
                state.present = state.clear = 0

    def update_camera(self, camera_id: str, detections: list[dict]) -> list[dict]:
        events = []
        for label, kind in VIOLATION_TYPES.items():
            matches = [d for d in detections if d["label"] == label]
            state = self.confirmations.setdefault((camera_id, kind), Confirmation())
            if matches:
                state.clear = 0
                state.present = min(CONFIRMATION_FRAMES, state.present + 1)
                if state.incident_id is None and state.present == CONFIRMATION_FRAMES:
                    incident = self._create(kind, f"{len(matches)} {label} detection(s) confirmed",
                                            camera_id=camera_id, detections=matches)
                    state.incident_id = incident["id"]
                    events.append({"type": "incident.created", "incident": deepcopy(incident)})
                elif state.incident_id:
                    incident = self.incidents[state.incident_id]
                    incident.update(detections=deepcopy(matches), updated_at=time(),
                                    message=f"{len(matches)} {label} detection(s) confirmed")
            else:
                state.present = 0
                state.clear = min(CONFIRMATION_FRAMES, state.clear + 1)
                if state.incident_id and state.clear == CONFIRMATION_FRAMES:
                    events.append(self._resolve(self.incidents[state.incident_id]))
                    state.incident_id = None
        return events

    def camera_incidents(self, camera_id: str) -> list[dict]:
        return [deepcopy(i) for i in self.incidents.values()
                if i["camera_id"] == camera_id and i["status"] == "active"]

    def report_fall(self, worker_id: str, event_id: str | None) -> tuple[dict, bool]:
        previous = self.fall_requests.get((worker_id, event_id)) if event_id else None
        if previous:
            return deepcopy(self.incidents[previous]), False
        existing = self.falls.get(worker_id)
        created = existing is None
        incident = self.incidents[existing] if existing else self._create(
            "FALL_DETECTED", f"Fall detected for {worker_id}. Supervisor response required.",
            worker_id=worker_id,
        )
        self.falls[worker_id] = incident["id"]
        if event_id:
            self.fall_requests[(worker_id, event_id)] = incident["id"]
        self.workers[worker_id] = {
            "worker_id": worker_id, "status": "critical", "fall_detected": True,
            "last_seen": time(), "incident_id": incident["id"],
        }
        return deepcopy(incident), created

    def resolve_fall(self, worker_id: str, incident_id: str | None) -> tuple[dict | None, bool]:
        current = self.falls.get(worker_id)
        if incident_id and current and current != incident_id:
            raise ValueError("The active fall has changed; refresh before resolving")
        if current is None:
            old = self.incidents.get(incident_id or "")
            return (deepcopy(old) if old and old["worker_id"] == worker_id else None), False
        incident = self.incidents[current]
        self._resolve(incident)
        del self.falls[worker_id]
        self.workers[worker_id].update(status="safe", fall_detected=False, last_seen=time())
        return deepcopy(incident), True
