"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CircleDot,
  Clock3,
  HardHat,
  ShieldAlert,
  Shirt,
  UserRound,
} from "lucide-react";

import {
  formatClockTime,
  formatRelativeTime,
  getWorkerPpeSummary,
  resolveAlertHref,
  workerStatusLabel,
  type CameraFeed,
  type SafetyEvent,
  type SafetySeverity,
  type WorkerRecord,
} from "@/lib/dashboard-data";
import { cn } from "@vigil-os/shared/lib/utils";

function severityText(severity: SafetySeverity): string {
  if (severity === "critical") return "text-red-300";
  if (severity === "high" || severity === "warning") return "text-amber-300";
  return "text-white";
}

function workerStatusTone(status: WorkerRecord["status"]): string {
  if (status === "critical") return "text-red-300";
  if (status === "warning") return "text-amber-300";
  return "text-white";
}

function cameraInterpretationTone(camera: CameraFeed): string {
  return camera.interpretation === "PPE VIOLATION" ? "text-red-300 border-red-500/35" : "text-white border-white/15";
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-lime-300">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">{description}</p>
        ) : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function SiteSummaryStrip({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="border border-white/10 bg-black">
      <div className="grid grid-cols-2 md:grid-cols-4">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              "px-5 py-4",
              index !== items.length - 1 && "border-r border-white/10",
              index < items.length - 2 && "border-b border-white/10 md:border-b-0",
            )}
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">{item.label}</p>
            <p
              className={cn(
                "mt-2 text-[30px] font-semibold tracking-tight",
                item.label === "Critical"
                  ? "text-red-300"
                  : item.label === "At Risk"
                    ? "text-amber-300"
                    : "text-white",
              )}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CameraSelectorTabs({
  cameras,
  selectedCameraId,
  onSelect,
  onReset,
}: {
  cameras: CameraFeed[];
  selectedCameraId: string;
  onSelect: (cameraId: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-5">
      {cameras.map((camera) => (
        <button
          key={camera.id}
          type="button"
          onClick={() => onSelect(camera.id)}
          className={cn(
            "border-b pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition",
            selectedCameraId === camera.id
              ? "border-lime-300 text-white"
              : "border-transparent text-white/45 hover:border-white/25 hover:text-white",
          )}
        >
          {camera.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="border-b border-transparent pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45 transition hover:border-white/25 hover:text-white"
      >
        REFRESH
      </button>
    </div>
  );
}

export function CameraVideoSurface({
  camera,
  compact = false,
}: {
  camera: CameraFeed;
  compact?: boolean;
}) {
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div className={cn("relative aspect-video overflow-hidden border border-white/10 bg-black", compact && "w-full")}>
      {/* MJPEG is a continuous HTTP image stream; Next Image would buffer/cache it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${camera.source.src}?connection=${retry}`}
        alt={`${camera.name} live YOLO annotated stream`}
        className="h-full w-full object-contain"
        onLoad={() => setFailed(false)}
        onError={() => {
          setFailed(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setRetry((value) => value + 1), 3000);
        }}
      />
      {(failed || camera.status === "error" || camera.status === "offline") && (
        <div role="status" className="absolute inset-x-0 bottom-0 bg-black/90 p-3 text-xs text-white">
          {camera.status === "error" ? "Camera processing unavailable" : "Reconnecting camera stream…"}
        </div>
      )}
    </div>
  );
}

export function LiveCameraPanel({
  camera,
  selected,
  onSelect,
}: {
  camera: CameraFeed;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "min-w-0 border-b border-r border-white/10 bg-black p-4 text-left transition",
        selected ? "bg-white/[0.02]" : "hover:bg-white/[0.02]",
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">{camera.name}</p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-white">{camera.zoneName}</h3>
          <p className="mt-1 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
            <span className={cn("inline-block size-2 rounded-full", camera.status === "online" ? "bg-white" : "bg-red-400")} />
            {camera.status === "online" ? "LIVE INFERENCE" : camera.status.toUpperCase()}
          </p>
        </div>
        <div className={cn("border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", cameraInterpretationTone(camera))}>
          {camera.interpretation}
        </div>
      </div>

      <CameraVideoSurface camera={camera} />

      <CameraMetricsBar camera={camera} />
    </button>
  );
}

export function CameraMetricsBar({ camera }: { camera: CameraFeed }) {
  const value = (number: number) => camera.hasInference && camera.status === "online" ? number : "—";
  const items = [
    `${value(camera.workersDetected)} PERSONS`,
    `${value(camera.hardhatsDetected)} HARDHATS`,
    `${value(camera.noHardhats)} NO-HARDHAT`,
    `${value(camera.safetyVests)} SAFETY VEST`,
    `${value(camera.noSafetyVests)} NO-SAFETY VEST`,
    `${value(camera.fps)} FPS`,
    `${value(camera.inferenceMs)} MS`,
  ];

  return (
    <div className="mt-3 border-t border-white/10 bg-black py-3">
      <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
        {items.map((item, index) => (
          <div key={item} className="flex items-center gap-4">
            <span>{item}</span>
            {index < items.length - 1 ? <span className="h-4 w-px bg-white/10" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SafetyInterpretationPanel({ camera }: { camera: CameraFeed }) {
  const headProtectionViolations = camera.noHardhats;
  const bodyProtectionViolations = camera.noSafetyVests;
  const violationCount = headProtectionViolations + bodyProtectionViolations;
  const current = camera.hasInference && camera.status === "online";
  const risk = !current ? "UNKNOWN" : camera.incidentCount > 0 ? "CONFIRMED INCIDENT"
    : violationCount > 0 ? "CONFIRMING" : camera.interpretation === "COMPLIANT" ? "SAFE" : "UNCONFIRMED";

  return (
    <section className="border border-white/10 bg-black p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-lime-300">SAFETY INTERPRETATION</p>
      <div className="mt-5 space-y-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">HEAD PROTECTION</p>
          <div className="mt-3 flex items-end gap-6">
            <div>
              <p className="text-5xl font-semibold tracking-tight text-white">{current ? camera.workersDetected : "—"}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">Workers</p>
            </div>
            <div>
              <p className="text-5xl font-semibold tracking-tight text-white">{current ? headProtectionViolations : "—"}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">NO-Hardhat detections</p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-5">
          <p className={cn("text-xl font-semibold tracking-tight", violationCount > 0 ? "text-red-300" : "text-white")}>{camera.interpretation}</p>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            {!current ? "Waiting for camera inference."
              : `${headProtectionViolations} NO-Hardhat and ${bodyProtectionViolations} NO-Safety Vest detections in the current frame. ${camera.incidentCount} confirmed active incident(s).`}
          </p>
        </div>

        <div className="border-t border-white/10 pt-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">BODY PROTECTION</p>
          <div className="mt-3 flex items-end gap-6">
            <div>
              <p className="text-4xl font-semibold tracking-tight text-white">{current ? bodyProtectionViolations : "—"}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">
                NO-Safety Vest detections
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Incident state</p>
            <p className={cn("mt-2 text-lg font-semibold", current && camera.incidentCount > 0 ? "text-red-500" : "text-white")}>{risk}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Source</p>
            <p className="mt-2 text-lg font-semibold text-white">{camera.name}</p>
            <p className="mt-1 text-sm text-white/55">{camera.zoneId.replace("zone-", "ZONE-")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function IncidentFeed({ alerts }: { alerts: SafetyEvent[] }) {
  return (
    <section className="border border-white/10 bg-black p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-lime-300">LIVE INCIDENTS</p>
        <span className="text-[11px] uppercase tracking-[0.18em] text-white/45">Real-time feed</span>
      </div>
      <div className="mt-4 divide-y divide-white/10">
        {alerts.map((alert) => (
          <Link
            key={alert.event_id}
            href={resolveAlertHref(alert)}
            className="grid grid-cols-[84px_1fr_auto] items-start gap-4 py-4 transition hover:bg-white/[0.02]"
          >
            <div className="font-mono text-[12px] text-white/45">{formatClockTime(alert.timestamp)}</div>
            <div className="border-l border-white/10 pl-4">
              <p className={cn("text-xs font-semibold uppercase tracking-[0.18em]", severityText(alert.severity))}>{alert.title}</p>
              <p className="mt-2 text-sm font-medium text-white">{alert.description}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/45">
                {alert.source}
                {` / ${alert.status.toUpperCase()}`}
              </p>
            </div>
            <div className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", severityText(alert.severity))}>
              {alert.severity}
            </div>
          </Link>
        ))}
        {alerts.length === 0 && <p className="py-5 text-sm text-white/55">No confirmed incidents.</p>}
      </div>
    </section>
  );
}

export function CameraFeedPanel({ camera }: { camera: CameraFeed }) {
  const compliant = camera.interpretation === "COMPLIANT";

  return (
    <section className={cn("border bg-black p-5", compliant ? "border-white/10" : "border-red-500/35")}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lime-300">{camera.name}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">{camera.zoneName}</h3>
        </div>
        <div className={cn("border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", cameraInterpretationTone(camera))}>
          {camera.interpretation}
        </div>
      </div>

      <CameraVideoSurface camera={camera} />

      <div className="mt-4">
        <CameraMetricsBar camera={camera} />
      </div>
    </section>
  );
}

export function WorkerSafetyTable({
  workers,
  now,
}: {
  workers: WorkerRecord[];
  now: number;
}) {
  return (
    <div className="overflow-hidden border border-white/10 bg-black">
      <div className="grid grid-cols-[1fr_0.9fr_1.1fr_0.9fr_1fr] gap-3 border-b border-white/10 px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-white/45">
        <span>Worker</span>
        <span>Status</span>
        <span>PPE</span>
        <span>Motion</span>
        <span>Last Event</span>
      </div>
      <div className="divide-y divide-white/10">
        {workers.map((worker) => {
          const ppe = getWorkerPpeSummary(worker);
          const lastEvent = worker.timeline[0];
          return (
            <Link
              key={worker.id}
              href={`/dashboard/workers/${encodeURIComponent(worker.id)}`}
              className="grid grid-cols-[1fr_0.9fr_1.1fr_0.9fr_1fr] gap-3 px-5 py-4 text-sm transition hover:bg-white/[0.02]"
            >
              <span className="font-medium text-white">{worker.id}</span>
              <span className={cn("font-medium", workerStatusTone(worker.status))}>{workerStatusLabel(worker.status)}</span>
              <span className={cn("inline-flex items-center gap-2", ppe.compliant ? "text-white" : ppe.missing.includes("Hardhat") ? "text-red-300" : "text-amber-300")}>
                {ppe.compliant ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <ShieldAlert className="size-4" aria-hidden="true" />}
                {ppe.summary}
              </span>
              <span className={cn(worker.motion === "fall_detected" ? "text-red-300" : "text-white/60")}>{worker.motion === "fall_detected" ? "Fall" : "Normal"}</span>
              <span className="text-white/60">{lastEvent ? formatRelativeTime(now, lastEvent.timestamp) : formatRelativeTime(now, worker.lastSeenAt)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function WorkerSummaryPills({ worker }: { worker: WorkerRecord }) {
  const ppe = getWorkerPpeSummary(worker);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="border border-white/10 bg-black p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Current Status</p>
        <p className={cn("mt-2 text-lg font-semibold", workerStatusTone(worker.status))}>{workerStatusLabel(worker.status)}</p>
      </div>
      <div className="border border-white/10 bg-black p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Current Zone</p>
        <p className="mt-2 text-lg font-semibold text-white">{worker.zoneName}</p>
      </div>
      <div className="border border-white/10 bg-black p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">PPE</p>
        <p className={cn("mt-2 text-lg font-semibold", ppe.compliant ? "text-white" : ppe.missing.includes("Hardhat") ? "text-red-300" : "text-amber-300")}>{ppe.summary}</p>
      </div>
      <div className="border border-white/10 bg-black p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Motion</p>
        <p className={cn("mt-2 text-lg font-semibold", worker.motion === "fall_detected" ? "text-red-300" : "text-white")}>{worker.motion === "fall_detected" ? "Fall Detected" : "Normal"}</p>
      </div>
    </div>
  );
}

export function ConnectivityPill({ worker }: { worker: WorkerRecord }) {
  return (
    <div className="inline-flex items-center gap-2 border border-white/10 bg-black px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-white/55">
      <CircleDot className={cn("size-3", worker.connectivity === "online" ? "text-white" : "text-red-400")} aria-hidden="true" />
      {worker.connectivity === "online" ? "Online" : "Offline"}
    </div>
  );
}

export function WorkerPpeList({ worker }: { worker: WorkerRecord }) {
  return (
    <div className="space-y-3 text-sm text-white/60">
      <div className="flex items-center gap-3">
        <HardHat className="size-4 text-white/45" aria-hidden="true" />
        <span>Hardhat</span>
        <span className={worker.ppe.hardhat === false ? "text-red-500" : "text-white"}>{worker.ppe.hardhat === null ? "Not observed" : worker.ppe.hardhat ? "Present" : "Missing"}</span>
      </div>
      <div className="flex items-center gap-3">
        <Shirt className="size-4 text-white/45" aria-hidden="true" />
        <span>Safety Vest</span>
        <span className={worker.ppe.vest === false ? "text-red-500" : "text-white"}>{worker.ppe.vest === null ? "Not observed" : worker.ppe.vest ? "Present" : "Missing"}</span>
      </div>
    </div>
  );
}

export function WorkerTimeline({
  timeline,
  now,
}: {
  timeline: WorkerRecord["timeline"];
  now: number;
}) {
  return (
    <div className="space-y-3">
      {timeline.map((item) => (
        <div key={item.id} className="border border-white/10 bg-black p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-white">{item.label}</span>
            <span className={cn("text-xs", severityText(item.severity))}>{formatRelativeTime(now, item.timestamp)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyPanel({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="border border-white/10 bg-black p-8 text-center">
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="mt-3 text-sm leading-relaxed text-white/55">{message}</p>
    </div>
  );
}

export function SignalValue({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-white/10 bg-black p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

export function RecentEventList({
  items,
  now,
}: {
  items: Array<{ id: string; label: string; timestamp: number; severity: SafetySeverity }>;
  now: number;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 border border-white/10 bg-black px-4 py-3 text-sm">
          <div className="flex items-center gap-3">
            <Clock3 className="size-4 text-white/45" aria-hidden="true" />
            <span className="text-white">{item.label}</span>
          </div>
          <span className={cn("text-xs", severityText(item.severity))}>{formatRelativeTime(now, item.timestamp)}</span>
        </div>
      ))}
    </div>
  );
}

export function WorkerStatusMiniCard({ worker, now }: { worker: WorkerRecord; now: number }) {
  const ppe = getWorkerPpeSummary(worker);

  return (
    <Link
      href={`/dashboard/workers/${encodeURIComponent(worker.id)}`}
      className="border border-white/10 bg-black p-4 transition hover:border-white/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">{worker.id}</p>
          <p className={cn("mt-2 text-lg font-semibold", workerStatusTone(worker.status))}>{workerStatusLabel(worker.status)}</p>
        </div>
        <UserRound className="size-5 text-white/35" aria-hidden="true" />
      </div>
      <div className="mt-4 space-y-2 text-sm text-white/55">
        <p>{worker.zoneName}</p>
        <p>{ppe.summary}</p>
        <p>{worker.motion === "fall_detected" ? "Fall Detected" : "Normal"}</p>
        <p>{formatRelativeTime(now, worker.lastSeenAt)}</p>
      </div>
    </Link>
  );
}
