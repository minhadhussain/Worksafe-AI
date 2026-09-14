"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  buildRecentEvents,
  buildZoneRecords,
  createInitialDashboardState,
  getCameraById,
  summarizeWorkers,
  type CameraFeed,
  type DetectionLabel,
  type DashboardState,
  type SafetyEvent,
} from "@/lib/dashboard-data";

type WorkerConnectionEvent = {
  type: "worker.connection";
  status: "connected" | "disconnected";
  worker_id: string;
  zone_label?: string;
};

type WorkerTelemetryEvent = {
  type: "worker.telemetry";
  worker_id: string;
  timestamp: number;
  zone_label?: string;
  motion?: {
    accel_g?: number;
    gyro_rad?: number;
  };
};

type VisionFrameEvent = {
  type: "vision.frame.processed";
  camera_id: string;
  timestamp?: number | null;
  missing_classes?: string[];
  inference_ms?: number;
  detections?: Array<{
    label?: string;
    confidence?: number;
    classification?: string;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }>;
  annotated_frame_base64?: string | null;
};

type DashboardRealtimeEvent = WorkerConnectionEvent | WorkerTelemetryEvent | VisionFrameEvent;

type DashboardContextValue = {
  adminIdentifier: string;
  state: DashboardState;
  now: number;
  socketStatus: "connecting" | "connected" | "disconnected";
  summary: ReturnType<typeof summarizeWorkers>;
  zones: ReturnType<typeof buildZoneRecords>;
  recentEvents: ReturnType<typeof buildRecentEvents>;
  resetDemoState: () => void;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || API_BASE_URL.replace(/^http/i, "ws");

function buildAdminAlertsSocketUrl(): string {
  const url = new URL(WS_BASE_URL.replace(/^http/i, "ws"));
  const basePath = url.pathname.replace(/\/$/, "");
  url.pathname = basePath.endsWith("/ws") ? `${basePath}/admin/alerts` : `${basePath}/ws/admin/alerts`;
  return url.toString();
}

function upsertAlert(alerts: SafetyEvent[], alert: SafetyEvent): SafetyEvent[] {
  const withoutExisting = alerts.filter((item) => item.event_id !== alert.event_id);
  return [alert, ...withoutExisting].sort((left, right) => right.timestamp - left.timestamp);
}

function mapDetectionLabel(label: string | undefined): DetectionLabel | null {
  const normalized = (label || "").trim().toLowerCase();
  if (normalized === "person") return "Person";
  if (normalized === "hardhat" || normalized === "helmet") return "Hardhat";
  if (normalized === "no-hardhat" || normalized === "no hardhat" || normalized === "without hardhat") {
    return "NO-Hardhat";
  }
  if (normalized === "safety vest" || normalized === "vest") return "Safety Vest";
  if (normalized === "no-safety vest" || normalized === "no safety vest") return "NO-Safety Vest";
  if (normalized === "mask") return "Mask";
  if (normalized === "no-mask" || normalized === "no mask") return "NO-Mask";
  return null;
}

function updateWorkerFromTelemetry(state: DashboardState, event: WorkerTelemetryEvent): DashboardState {
  const accelG = event.motion?.accel_g ?? 0;
  const workerIndex = state.workers.findIndex((worker) => worker.id === event.worker_id);
  if (workerIndex === -1) {
    return state;
  }

  const workers = [...state.workers];
  const currentWorker = workers[workerIndex];
  const isFall = accelG >= 2.5;
  workers[workerIndex] = {
    ...currentWorker,
    connectivity: "online",
    lastSeenAt: event.timestamp * 1000,
    motion: isFall ? "fall_detected" : "normal",
    status: isFall ? "critical" : currentWorker.status,
  };

  let activeAlerts = state.activeAlerts;
  if (isFall) {
    activeAlerts = upsertAlert(activeAlerts, {
      event_id: `live-fall-${event.worker_id}`,
      type: "FALL_DETECTED",
      severity: "critical",
      source: `Worker ${event.worker_id}`,
      worker_id: event.worker_id,
      zone_id: currentWorker.zoneId,
      timestamp: event.timestamp * 1000,
      status: "active",
      metadata: { accel_g: accelG },
      title: "FALL DETECTED",
      description: `${event.worker_id} exceeded the fall threshold during live telemetry`,
    });
  }

  return {
    ...state,
    workers,
    activeAlerts,
  };
}

function updateWorkerConnection(state: DashboardState, event: WorkerConnectionEvent): DashboardState {
  const workerIndex = state.workers.findIndex((worker) => worker.id === event.worker_id);
  if (workerIndex === -1) return state;

  const workers = [...state.workers];
  const currentWorker = workers[workerIndex];
  workers[workerIndex] = {
    ...currentWorker,
    connectivity: event.status === "connected" ? "online" : "offline",
  };
  return {
    ...state,
    workers,
  };
}

function updateCameraFromVision(state: DashboardState, event: VisionFrameEvent): DashboardState {
  const camera = getCameraById(state.cameras, event.camera_id);
  if (!camera) return state;

  const labels = (event.detections || [])
    .map((detection) => mapDetectionLabel(detection.label))
    .filter((label): label is DetectionLabel => Boolean(label));
  const workersDetected = labels.filter((label) => label === "Person").length || camera.workersDetected;
  const hardhatsDetected = labels.filter((label) => label === "Hardhat").length;
  const noHardhats = Math.max(
    labels.filter((label) => label === "NO-Hardhat").length,
    event.missing_classes?.includes("hardhat") ? workersDetected - hardhatsDetected : 0,
  );
  const safetyVests = labels.filter((label) => label === "Safety Vest").length || camera.safetyVests;
  const noSafetyVests = labels.filter((label) => label === "NO-Safety Vest").length;
  const masks = labels.filter((label) => label === "Mask").length;
  const noMasks = labels.filter((label) => label === "NO-Mask").length;
  const compliancePercent = workersDetected > 0 ? Math.max(0, Math.round(((workersDetected - noHardhats) / workersDetected) * 100)) : camera.compliancePercent;
  const updatedAt = (event.timestamp || Math.floor(Date.now() / 1000)) * 1000;
  const previousUpdatedAt = camera.updatedAt || updatedAt;
  const frameGapMs = Math.max(1, updatedAt - previousUpdatedAt);
  const fps = event.inference_ms ? Math.max(1, Math.round(1000 / frameGapMs)) : camera.fps;

  const cameras: CameraFeed[] = state.cameras.map((item) =>
    item.id === camera.id
      ? {
          ...item,
          workersDetected,
          hardhatsDetected,
          noHardhats,
          safetyVests,
          noSafetyVests,
          masks,
          noMasks,
          ppeViolations: noHardhats + noSafetyVests + noMasks,
          compliancePercent,
          interpretation: noHardhats > 0 || noSafetyVests > 0 || noMasks > 0 ? "PPE VIOLATION" : "COMPLIANT",
          latestAnnotatedFrame: event.annotated_frame_base64 || item.latestAnnotatedFrame,
          inferenceMs: event.inference_ms || item.inferenceMs,
          fps,
          updatedAt,
        }
      : item,
  );

  const zoneId = camera.zoneId;
  const activeAlerts = noHardhats > 0 || noSafetyVests > 0 || noMasks > 0
    ? upsertAlert(state.activeAlerts, {
        event_id: `vision-${camera.id}`,
        type: "PPE_VIOLATION",
        severity: noHardhats >= 2 ? "critical" : "high",
        source: camera.name.replace("CAMERA", "CAM"),
        camera_id: camera.id,
        zone_id: zoneId,
        timestamp: updatedAt,
        status: "active",
        metadata: {
          no_hardhats: noHardhats,
          no_safety_vests: noSafetyVests,
          no_masks: noMasks,
        },
        title: "PPE VIOLATION",
        description: `${noHardhats} worker${noHardhats > 1 ? "s" : ""} without hardhats`,
      })
    : state.activeAlerts.filter((alert) => alert.event_id !== `vision-${camera.id}`);

  return {
    ...state,
    cameras,
    activeAlerts,
  };
}

export function DashboardProvider({
  adminIdentifier,
  children,
}: {
  adminIdentifier: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<DashboardState>(() => createInitialDashboardState());
  const [now, setNow] = useState(() => Date.now());
  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "disconnected">(
    "connecting",
  );
  const resetDemoState = useCallback(() => {
    setState(createInitialDashboardState());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const socket = new WebSocket(buildAdminAlertsSocketUrl());

    socket.onopen = () => {
      if (!active) return;
      setSocketStatus("connected");
    };

    socket.onmessage = (message) => {
      if (!active) return;
      try {
        const event = JSON.parse(message.data) as DashboardRealtimeEvent;
        setState((current) => {
          if (event.type === "worker.telemetry") return updateWorkerFromTelemetry(current, event);
          if (event.type === "worker.connection") return updateWorkerConnection(current, event);
          if (event.type === "vision.frame.processed") return updateCameraFromVision(current, event);
          return current;
        });
      } catch {
        // Ignore unreadable events; the dashboard continues with demo data.
      }
    };

    socket.onerror = () => {
      if (!active) return;
      setSocketStatus("disconnected");
    };

    socket.onclose = () => {
      if (!active) return;
      setSocketStatus("disconnected");
    };

    return () => {
      active = false;
      if (socket.readyState < WebSocket.CLOSING) {
        socket.close(1000, "Dashboard unmounted");
      }
    };
  }, []);

  const summary = useMemo(() => summarizeWorkers(state.workers), [state.workers]);
  const zones = useMemo(
    () => buildZoneRecords(state.workers, state.activeAlerts),
    [state.activeAlerts, state.workers],
  );
  const recentEvents = useMemo(
    () => buildRecentEvents(state.activeAlerts, state.resolvedAlerts, state.workers),
    [state.activeAlerts, state.resolvedAlerts, state.workers],
  );

  const value = useMemo<DashboardContextValue>(
    () => ({
      adminIdentifier,
      state,
      now,
      socketStatus,
      summary,
      zones,
      recentEvents,
      resetDemoState,
    }),
    [adminIdentifier, now, recentEvents, resetDemoState, socketStatus, state, summary, zones],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboardData() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboardData must be used inside DashboardProvider");
  }
  return context;
}
