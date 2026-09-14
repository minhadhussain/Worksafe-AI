"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  HardHat,
  MapPinned,
  PlayCircle,
  ShieldAlert,
  Shirt,
  UserRound,
} from "lucide-react";

import {
  formatRelativeTime,
  formatClockTime,
  getWorkerPpeSummary,
  resolveAlertHref,
  severityAccent,
  workerStatusLabel,
  type CameraFeed,
  type SafetyEvent,
  type SafetySeverity,
  type WorkerRecord,
  type ZoneRecord,
} from "@/lib/dashboard-data";
import { cn } from "@vigil-os/shared/lib/utils";

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
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function SummaryMetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: SafetySeverity;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card/70 px-5 py-4 shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <span className="text-4xl font-semibold tracking-tight text-foreground">{value}</span>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
            severityAccent(tone),
          )}
        >
          {tone === "safe" ? "Stable" : tone === "warning" ? "Attention" : tone === "high" ? "High" : "Critical"}
        </span>
      </div>
    </div>
  );
}

function CameraBoxOverlay({ camera }: { camera: CameraFeed }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {camera.detections.map((detection) => (
        <div
          key={detection.id}
          className={cn(
            "absolute rounded-md border-2 px-2 py-1 text-[11px] font-medium shadow-[0_0_20px_rgba(0,0,0,0.35)]",
            detection.interpretation === "COMPLIANT"
              ? "border-emerald-400/85 bg-emerald-500/10 text-emerald-100"
              : "border-rose-500/90 bg-rose-500/10 text-rose-100",
          )}
          style={{
            left: `${detection.left}%`,
            top: `${detection.top}%`,
            width: `${detection.width}%`,
            height: `${detection.height}%`,
          }}
        >
          <div className="inline-flex max-w-full flex-col rounded bg-black/45 px-2 py-1 backdrop-blur-sm">
            <span className="truncate">{detection.labels.join(" + ")}</span>
            <span className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/70">
              {detection.interpretation}
            </span>
          </div>
        </div>
      ))}
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
  const hasVideo = Boolean(camera.source.src);
  const hasAnnotatedFrame = Boolean(camera.latestAnnotatedFrame);

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border/80 bg-[#070b10]", compact ? "aspect-[16/9]" : "aspect-[16/10]")}>
      {hasVideo ? (
        <video
          className="h-full w-full object-cover"
          src={camera.source.src || undefined}
          playsInline
          muted
          loop
          autoPlay
          preload="metadata"
        />
      ) : hasAnnotatedFrame ? (
        <Image
          src={`data:image/jpeg;base64,${camera.latestAnnotatedFrame}`}
          alt={`${camera.name} annotated safety frame`}
          fill
          unoptimized
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(10,12,14,0.95),rgba(18,22,26,0.98))]">
          <PlayCircle className="size-8 text-white/35" aria-hidden="true" />
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.4),transparent_25%,transparent_75%,rgba(0,0,0,0.58))]" />
      <div className="pointer-events-none absolute inset-x-0 top-[22%] h-px bg-white/10" />
      <CameraBoxOverlay camera={camera} />
      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
        <span className={cn("inline-block size-2 rounded-full", camera.status === "online" ? "bg-emerald-400" : "bg-rose-400")} />
        {camera.status}
      </div>
      <div className="absolute bottom-4 left-4 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
        {camera.zoneName}
      </div>
    </div>
  );
}

