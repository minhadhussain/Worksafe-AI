"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, MapPin, Move3D, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@vigil-os/shared/components/ui/card";
import { Button } from "@vigil-os/shared/components/ui/button";
import { getHealth } from "@vigil-os/shared/lib/health";
import { cn } from "@vigil-os/shared/lib/utils";

type ShiftState = "idle" | "connecting" | "streaming" | "stopped" | "error";
type CapabilityState = "pending" | "granted" | "denied" | "unavailable";
type SocketState = "idle" | "connecting" | "connected" | "disconnected" | "error";

type MotionSample = {
  accelG: number;
  gyroRad: number;
  capturedAt: number | null;
};

type LocationSample = {
  lat: number;
  lng: number;
};

type WorkerSocketMessage = {
  type?: string;
  detail?: string;
  zone_label?: string;
};

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
};

type DeviceMotionPermissionConstructor = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

const WORKER_ID = process.env.NEXT_PUBLIC_WORKER_ID || "W-001";
const WORKER_TOKEN = process.env.NEXT_PUBLIC_WORKER_TOKEN || "dev_device_worker_001";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || API_BASE_URL.replace(/^http/i, "ws");
const SAMPLE_INTERVAL_MS = 100;
const EMPTY_MOTION: MotionSample = { accelG: 0, gyroRad: 0, capturedAt: null };

function buildWorkerSocketUrl(workerId: string, token: string): string {
  const url = new URL(WS_BASE_URL.replace(/^http/i, "ws"));
  const basePath = url.pathname.replace(/\/$/, "");
  url.pathname = basePath.endsWith("/ws")
    ? `${basePath}/telemetry/worker/${encodeURIComponent(workerId)}`
    : `${basePath}/ws/telemetry/worker/${encodeURIComponent(workerId)}`;
  url.searchParams.set("token", token);
  return url.toString();
}

function readMotionSample(event: DeviceMotionEvent): MotionSample {
  const acceleration = event.accelerationIncludingGravity || event.acceleration;
  const x = acceleration?.x || 0;
  const y = acceleration?.y || 0;
  const z = acceleration?.z || 0;
  const alpha = event.rotationRate?.alpha || 0;
  const beta = event.rotationRate?.beta || 0;
  const gamma = event.rotationRate?.gamma || 0;

  return {
    accelG: Number((Math.hypot(x, y, z) / 9.80665).toFixed(2)),
    gyroRad: Number((Math.hypot(alpha, beta, gamma) * (Math.PI / 180)).toFixed(2)),
    capturedAt: Date.now(),
  };
}

