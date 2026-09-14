export type SafetySeverity = "safe" | "warning" | "high" | "critical";
export type WorkerStatus = "safe" | "warning" | "critical";
export type MotionState = "normal" | "fall_detected";
export type ConnectivityState = "online" | "offline";
export type SafetyEventType =
  | "PPE_VIOLATION"
  | "FALL_DETECTED"
  | "RESTRICTED_ZONE"
  | "ENVIRONMENTAL_HAZARD"
  | "WORKER_AT_RISK";

export type DetectionLabel =
  | "Person"
  | "Hardhat"
  | "NO-Hardhat"
  | "Safety Vest"
  | "NO-Safety Vest"
  | "Mask"
  | "NO-Mask";

export type CameraSourceKind = "local_mp4" | "remote_url" | "processed_output" | "unconfigured";

export type CameraDetection = {
  id: string;
  workerId?: string;
  labels: DetectionLabel[];
  interpretation: "COMPLIANT" | "PPE VIOLATION";
  severity: "compliant" | "warning" | "critical";
  confidence: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type CameraFeed = {
  id: string;
  name: string;
  zoneId: string;
  zoneName: string;
  status: "online" | "offline";
  scenarioLabel: string;
  interpretation: "COMPLIANT" | "PPE VIOLATION";
  source: {
    kind: CameraSourceKind;
    src: string | null;
  };
  workersDetected: number;
  hardhatsDetected: number;
  noHardhats: number;
  safetyVests: number;
  noSafetyVests: number;
  masks: number;
  noMasks: number;
  ppeViolations: number;
  compliancePercent: number;
  fps: number;
  inferenceMs: number;
  detections: CameraDetection[];
  latestAnnotatedFrame: string | null;
  updatedAt: number;
};

export type WorkerTimelineItem = {
  id: string;
  timestamp: number;
  label: string;
  severity: SafetySeverity;
};

export type WorkerRecord = {
  id: string;
  status: WorkerStatus;
  zoneId: string;
  zoneName: string;
  ppe: {
    hardhat: boolean;
    vest: boolean;
    mask: boolean;
  };
  motion: MotionState;
  lastSeenAt: number;
  connectivity: ConnectivityState;
  position: {
    x: number;
    y: number;
  };
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

export type ZoneBase = {
  id: string;
  name: string;
  defaultLevel: SafetySeverity;
  cameraIds: string[];
};

export type ZoneRecord = ZoneBase & {
  level: SafetySeverity;
  workersPresent: number;
  activeIncidents: number;
  contributingFactors: string[];
};

export type DashboardState = {
  siteName: string;
  workers: WorkerRecord[];
  cameras: CameraFeed[];
  activeAlerts: SafetyEvent[];
  resolvedAlerts: SafetyEvent[];
};

const DEMO_SITE_NAME = "Factory A";
const DEFAULT_CAMERA_01_SOURCE = "/demo/cam-01-compliant.mp4";
const DEFAULT_CAMERA_02_SOURCE = "/demo/cam-02-violation.mp4";
const ZONE_BASES: ZoneBase[] = [
  { id: "zone-01", name: "ZONE-01", defaultLevel: "safe", cameraIds: ["camera-01"] },
  { id: "zone-02", name: "ZONE-02", defaultLevel: "critical", cameraIds: ["camera-02"] },
  { id: "zone-03", name: "ZONE-03", defaultLevel: "high", cameraIds: [] },
  { id: "zone-04", name: "ZONE-04", defaultLevel: "warning", cameraIds: [] },
];

function inferCameraSourceKind(src: string | null): CameraSourceKind {
  if (!src) return "unconfigured";
  if (/processed|annotated/i.test(src)) return "processed_output";
  if (/^https?:\/\//i.test(src)) return "remote_url";
  return "local_mp4";
}

function cameraSourceFromEnv(value: string | undefined, fallback: string) {
  const src = value?.trim() || fallback;
  return {
    kind: inferCameraSourceKind(src),
    src,
  };
}

function createTimeline(items: Array<[string, number, SafetySeverity]>): WorkerTimelineItem[] {
  return items.map(([label, timestamp, severity], index) => ({
    id: `timeline-${index}-${timestamp}`,
    label,
    timestamp,
    severity,
  }));
}

function createWorker(
  id: string,
  zoneId: string,
  zoneName: string,
  position: { x: number; y: number },
  options: Partial<WorkerRecord>,
): WorkerRecord {
  const now = Date.now();
  return {
    id,
    status: "safe",
    zoneId,
    zoneName,
    ppe: { hardhat: true, vest: true, mask: true },
    motion: "normal",
    lastSeenAt: now - 4_000,
    connectivity: "online",
    position,
    timeline: createTimeline([
      [`Entered ${zoneName}`, now - 8 * 60_000, "safe"],
      ["Telemetry synced", now - 2 * 60_000, "safe"],
    ]),
    ...options,
  };
}

function createInitialWorkers(): WorkerRecord[] {
  const now = Date.now();
  return [
    createWorker("W-001", "zone-01", "ZONE-01", { x: 16, y: 24 }, { lastSeenAt: now - 12_000 }),
    createWorker("W-002", "zone-02", "ZONE-02", { x: 42, y: 28 }, {
      status: "critical",
      ppe: { hardhat: false, vest: true, mask: true },
      lastSeenAt: now - 1_000,
      timeline: createTimeline([
        ["NO-HARDHAT DETECTED", now - 5_000, "critical"],
        ["Entered CAM-02 view", now - 3 * 60_000, "warning"],
      ]),
    }),
    createWorker("W-003", "zone-02", "ZONE-02", { x: 61, y: 31 }, {
      status: "warning",
      ppe: { hardhat: true, vest: false, mask: true },
      lastSeenAt: now - 8_000,
      timeline: createTimeline([
        ["NO-SAFETY-VEST", now - 60_000, "high"],
        ["Entered ZONE-02", now - 10 * 60_000, "safe"],
      ]),
    }),
    createWorker("W-004", "zone-01", "ZONE-01", { x: 22, y: 63 }, { lastSeenAt: now - 22_000 }),
    createWorker("W-005", "zone-01", "ZONE-01", { x: 48, y: 58 }, { lastSeenAt: now - 18_000 }),
    createWorker("W-006", "zone-01", "ZONE-01", { x: 72, y: 68 }, { lastSeenAt: now - 15_000 }),
    createWorker("W-007", "zone-03", "ZONE-03", { x: 34, y: 46 }, {
      status: "warning",
      motion: "fall_detected",
      lastSeenAt: now - 2_000,
      timeline: createTimeline([
        ["FALL DETECTED", now - 90_000, "high"],
        ["Entered ZONE-03", now - 4 * 60_000, "warning"],
      ]),
    }),
    createWorker("W-008", "zone-03", "ZONE-03", { x: 58, y: 22 }, { lastSeenAt: now - 16_000 }),
    createWorker("W-009", "zone-03", "ZONE-03", { x: 74, y: 32 }, { lastSeenAt: now - 19_000 }),
    createWorker("W-010", "zone-03", "ZONE-03", { x: 24, y: 68 }, { lastSeenAt: now - 21_000 }),
    createWorker("W-011", "zone-02", "ZONE-02", { x: 18, y: 24 }, { lastSeenAt: now - 14_000 }),
    createWorker("W-012", "zone-02", "ZONE-02", { x: 40, y: 36 }, { lastSeenAt: now - 17_000 }),
    createWorker("W-013", "zone-02", "ZONE-02", { x: 68, y: 29 }, { lastSeenAt: now - 26_000 }),
    createWorker("W-014", "zone-02", "ZONE-02", { x: 80, y: 24 }, { lastSeenAt: now - 29_000 }),
    createWorker("W-015", "zone-02", "ZONE-02", { x: 29, y: 72 }, { lastSeenAt: now - 24_000 }),
    createWorker("W-016", "zone-04", "ZONE-04", { x: 20, y: 22 }, { lastSeenAt: now - 15_000 }),
    createWorker("W-017", "zone-04", "ZONE-04", { x: 46, y: 38 }, { lastSeenAt: now - 13_000 }),
    createWorker("W-018", "zone-04", "ZONE-04", { x: 69, y: 24 }, { lastSeenAt: now - 11_000 }),
    createWorker("W-019", "zone-04", "ZONE-04", { x: 82, y: 44 }, { lastSeenAt: now - 18_000 }),
    createWorker("W-020", "zone-04", "ZONE-04", { x: 28, y: 68 }, { lastSeenAt: now - 21_000 }),
    createWorker("W-021", "zone-03", "ZONE-03", { x: 55, y: 64 }, { lastSeenAt: now - 30_000 }),
    createWorker("W-022", "zone-03", "ZONE-03", { x: 81, y: 70 }, { lastSeenAt: now - 31_000 }),
    createWorker("W-023", "zone-04", "ZONE-04", { x: 32, y: 74 }, { lastSeenAt: now - 20_000 }),
    createWorker("W-024", "zone-04", "ZONE-04", { x: 76, y: 76 }, { lastSeenAt: now - 23_000 }),
  ];
}

function createInitialCameras(): CameraFeed[] {
  const now = Date.now();
  return [
    {
      id: "camera-01",
      name: "CAM-01",
      zoneId: "zone-01",
      zoneName: "PRODUCTION FLOOR",
      status: "online",
      scenarioLabel: "COMPLIANT SCENARIO",
      interpretation: "COMPLIANT",
      source: cameraSourceFromEnv(process.env.NEXT_PUBLIC_CAMERA_01_SOURCE, DEFAULT_CAMERA_01_SOURCE),
      workersDetected: 2,
      hardhatsDetected: 2,
      noHardhats: 0,
      safetyVests: 2,
      noSafetyVests: 0,
      masks: 0,
      noMasks: 0,
      ppeViolations: 0,
      compliancePercent: 100,
      fps: 18,
      inferenceMs: 52,
      latestAnnotatedFrame: null,
      updatedAt: now,
      detections: [
        {
          id: "cam1-worker-1",
          workerId: "W-001",
          labels: ["Person", "Hardhat", "Safety Vest"],
          interpretation: "COMPLIANT",
          severity: "compliant",
          confidence: 0.96,
          left: 17,
          top: 16,
          width: 18,
          height: 62,
        },
        {
          id: "cam1-worker-2",
          workerId: "W-004",
          labels: ["Person", "Hardhat", "Safety Vest"],
          interpretation: "COMPLIANT",
          severity: "compliant",
          confidence: 0.93,
          left: 56,
          top: 15,
          width: 18,
          height: 64,
        },
      ],
    },
    {
      id: "camera-02",
      name: "CAM-02",
      zoneId: "zone-02",
      zoneName: "PRODUCTION FLOOR",
      status: "online",
      scenarioLabel: "PPE VIOLATION SCENARIO",
      interpretation: "PPE VIOLATION",
      source: cameraSourceFromEnv(process.env.NEXT_PUBLIC_CAMERA_02_SOURCE, DEFAULT_CAMERA_02_SOURCE),
      workersDetected: 2,
      hardhatsDetected: 0,
      noHardhats: 2,
      safetyVests: 1,
      noSafetyVests: 1,
      masks: 0,
      noMasks: 0,
      ppeViolations: 2,
      compliancePercent: 0,
      fps: 18,
      inferenceMs: 68,
      latestAnnotatedFrame: null,
      updatedAt: now,
      detections: [
        {
          id: "cam2-worker-1",
          workerId: "W-002",
          labels: ["Person", "NO-Hardhat", "Safety Vest"],
          interpretation: "PPE VIOLATION",
          severity: "critical",
          confidence: 0.91,
          left: 18,
          top: 16,
          width: 18,
          height: 63,
        },
        {
          id: "cam2-worker-2",
          workerId: "W-003",
          labels: ["Person", "NO-Hardhat", "NO-Safety Vest"],
          interpretation: "PPE VIOLATION",
          severity: "critical",
          confidence: 0.89,
          left: 57,
          top: 16,
          width: 18,
          height: 63,
        },
      ],
    },
  ];
}

function createInitialAlerts(): { active: SafetyEvent[]; resolved: SafetyEvent[] } {
  const now = Date.now();
  return {
    active: [
      {
        event_id: "evt-001",
        type: "PPE_VIOLATION",
        severity: "critical",
        source: "CAM-02",
        camera_id: "camera-02",
        zone_id: "zone-02",
        timestamp: now - 18_000,
        status: "active",
        metadata: { impacted_workers: 2, cause: "NO-Hardhat" },
        title: "PPE VIOLATION",
        description: "2 workers without hardhats",
      },
      {
        event_id: "evt-002",
        type: "PPE_VIOLATION",
        severity: "high",
        source: "Worker W-003",
        worker_id: "W-003",
        zone_id: "zone-02",
        timestamp: now - 60_000,
        status: "active",
        metadata: { missing_ppe: "Safety Vest" },
        title: "PPE VIOLATION",
        description: "Missing safety vest",
      },
      {
        event_id: "evt-003",
        type: "FALL_DETECTED",
        severity: "high",
        source: "Worker W-007",
        worker_id: "W-007",
        zone_id: "zone-03",
        timestamp: now - 2 * 60_000,
        status: "active",
        metadata: { motion_state: "fall_detected" },
        title: "FALL DETECTED",
        description: "Worker W-007",
      },
    ],
    resolved: [
      {
        event_id: "evt-101",
        type: "WORKER_AT_RISK",
        severity: "warning",
        source: "Worker W-014",
        worker_id: "W-014",
        zone_id: "zone-02",
        timestamp: now - 45 * 60_000,
        status: "resolved",
        metadata: { reason: "Stopped near forklift route" },
        title: "WORKER AT RISK",
        description: "Worker moved clear of the forklift lane",
      },
      {
        event_id: "evt-102",
        type: "PPE_VIOLATION",
        severity: "warning",
        source: "CAM-01",
        camera_id: "camera-01",
        zone_id: "zone-01",
        timestamp: now - 90 * 60_000,
        status: "resolved",
        metadata: { impacted_workers: 1 },
        title: "PPE VIOLATION",
        description: "Hardhat restored after supervisor intervention",
      },
    ],
  };
}

export function createInitialDashboardState(): DashboardState {
  const alerts = createInitialAlerts();
  return {
    siteName: DEMO_SITE_NAME,
    workers: createInitialWorkers(),
    cameras: createInitialCameras(),
    activeAlerts: alerts.active,
    resolvedAlerts: alerts.resolved,
  };
}

export function getWorkerPpeSummary(worker: WorkerRecord): {
  compliant: boolean;
  summary: string;
  missing: string[];
} {
  const missing: string[] = [];
  if (!worker.ppe.hardhat) missing.push("Hardhat");
  if (!worker.ppe.vest) missing.push("Safety Vest");
  if (!worker.ppe.mask) missing.push("Mask");
  return {
    compliant: missing.length === 0,
    summary: missing.length === 0 ? "COMPLIANT" : `NO-${missing.join(" / NO-").toUpperCase()}`,
    missing,
  };
}

export function formatRelativeTime(now: number, timestamp: number): string {
  const diffSeconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (diffSeconds < 60) return diffSeconds === 0 ? "NOW" : `${diffSeconds} sec`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  return `${diffHours} hr ago`;
}

export function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function workerStatusLabel(status: WorkerStatus): string {
  if (status === "critical") return "CRITICAL";
  if (status === "warning") return "WARNING";
  return "SAFE";
}

export function severityAccent(severity: SafetySeverity): string {
  if (severity === "critical") return "text-rose-300 border-rose-500/40 bg-rose-500/8";
  if (severity === "high" || severity === "warning") {
    return "text-amber-200 border-amber-400/30 bg-amber-400/8";
  }
  return "text-emerald-300 border-emerald-500/25 bg-emerald-500/8";
}

export function normalizeCameraId(cameraId: string): string {
  const normalized = cameraId.trim().toLowerCase();
  if (normalized === "cam-1" || normalized === "camera-1" || normalized === "cam-01") {
    return "camera-01";
  }
  if (normalized === "cam-2" || normalized === "camera-2" || normalized === "cam-02") {
    return "camera-02";
  }
  return normalized;
}

export function summarizeWorkers(workers: WorkerRecord[]) {
  const safe = workers.filter((worker) => worker.status === "safe").length;
  const atRisk = workers.filter((worker) => worker.status === "warning").length;
  const critical = workers.filter((worker) => worker.status === "critical").length;
  return {
    activeWorkers: workers.length,
    safe,
    atRisk,
    critical,
  };
}

export function buildZoneRecords(
  workers: WorkerRecord[],
  activeAlerts: SafetyEvent[],
): ZoneRecord[] {
  return ZONE_BASES.map((zone) => {
    const workersPresent = workers.filter((worker) => worker.zoneId === zone.id);
    const incidents = activeAlerts.filter((alert) => alert.zone_id === zone.id);
    const factorMap = new Map<string, string>();

    const ppeViolations = incidents.filter((alert) => alert.type === "PPE_VIOLATION").length;
    const falls = incidents.filter((alert) => alert.type === "FALL_DETECTED").length;
    const restricted = incidents.filter((alert) => alert.type === "RESTRICTED_ZONE").length;
    const environmental = incidents.filter((alert) => alert.type === "ENVIRONMENTAL_HAZARD").length;

    if (ppeViolations > 0) factorMap.set("ppe", `${ppeViolations} PPE violation${ppeViolations > 1 ? "s" : ""}`);
    if (falls > 0) factorMap.set("fall", `${falls} fall detected`);
    if (restricted > 0) factorMap.set("restricted", `${restricted} restricted-zone events`);
    if (environmental > 0) factorMap.set("environmental", "Machine environmental warning");
    if (workersPresent.length >= 6) factorMap.set("density", "High worker density");

    let level = zone.defaultLevel;
    if (incidents.some((alert) => alert.severity === "critical")) level = "critical";
    else if (incidents.some((alert) => alert.severity === "high")) level = "high";
    else if (incidents.length > 0 || workersPresent.some((worker) => worker.status === "warning")) {
      level = "warning";
    }

    return {
      ...zone,
      level,
      workersPresent: workersPresent.length,
      activeIncidents: incidents.length,
      contributingFactors: Array.from(factorMap.values()),
    };
  });
}

export function resolveAlertHref(alert: SafetyEvent): string {
  if (alert.worker_id) {
    return `/dashboard/workers/${encodeURIComponent(alert.worker_id)}`;
  }
  if (alert.camera_id) {
    return `/dashboard/cameras?camera=${encodeURIComponent(alert.camera_id)}`;
  }
  return `/dashboard/risk-map?zone=${encodeURIComponent(alert.zone_id)}`;
}

export function buildRecentEvents(
  activeAlerts: SafetyEvent[],
  resolvedAlerts: SafetyEvent[],
  workers: WorkerRecord[],
): WorkerTimelineItem[] {
  const alertEvents = [...activeAlerts, ...resolvedAlerts].map((alert) => ({
    id: alert.event_id,
    label: alert.description,
    timestamp: alert.timestamp,
    severity: alert.severity,
  }));

  const workerEntries = workers.flatMap((worker) => worker.timeline);

  return [...alertEvents, ...workerEntries]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 8);
}

export function getCameraById(cameras: CameraFeed[], cameraId: string): CameraFeed | undefined {
  const normalized = normalizeCameraId(cameraId);
  return cameras.find((camera) => normalizeCameraId(camera.id) === normalized);
}
