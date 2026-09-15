import { API_BASE_URL, type CameraDetection, type CameraFeed, type DashboardState, type SafetyEvent, type WorkerRecord } from "./dashboard-data";

export type ApiIncident = {
  id: string; camera_id: string | null; worker_id: string | null;
  type: string; severity: string; status: "active" | "resolved";
  timestamp: number; updated_at: number; resolved_at: number | null;
  message: string; detections: CameraDetection[];
};
export type ApiCamera = {
  camera_id: string; camera_name: string; location: string; status: string;
  stream_url: string; last_frame_time: number | null; incident_count: number;
  current_detections: CameraDetection[]; active_incidents: ApiIncident[];
  workers_detected: number; hardhats: number; no_hardhats: number;
  safety_vests: number; no_safety_vests: number; fps: number; inference_ms: number;
  interpretation: string; error: string | null;
};
export type ApiWorker = {
  worker_id: string; status: string; fall_detected: boolean; last_seen: number;
};
export type SafetyMessage =
  | { type: "snapshot"; cameras: ApiCamera[]; incidents: ApiIncident[]; workers: ApiWorker[] }
  | { type: "camera.updated"; camera: ApiCamera }
  | { type: "incident.created" | "incident.resolved"; incident: ApiIncident }
  | { type: "worker.updated"; worker: ApiWorker };

export function cameraFromApi(camera: ApiCamera): CameraFeed {
  return {
    id: camera.camera_id, name: camera.camera_name, zoneId: "", zoneName: camera.location,
    status: camera.status.toLowerCase() as CameraFeed["status"],
    interpretation: camera.status === "ONLINE" ? camera.interpretation : "INFERENCE UNAVAILABLE",
    source: { kind: "mjpeg", src: `${API_BASE_URL}${camera.stream_url}` },
    workersDetected: camera.workers_detected, hardhatsDetected: camera.hardhats,
    noHardhats: camera.no_hardhats, safetyVests: camera.safety_vests,
    noSafetyVests: camera.no_safety_vests,
    ppeViolations: camera.no_hardhats + camera.no_safety_vests,
    incidentCount: camera.incident_count, fps: camera.fps, inferenceMs: camera.inference_ms,
    detections: camera.current_detections, updatedAt: (camera.last_frame_time || 0) * 1000,
    hasInference: camera.last_frame_time !== null, error: camera.error,
  };
}
export function incidentFromApi(incident: ApiIncident): SafetyEvent {
  const fall = incident.type === "FALL_DETECTED";
  return {
    event_id: incident.id, type: fall ? "FALL_DETECTED" : "PPE_VIOLATION",
    severity: incident.severity === "CRITICAL" ? "critical" : "high",
    source: incident.camera_id || incident.worker_id || "Site",
    worker_id: incident.worker_id || undefined, camera_id: incident.camera_id || undefined,
    zone_id: "", timestamp: incident.timestamp * 1000, status: incident.status,
    metadata: { detection_type: incident.type, resolved_at: incident.resolved_at,
      detection_count: incident.detections.length },
    title: fall ? "FALL DETECTED" : incident.type.replaceAll("_", " "),
    description: incident.message,
  };
}
function workerFromApi(worker: ApiWorker, current?: WorkerRecord): WorkerRecord {
  return {
    id: worker.worker_id, status: worker.fall_detected ? "critical" : "safe",
    zoneId: "", zoneName: "Not reported", ppe: current?.ppe || { hardhat: null, vest: null },
    motion: worker.fall_detected ? "fall_detected" : "normal",
    lastSeenAt: worker.last_seen * 1000, connectivity: "online", timeline: current?.timeline || [],
  };
}
function applyIncident(state: DashboardState, incident: ApiIncident): DashboardState {
  const event = incidentFromApi(incident);
  const activeAlerts = state.activeAlerts.filter((i) => i.event_id !== event.event_id);
  const resolvedAlerts = state.resolvedAlerts.filter((i) => i.event_id !== event.event_id);
  if (event.status === "active") activeAlerts.push(event); else resolvedAlerts.push(event);
  activeAlerts.sort((a, b) => b.timestamp - a.timestamp);
  resolvedAlerts.sort((a, b) => b.timestamp - a.timestamp);
  let workers = state.workers;
  if (incident.worker_id) {
    const current = workers.find((w) => w.id === incident.worker_id);
    const worker = workerFromApi({ worker_id: incident.worker_id,
      fall_detected: incident.status === "active", status: incident.status,
      last_seen: incident.updated_at }, current);
    const timelineId = `${incident.id}:${incident.status}`;
    worker.timeline = [{ id: timelineId, label: incident.status === "active" ? event.title : `${event.title} — RESOLVED`,
      timestamp: (incident.resolved_at || incident.timestamp) * 1000, severity: event.severity },
    ...worker.timeline.filter((i) => i.id !== timelineId)].slice(0, 50);
    workers = [...workers.filter((w) => w.id !== worker.id), worker];
  }
  return { ...state, workers, activeAlerts, resolvedAlerts };
}

export function applySafetyMessage(state: DashboardState, message: SafetyMessage): DashboardState {
  if (message.type === "snapshot") {
    let snapshot: DashboardState = { ...state, cameras: message.cameras.map(cameraFromApi),
      activeAlerts: [], resolvedAlerts: [], workers: [] };
    // Old incidents first so worker state ends at the most recent observation.
    for (const incident of [...message.incidents].sort((a, b) => a.updated_at - b.updated_at)) {
      snapshot = applyIncident(snapshot, incident);
    }
    snapshot.workers = message.workers.map((worker) => workerFromApi(worker,
      snapshot.workers.find((w) => w.id === worker.worker_id)));
    return snapshot;
  }
  if (message.type === "camera.updated") {
    const camera = cameraFromApi(message.camera);
    let next = { ...state, cameras: state.cameras.map((c) => c.id === camera.id ? camera : c) };
    for (const incident of message.camera.active_incidents) next = applyIncident(next, incident);
    return next;
  }
  if (message.type === "incident.created" || message.type === "incident.resolved") {
    return applyIncident(state, message.incident);
  }
  if (message.type === "worker.updated") {
    const worker = workerFromApi(message.worker, state.workers.find((w) => w.id === message.worker.worker_id));
    return { ...state, workers: [...state.workers.filter((w) => w.id !== worker.id), worker] };
  }
  return state;
}

export async function fetchSafetySnapshot(signal?: AbortSignal): Promise<SafetyMessage> {
  const responses = await Promise.all(["/api/cameras", "/api/admin/incidents", "/api/admin/workers"].map(
    (path) => fetch(`${API_BASE_URL}${path}`, { cache: "no-store", signal }),
  ));
  if (responses.some((response) => !response.ok)) throw new Error("Safety service unavailable");
  const [cameras, incidents, workers] = await Promise.all(responses.map((response) => response.json()));
  return { type: "snapshot", cameras, incidents, workers };
}

export function adminSocketUrl(): string {
  const url = new URL(API_BASE_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/ws/admin`;
  return url.toString();
}