export function SiteSummaryStrip({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/80 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
      <div className="grid grid-cols-2 gap-0 md:grid-cols-4">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              "px-5 py-4",
              index !== items.length - 1 && "border-r border-border/80",
              index < items.length - 2 && "border-b border-border/80 md:border-b-0",
            )}
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{item.value}</p>
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
    <div className="flex flex-wrap items-center gap-2">
      {cameras.map((camera) => (
        <button
          key={camera.id}
          type="button"
          onClick={() => onSelect(camera.id)}
          className={cn(
            "rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition",
            selectedCameraId === camera.id
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/80 bg-card/70 text-muted-foreground hover:border-primary/30 hover:text-foreground",
          )}
        >
          {camera.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="rounded-lg border border-border/80 bg-card/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
      >
        RESET DEMO
      </button>
    </div>
  );
}

export function CameraMetricsBar({ camera }: { camera: CameraFeed }) {
  const items = [
    `${camera.fps} FPS`,
    `${camera.inferenceMs} ms`,
    `${camera.workersDetected} PERSON${camera.workersDetected === 1 ? "" : "S"}`,
    `${camera.hardhatsDetected} HARDHAT${camera.hardhatsDetected === 1 ? "" : "S"}`,
    `${camera.noHardhats} NO-HARDHAT`,
    `${camera.safetyVests} SAFETY VEST${camera.safetyVests === 1 ? "" : "S"}`,
    `${camera.noSafetyVests} NO-SAFETY VEST`,
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-border/80 bg-card/70 px-4 py-3">
      <div className="flex min-w-max items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">
        <span className="text-muted-foreground">{camera.name} / {camera.zoneName}</span>
        {items.map((item, index) => (
          <div key={item} className="flex items-center gap-4">
            <span>{item}</span>
            {index < items.length - 1 ? <span className="h-4 w-px bg-border/80" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SafetyInterpretationPanel({ camera }: { camera: CameraFeed }) {
  const violationCount = camera.noHardhats + camera.noSafetyVests + camera.noMasks;
  const risk = camera.interpretation === "PPE VIOLATION" ? "CRITICAL" : "SAFE";

  return (
    <section className="rounded-2xl border border-border/80 bg-card/80 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.14)]">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">SAFETY INTERPRETATION</p>
      <div className="mt-5 space-y-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">HEAD PROTECTION</p>
          <div className="mt-3 flex items-end gap-6">
            <div>
              <p className="text-5xl font-semibold tracking-tight text-foreground">{camera.workersDetected}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Workers</p>
            </div>
            <div>
              <p className={cn("text-5xl font-semibold tracking-tight", violationCount > 0 ? "text-rose-300" : "text-emerald-300")}>{camera.noHardhats}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Violations</p>
            </div>
          </div>
        </div>

        <div className="border-t border-border/80 pt-5">
          <p className={cn("text-xl font-semibold tracking-tight", violationCount > 0 ? "text-rose-300" : "text-emerald-300")}>{camera.interpretation}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {violationCount > 0
              ? `Two workers currently detected without required head protection${camera.noSafetyVests > 0 ? " and one without a safety vest" : ""}.`
              : "All detected workers are currently compliant with required visible PPE in this feed."}
          </p>
        </div>

        <div className="grid gap-3 border-t border-border/80 pt-5 sm:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Current Risk</p>
            <p className={cn("mt-2 text-lg font-semibold", risk === "CRITICAL" ? "text-rose-300" : "text-emerald-300")}>{risk}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Source</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{camera.name}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Zone</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{camera.zoneId.replace("zone-", "ZONE-")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function IncidentFeed({ alerts }: { alerts: SafetyEvent[] }) {
  return (
    <section className="rounded-2xl border border-border/80 bg-card/80 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.14)]">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">LIVE INCIDENTS</p>
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Real-time feed</span>
      </div>
      <div className="mt-4 divide-y divide-border/80">
        {alerts.map((alert) => (
          <Link
            key={alert.event_id}
            href={resolveAlertHref(alert)}
            className="flex items-start gap-4 py-4 transition hover:bg-white/[0.02]"
          >
            <div className="w-20 shrink-0 font-mono text-[12px] text-muted-foreground">{formatClockTime(alert.timestamp)}</div>
            <div className="flex-1 border-l border-border/80 pl-4">
              <p className={cn("text-xs font-semibold uppercase tracking-[0.18em]", alert.severity === "critical" ? "text-rose-300" : alert.severity === "high" ? "text-amber-300" : "text-foreground")}>{alert.title}</p>
              <p className="mt-2 text-sm font-medium text-foreground">{alert.description}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {alert.source} / {alert.zone_id.replace("zone-", "ZONE-")}
                {alert.worker_id ? ` / ${alert.worker_id}` : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function SecondaryCameraPanel({
  camera,
  active,
  onSelect,
}: {
  camera: CameraFeed;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "block rounded-2xl border bg-card/70 p-4 text-left transition",
        active ? "border-primary/40 shadow-[0_0_0_1px_rgba(169,232,102,0.18)]" : "border-border/80 hover:border-primary/25",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">{camera.name}</p>
          <p className="mt-1 text-sm font-medium text-foreground">{camera.zoneName}</p>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", camera.interpretation === "COMPLIANT" ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-300" : "border-rose-500/30 bg-rose-500/8 text-rose-300")}>{camera.interpretation}</span>
      </div>
      <CameraVideoSurface camera={camera} compact />
      <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
        <div>
          <p className="uppercase tracking-[0.16em]">Persons</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{camera.workersDetected}</p>
        </div>
        <div>
          <p className="uppercase tracking-[0.16em]">Hardhats</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{camera.hardhatsDetected}</p>
        </div>
        <div>
          <p className="uppercase tracking-[0.16em]">NO-Hardhat</p>
          <p className={cn("mt-1 text-sm font-semibold", camera.noHardhats > 0 ? "text-rose-300" : "text-foreground")}>{camera.noHardhats}</p>
        </div>
      </div>
    </button>
  );
}

export function CameraFeedPanel({
  camera,
  compact = false,
}: {
  camera: CameraFeed;
  compact?: boolean;
}) {
  const compliant = camera.interpretation === "COMPLIANT";
  const icon = compliant ? CheckCircle2 : AlertTriangle;
  const StatusIcon = icon;

  return (
    <section
      className={cn(
        "rounded-2xl border bg-card/80 p-5 shadow-[0_16px_42px_rgba(0,0,0,0.18)]",
        compliant ? "border-border/80" : "border-rose-500/35 shadow-[0_0_0_1px_rgba(244,63,94,0.14)]",
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">{camera.name}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{camera.zoneName}</h3>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{camera.scenarioLabel}</p>
        </div>
        <div
          className={cn(
            "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
            compliant ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/35 bg-rose-500/12 text-rose-300",
          )}
        >
          <StatusIcon className="mr-2 inline size-3.5" aria-hidden="true" />
          {camera.interpretation}
        </div>
      </div>

      <CameraVideoSurface camera={camera} />

      <div className={cn("mt-4 grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
        <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Workers detected</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{camera.workersDetected}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Hardhats detected</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{camera.hardhatsDetected}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Missing hardhats</p>
          <p className={cn("mt-2 text-2xl font-semibold", camera.noHardhats > 0 ? "text-rose-300" : "text-foreground")}>{camera.noHardhats}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">PPE compliance</p>
          <p className={cn("mt-2 text-2xl font-semibold", compliant ? "text-emerald-300" : "text-rose-300")}>{camera.compliancePercent}%</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-border/80 bg-muted/15 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Detection</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {camera.detections.flatMap((detection) => detection.labels).map((label, index) => (
              <span
                key={`${camera.id}-${label}-${index}`}
                className="rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-medium text-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border/80 bg-muted/15 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Safety interpretation</p>
          <p className={cn("mt-3 text-sm font-medium leading-relaxed", compliant ? "text-emerald-300" : "text-rose-300")}>{camera.interpretation}</p>
          {!compliant ? (
            <p className="mt-2 text-sm leading-relaxed text-rose-200">{camera.noHardhats} WORKERS WITHOUT REQUIRED HEAD PROTECTION</p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-emerald-200">All detected workers are wearing required head protection.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export function AlertCard({ alert, now }: { alert: SafetyEvent; now: number }) {
  return (
    <article className={cn("rounded-2xl border p-4", severityAccent(alert.severity))}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em]">{alert.severity}</p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">{alert.title}</h3>
        </div>
        <Link
          href={resolveAlertHref(alert)}
          className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
        >
          View <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        <p>{alert.description}</p>
        <p>{alert.source}</p>
        <p>{alert.worker_id || alert.camera_id || "Zone event"}</p>
        <p>{alert.zone_id.replace("zone-", "Zone ")}</p>
        <p>{formatRelativeTime(now, alert.timestamp)}</p>
      </div>
    </article>
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
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/75 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
      <div className="grid grid-cols-[1fr_0.8fr_0.8fr_1fr_0.8fr_1fr] gap-3 border-b border-border/80 px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>Worker</span>
        <span>Status</span>
        <span>Zone</span>
        <span>PPE</span>
        <span>Motion</span>
        <span>Last Event</span>
      </div>
      <div className="divide-y divide-border/80">
        {workers.map((worker) => {
          const ppe = getWorkerPpeSummary(worker);
          const lastEvent = worker.timeline[0];
          return (
            <Link
              key={worker.id}
              href={`/dashboard/workers/${encodeURIComponent(worker.id)}`}
              className="grid grid-cols-[1fr_0.8fr_0.8fr_1fr_0.8fr_1fr] gap-3 px-5 py-4 text-sm transition hover:bg-white/[0.03]"
            >
              <span className="font-medium text-foreground">{worker.id}</span>
              <span className={cn("font-medium", worker.status === "critical" ? "text-rose-300" : worker.status === "warning" ? "text-amber-300" : "text-emerald-300")}>{workerStatusLabel(worker.status)}</span>
              <span className="text-muted-foreground">{worker.zoneName}</span>
              <span className={cn("inline-flex items-center gap-2", ppe.compliant ? "text-emerald-300" : "text-amber-300")}>
                {ppe.compliant ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <ShieldAlert className="size-4" aria-hidden="true" />}
                {ppe.summary}
              </span>
              <span className={cn(worker.motion === "fall_detected" ? "text-rose-300" : "text-muted-foreground")}>{worker.motion === "fall_detected" ? "Fall Detected" : "Normal"}</span>
              <span className="text-muted-foreground">{lastEvent ? formatRelativeTime(now, lastEvent.timestamp) : formatRelativeTime(now, worker.lastSeenAt)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function ZoneRiskMap({
  zones,
  workers,
  selectedZoneId,
  onSelect,
}: {
  zones: ZoneRecord[];
  workers: WorkerRecord[];
  selectedZoneId?: string;
  onSelect?: (zoneId: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {zones.map((zone) => {
        const zoneWorkers = workers.filter((worker) => worker.zoneId === zone.id);
        return (
          <button
            key={zone.id}
            type="button"
            onClick={() => onSelect?.(zone.id)}
            className={cn(
              "relative min-h-40 overflow-hidden rounded-2xl border p-4 text-left transition",
              zone.level === "critical"
                ? "border-rose-500/35 bg-rose-500/10"
                : zone.level === "high"
                  ? "border-orange-400/30 bg-orange-400/10"
                  : zone.level === "warning"
                    ? "border-amber-400/30 bg-amber-400/10"
                    : "border-emerald-500/25 bg-emerald-500/10",
              selectedZoneId === zone.id && "ring-2 ring-primary/35",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{zone.name}</p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  {zone.level === "critical"
                    ? "CRITICAL"
                    : zone.level === "high"
                      ? "HIGH"
                      : zone.level === "warning"
                        ? "MODERATE"
                        : "SAFE"}
                </h3>
              </div>
              <MapPinned className="size-5 text-primary" aria-hidden="true" />
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              <p>{zone.workersPresent} workers present</p>
              <p>{zone.activeIncidents} active incidents</p>
            </div>
            <div className="absolute inset-x-4 bottom-4 rounded-xl border border-white/10 bg-black/15 p-3 backdrop-blur-sm">
              <div className="relative h-12 rounded-lg border border-border/80 bg-background/70">
                {zoneWorkers.map((worker) => (
                  <span
                    key={worker.id}
                    className={cn(
                      "absolute size-3 rounded-full border border-black/50",
                      worker.status === "critical"
                        ? "bg-rose-400"
                        : worker.status === "warning"
                          ? "bg-amber-300"
                          : "bg-emerald-400",
                    )}
                    style={{ left: `${worker.position.x}%`, top: `${worker.position.y}%` }}
                    title={worker.id}
                  />
                ))}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function WorkerSummaryPills({ worker }: { worker: WorkerRecord }) {
  const ppe = getWorkerPpeSummary(worker);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-border/80 bg-card/70 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Current Status</p>
        <p className={cn("mt-2 text-lg font-semibold", worker.status === "critical" ? "text-rose-300" : worker.status === "warning" ? "text-amber-300" : "text-emerald-300")}>{workerStatusLabel(worker.status)}</p>
      </div>
      <div className="rounded-xl border border-border/80 bg-card/70 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Current Zone</p>
        <p className="mt-2 text-lg font-semibold text-foreground">{worker.zoneName}</p>
      </div>
      <div className="rounded-xl border border-border/80 bg-card/70 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">PPE</p>
        <p className={cn("mt-2 text-lg font-semibold", ppe.compliant ? "text-emerald-300" : "text-amber-300")}>{ppe.summary}</p>
      </div>
      <div className="rounded-xl border border-border/80 bg-card/70 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Motion</p>
        <p className={cn("mt-2 text-lg font-semibold", worker.motion === "fall_detected" ? "text-rose-300" : "text-foreground")}>{worker.motion === "fall_detected" ? "Fall Detected" : "Normal"}</p>
      </div>
    </div>
  );
}

export function ConnectivityPill({ worker }: { worker: WorkerRecord }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
      <CircleDot className={cn("size-3", worker.connectivity === "online" ? "text-emerald-400" : "text-rose-400")} aria-hidden="true" />
      {worker.connectivity === "online" ? "Online" : "Offline"}
    </div>
  );
}

export function WorkerPpeList({ worker }: { worker: WorkerRecord }) {
  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <HardHat className="size-4 text-primary" aria-hidden="true" />
        <span>Hardhat</span>
        <span className={worker.ppe.hardhat ? "text-emerald-300" : "text-rose-300"}>{worker.ppe.hardhat ? "Present" : "Missing"}</span>
      </div>
      <div className="flex items-center gap-3">
        <Shirt className="size-4 text-primary" aria-hidden="true" />
        <span>Safety Vest</span>
        <span className={worker.ppe.vest ? "text-emerald-300" : "text-rose-300"}>{worker.ppe.vest ? "Present" : "Missing"}</span>
      </div>
      <div className="flex items-center gap-3">
        <ShieldAlert className="size-4 text-primary" aria-hidden="true" />
        <span>Mask</span>
        <span className={worker.ppe.mask ? "text-emerald-300" : "text-rose-300"}>{worker.ppe.mask ? "Present" : "Missing"}</span>
      </div>
    </div>
  );
}

export function WorkerProfileMap({
  zones,
  worker,
}: {
  zones: ZoneRecord[];
  worker: WorkerRecord;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {zones.map((zone) => {
        const selected = zone.id === worker.zoneId;
        return (
          <div
            key={zone.id}
            className={cn(
              "relative min-h-24 rounded-xl border p-3",
              selected ? "border-primary/45 bg-primary/8" : "border-border/80 bg-card/70",
            )}
          >
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{zone.name}</p>
            <div className="mt-3 relative h-10 rounded-lg border border-border/70 bg-background/70">
              {selected ? (
                <span
                  className="absolute size-3 rounded-full bg-primary shadow-[0_0_14px_rgba(169,232,102,0.6)]"
                  style={{ left: `${worker.position.x}%`, top: `${worker.position.y}%` }}
                />
              ) : null}
            </div>
          </div>
        );
      })}
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
        <div key={item.id} className="rounded-xl border border-border/80 bg-card/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">{item.label}</span>
            <span className="text-xs text-muted-foreground">{formatRelativeTime(now, item.timestamp)}</span>
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
    <div className="rounded-2xl border border-border/80 bg-card/70 p-8 text-center">
      <p className="text-lg font-semibold text-foreground">{title}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>
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
    <div className="rounded-xl border border-border/80 bg-card/70 p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-base font-semibold text-foreground">{value}</p>
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
        <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/70 px-4 py-3 text-sm">
          <div className="flex items-center gap-3">
            <Clock3 className="size-4 text-primary" aria-hidden="true" />
            <span className="text-foreground">{item.label}</span>
          </div>
          <span className="text-muted-foreground">{formatRelativeTime(now, item.timestamp)}</span>
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
      className="rounded-xl border border-border/80 bg-card/70 p-4 transition hover:border-primary/35"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">{worker.id}</p>
          <p className={cn("mt-2 text-lg font-semibold", worker.status === "critical" ? "text-rose-300" : worker.status === "warning" ? "text-amber-300" : "text-emerald-300")}>{workerStatusLabel(worker.status)}</p>
        </div>
        <UserRound className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        <p>{worker.zoneName}</p>
        <p>{ppe.summary}</p>
        <p>{worker.motion === "fall_detected" ? "Fall Detected" : "Normal"}</p>
        <p>{formatRelativeTime(now, worker.lastSeenAt)}</p>
      </div>
    </Link>
  );
}

export function ZoneActionRow({ zoneId }: { zoneId: string }) {
  return (
    <div className="mt-5 flex flex-wrap gap-3">
      <Link href={`/dashboard/workers?zone=${encodeURIComponent(zoneId)}`} className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground transition hover:border-primary/35 hover:text-primary">
        View Workers
      </Link>
      <Link href={`/dashboard/alerts?zone=${encodeURIComponent(zoneId)}`} className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground transition hover:border-primary/35 hover:text-primary">
        View Alerts
      </Link>
      <Link href={`/dashboard/cameras?zone=${encodeURIComponent(zoneId)}`} className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground transition hover:border-primary/35 hover:text-primary">
        View Cameras
      </Link>
    </div>
  );
}