async function requestMotionPermission(): Promise<CapabilityState> {
  if (typeof window === "undefined" || typeof window.DeviceMotionEvent === "undefined") {
    return "unavailable";
  }

  const constructor = window.DeviceMotionEvent as DeviceMotionPermissionConstructor;
  if (!constructor.requestPermission) {
    return "granted";
  }

  try {
    return (await constructor.requestPermission()) === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

function formatCapabilityState(state: CapabilityState | SocketState): string {
  switch (state) {
    case "granted":
      return "Active";
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting";
    case "disconnected":
      return "Disconnected";
    case "error":
      return "Error";
    case "denied":
      return "Denied";
    case "unavailable":
      return "Unavailable";
    default:
      return "Waiting";
  }
}

function toneClasses(state: CapabilityState | SocketState): string {
  if (state === "granted" || state === "connected") return "bg-emerald-400";
  if (state === "connecting" || state === "pending") return "bg-amber-300";
  return "bg-rose-300";
}

function formatLocation(location: LocationSample | null): string {
  if (!location) return "Unknown Zone fallback";
  return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
}

function formatSampleTime(timestamp: number | null): string {
  if (!timestamp) return "Waiting for sample";
  return new Date(timestamp).toLocaleTimeString();
}

function StatusTile({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-muted/35 p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{title}</p>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

export function WorkerConnect() {
  const [shiftState, setShiftState] = useState<ShiftState>("idle");
  const [socketState, setSocketState] = useState<SocketState>("idle");
  const [motionState, setMotionState] = useState<CapabilityState>("pending");
  const [locationState, setLocationState] = useState<CapabilityState>("pending");
  const [wakeLockState, setWakeLockState] = useState<CapabilityState>("pending");
  const [motion, setMotion] = useState<MotionSample>(EMPTY_MOTION);
  const [location, setLocation] = useState<LocationSample | null>(null);
  const [zoneLabel, setZoneLabel] = useState("Unknown Zone");
  const [statusMessage, setStatusMessage] = useState(
    "Tap Start Shift to request motion and location access, then begin live telemetry.",
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [streamingSince, setStreamingSince] = useState<number | null>(null);

  const motionRef = useRef<MotionSample>(EMPTY_MOTION);
  const locationRef = useRef<LocationSample | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const sendIntervalRef = useRef<number | null>(null);
  const locationWatchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const shiftActiveRef = useRef(false);
  const motionListenerRef = useRef<(event: DeviceMotionEvent) => void>((event) => {
    motionRef.current = readMotionSample(event);
  });

  useEffect(() => {
    async function cleanupResources() {
      shiftActiveRef.current = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("devicemotion", motionListenerRef.current);
      }
      if (sendIntervalRef.current !== null) {
        window.clearInterval(sendIntervalRef.current);
        sendIntervalRef.current = null;
      }
      if (locationWatchIdRef.current !== null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;
        if (socketRef.current.readyState < WebSocket.CLOSING) {
          socketRef.current.close(1000, "Worker stopped");
        }
        socketRef.current = null;
      }
      if (wakeLockRef.current) {
        await wakeLockRef.current.release().catch(() => undefined);
        wakeLockRef.current = null;
      }
    }

    return () => {
      void cleanupResources();
    };
  }, []);

  async function cleanupResources() {
    shiftActiveRef.current = false;
    window.removeEventListener("devicemotion", motionListenerRef.current);
    if (sendIntervalRef.current !== null) {
      window.clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }
    if (locationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.onopen = null;
      socketRef.current.onmessage = null;
      socketRef.current.onerror = null;
      socketRef.current.onclose = null;
      if (socketRef.current.readyState < WebSocket.CLOSING) {
        socketRef.current.close(1000, "Worker stopped");
      }
      socketRef.current = null;
    }
    if (wakeLockRef.current) {
      await wakeLockRef.current.release().catch(() => undefined);
      wakeLockRef.current = null;
    }
  }

  async function stopShift(
    nextState: Exclude<ShiftState, "connecting" | "idle"> = "stopped",
    message = "Shift telemetry stopped.",
  ) {
    await cleanupResources();
    setShiftState(nextState);
    setSocketState("disconnected");
    setWakeLockState((current) => (current === "granted" ? "pending" : current));
    setStatusMessage(message);
    setStreamingSince(null);
  }

  function beginLocationWatch() {
    if (!("geolocation" in navigator)) {
      setLocationState("unavailable");
      setZoneLabel("Unknown Zone");
      return;
    }

    try {
      locationWatchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const nextLocation = {
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6)),
          };
          locationRef.current = nextLocation;
          setLocation(nextLocation);
          setLocationState("granted");
        },
        (error) => {
          locationRef.current = null;
          setLocation(null);
          setLocationState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
          setZoneLabel("Unknown Zone");
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 10_000 },
      );
    } catch {
      setLocationState("unavailable");
    }
  }

  async function acquireWakeLock() {
    if (!window.isSecureContext) {
      setWakeLockState("unavailable");
      return;
    }

    const wakeLockNavigator = navigator as WakeLockNavigator;
    if (!wakeLockNavigator.wakeLock) {
      setWakeLockState("unavailable");
      return;
    }

    try {
      const sentinel = await wakeLockNavigator.wakeLock.request("screen");
      sentinel.addEventListener?.("release", () => {
        wakeLockRef.current = null;
        setWakeLockState("pending");
      });
      wakeLockRef.current = sentinel;
      setWakeLockState("granted");
    } catch {
      setWakeLockState("denied");
    }
  }

  function openTelemetrySocket(
    workerId: string,
    token: string,
    motionPermission: CapabilityState,
  ) {
    const socket = new WebSocket(buildWorkerSocketUrl(workerId, token));
    socketRef.current = socket;

    socket.onopen = () => {
      setSocketState("connected");
      setShiftState("streaming");
      setStreamingSince(Date.now());
      setStatusMessage(
        motionPermission === "denied"
          ? "Connected. GPS and backend sync are live; motion access is limited."
          : "Connected. Motion, location, and WebSocket telemetry are streaming.",
      );
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WorkerSocketMessage;
        if (message.type === "worker.connected") {
          setZoneLabel(message.zone_label || "Unknown Zone");
          return;
        }
        if (message.type === "worker.accepted") {
          setZoneLabel(message.zone_label || "Unknown Zone");
          setLastSyncedAt(Date.now());
          return;
        }
        if (message.type === "worker.error") {
          void stopShift("error", message.detail || "Worker telemetry was rejected by the API.");
        }
      } catch {
        setStatusMessage("Received an unreadable server message on the telemetry channel.");
      }
    };

    socket.onerror = () => {
      setSocketState("error");
      setShiftState("error");
      setStatusMessage("The worker telemetry channel could not be established.");
    };

    socket.onclose = (event) => {
      setSocketState("disconnected");
      if (shiftActiveRef.current) {
        void stopShift("error", event.reason || "The worker telemetry channel closed unexpectedly.");
      }
    };
  }

  function sendTelemetrySnapshot() {
    const socket = socketRef.current;
    if (!shiftActiveRef.current || !socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const payload = {
      client_type: "worker_mobile",
      worker_id: WORKER_ID,
      timestamp: Math.floor(Date.now() / 1000),
      motion: {
        accel_g: motionRef.current.accelG,
        gyro_rad: motionRef.current.gyroRad,
      },
      location: locationRef.current,
    };

    socket.send(JSON.stringify(payload));
    setMotion(motionRef.current);
    setLocation(locationRef.current);
  }

  async function startShift() {
    if (shiftState === "connecting") return;

    await cleanupResources();
    motionRef.current = EMPTY_MOTION;
    locationRef.current = null;
    shiftActiveRef.current = true;
    setShiftState("connecting");
    setSocketState("connecting");
    setMotionState("pending");
    setLocationState("pending");
    setWakeLockState("pending");
    setMotion(EMPTY_MOTION);
    setLocation(null);
    setZoneLabel("Unknown Zone");
    setLastSyncedAt(null);
    setStreamingSince(null);
    setStatusMessage("Checking backend readiness and requesting sensor access…");

    try {
      const health = await getHealth(AbortSignal.timeout(5_000));
      if (health.status !== "ready") {
        throw new Error("The API or Redis is not ready for telemetry streaming.");
      }

      const motionPermission = await requestMotionPermission();
      setMotionState(motionPermission);

      window.addEventListener("devicemotion", motionListenerRef.current);
      beginLocationWatch();
      await acquireWakeLock();

      setStatusMessage(
        motionPermission === "denied"
          ? "Motion access was denied. GPS and connectivity will continue with limited telemetry."
          : "Opening the worker telemetry channel…",
      );

      openTelemetrySocket(WORKER_ID, WORKER_TOKEN, motionPermission);
      sendIntervalRef.current = window.setInterval(sendTelemetrySnapshot, SAMPLE_INTERVAL_MS);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unable to start the worker shift.";
      await stopShift("error", detail);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <Button size="lg" className="flex-1 min-w-52" onClick={startShift} disabled={shiftState === "connecting"}>
          {shiftState === "connecting" ? (
            <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight aria-hidden="true" />
          )}
          {shiftState === "streaming" ? "Reconnect Shift" : "Start Shift & Connect"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="min-w-40"
          onClick={() => void stopShift()}
          disabled={shiftState !== "streaming" && shiftState !== "error"}
        >
          Stop Shift
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" /> Shift status
          </CardTitle>
          <CardDescription>
            Motion, GPS, wake lock, and WebSocket telemetry activate from the Start Shift tap.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div role="status" className="rounded-lg border border-border/80 bg-muted/25 p-4 text-sm leading-relaxed">
            <p className="font-medium text-foreground">{statusMessage}</p>
            <p className="mt-2 text-muted-foreground">
              Worker ID <span className="font-mono text-foreground">{WORKER_ID}</span> · Zone label <span className="font-medium text-foreground">{zoneLabel}</span>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatusTile
              title="Telemetry channel"
              value={formatCapabilityState(socketState)}
              hint={
                socketState === "connected"
                  ? "Live WebSocket stream to the API is active."
                  : "The worker WebSocket opens after the sensor permissions flow."
              }
            />
            <StatusTile
              title="Motion sensor"
              value={formatCapabilityState(motionState)}
              hint="Accelerometer and gyroscope readings are sampled from DeviceMotion."
            />
            <StatusTile
              title="Location"
              value={formatCapabilityState(locationState)}
              hint={location ? formatLocation(location) : "Falls back to Unknown Zone if GPS is denied."}
            />
            <StatusTile
              title="Wake lock"
              value={formatCapabilityState(wakeLockState)}
              hint="Prevents screen sleep on supported, secure mobile browsers."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Latest worker payload</CardTitle>
          <CardDescription>
            Preview of the `worker_mobile` WebSocket payload being sent at 10 Hz.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border/80 bg-muted/25 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Move3D className="size-4 text-primary" aria-hidden="true" /> Motion sample
            </p>
            <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-between gap-4">
                <dt>Acceleration</dt>
                <dd className="font-mono text-foreground">{motion.accelG.toFixed(2)} g</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>Gyroscope</dt>
                <dd className="font-mono text-foreground">{motion.gyroRad.toFixed(2)} rad/s</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>Last sample</dt>
                <dd className="font-mono text-foreground">{formatSampleTime(motion.capturedAt)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/25 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <MapPin className="size-4 text-primary" aria-hidden="true" /> Position sample
            </p>
            <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-between gap-4">
                <dt>Coordinates</dt>
                <dd className="font-mono text-foreground">{formatLocation(location)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>Backend sync</dt>
                <dd className="font-mono text-foreground">{formatSampleTime(lastSyncedAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>Streaming since</dt>
                <dd className="font-mono text-foreground">{formatSampleTime(streamingSince)}</dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn("size-2 rounded-full", toneClasses(socketState))} />
        No camera or microphone access is requested on this device. Motion and location only.
      </div>
    </div>
  );
}
