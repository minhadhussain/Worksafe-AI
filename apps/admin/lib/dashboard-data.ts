export type SafetySeverity = "safe" | "warning" | "high" | "critical";
export type WorkerStatus = "safe" | "warning" | "critical" | "unknown";
export type MotionState = "normal" | "fall_detected";
export type ConnectivityState = "online" | "offline";
export type SafetyEventType = "PPE_VIOLATION" | "FALL_DETECTED" | "RESTRICTED_ZONE" | "ENVIRONMENTAL_HAZARD" | "WORKER_AT_RISK";
export type DetectionLabel = "Person" | "Hardhat" | "NO-Hardhat" | "Safety Vest" | "NO-Safety Vest";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
export const CAMERA_IDS = ["CAM-LEFT", "CAM-RIGHT"] as const;

export type CameraDetection = {
  label: DetectionLabel;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  classification: string;
};

export type CameraFeed = {
  id: string;
  name: string;
  zoneId: string;
  zoneName: string;
  status: "online" | "offline" | "starting" | "error";
  interpretation: string;
  source: { kind: "mjpeg"; src: string };
  workersDetected: number;
  hardhatsDetected: number;
  noHardhats: number;
  safetyVests: number;
  noSafetyVests: number;
  ppeViolations: number;
  incidentCount: number;
  fps: number;
  inferenceMs: number;
  detections: CameraDetection[];
  updatedAt: number;
  hasInference: boolean;
  error: string | null;
};

export type WorkerTimelineItem = { id: string; timestamp: number; label: string; severity: SafetySeverity };
export type WorkerRecord = {
  id: string;
  status: WorkerStatus;
  zoneId: string;
  zoneName: string;
  ppe: { hardhat: boolean | null; vest: boolean | null };
  motion: MotionState;
  lastSeenAt: number;
  connectivity: ConnectivityState;
  timeline: WorkerTimelineItem[];
};
export type SafetyEvent = {
  event_id: string;
  type: SafetyEventType;
  severity: SafetySeverity;
  source: string;
  worker_id?: string;
  camera_id?: string;
  zone_id: string;
  timestamp: number;
  status: "active" | "resolved";
  metadata: Record<string, string | number | boolean | null>;
  title: string;
  description: string;
};
export type DashboardState = {
  siteName: string;
  workers: WorkerRecord[];
  cameras: CameraFeed[];
  activeAlerts: SafetyEvent[];
  resolvedAlerts: SafetyEvent[];
};

// Initial values are unknown, not demo detections. The API supplies every observation.
export function createInitialDashboardState(): DashboardState {
  return {
    siteName: "Factory A", workers: [], activeAlerts: [], resolvedAlerts: [],
    cameras: CAMERA_IDS.map((id) => ({
      id, name: id, zoneId: "", zoneName: "PRODUCTION FLOOR", status: "starting",
      interpretation: "AWAITING INFERENCE",
      source: { kind: "mjpeg", src: `${API_BASE_URL}/api/cameras/${id}/stream` },
      workersDetected: 0, hardhatsDetected: 0, noHardhats: 0, safetyVests: 0,
      noSafetyVests: 0, ppeViolations: 0, incidentCount: 0, fps: 0, inferenceMs: 0,
      detections: [], updatedAt: 0, hasInference: false, error: null,
    })),
  };
}

export function getWorkerPpeSummary(worker: WorkerRecord) {
  const missing = [];
  if (worker.ppe.hardhat === false) missing.push("Hardhat");
  if (worker.ppe.vest === false) missing.push("Safety Vest");
  const known = worker.ppe.hardhat !== null && worker.ppe.vest !== null;
  return {
    compliant: known && missing.length === 0,
    summary: missing.length ? `NO-${missing.join(" / NO-").toUpperCase()}` : known ? "COMPLIANT" : "NOT OBSERVED",
    missing,
  };
}

export function formatRelativeTime(now: number, timestamp: number): string {
  if (!timestamp) return "—";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return seconds === 0 ? "NOW" : `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} hr ago`;
}
export function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(11, 19);
}
export function workerStatusLabel(status: WorkerStatus): string {
  return status.toUpperCase();
}
export function normalizeCameraId(cameraId: string): string {
  return cameraId.trim().toUpperCase();
}
export function summarizeWorkers(workers: WorkerRecord[]) {
  return {
    activeWorkers: workers.length,
    safe: workers.filter((w) => w.status === "safe").length,
    atRisk: workers.filter((w) => w.status === "warning").length,
    critical: workers.filter((w) => w.status === "critical").length,
  };
}
export function resolveAlertHref(alert: SafetyEvent): string {
  if (alert.worker_id) return `/dashboard/workers/${encodeURIComponent(alert.worker_id)}`;
  if (alert.camera_id) return `/dashboard/cameras?camera=${encodeURIComponent(alert.camera_id)}`;
  return `/dashboard/incidents?incident=${encodeURIComponent(alert.event_id)}`;
}
export function buildRecentEvents(active: SafetyEvent[], resolved: SafetyEvent[], workers: WorkerRecord[]): WorkerTimelineItem[] {
  return [...active, ...resolved].map((event) => ({
    id: event.event_id, label: event.description, timestamp: event.timestamp, severity: event.severity,
  })).concat(workers.flatMap((worker) => worker.timeline))
    .sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
}
export function getCameraById(cameras: CameraFeed[], id: string) {
  return cameras.find((camera) => camera.id === normalizeCameraId(id));
}
