"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  CameraMetricsBar,
  CameraSelectorTabs,
  IncidentFeed,
  SecondaryCameraPanel,
  SiteSummaryStrip,
  SafetyInterpretationPanel,
} from "@/components/dashboard/dashboard-ui";
import { useDashboardData } from "@/components/dashboard/dashboard-provider";

export function OverviewPage() {
  const { state, summary, resetDemoState } = useDashboardData();
  const [selectedCameraId, setSelectedCameraId] = useState<string>("camera-02");

  const selectedCamera =
    state.cameras.find((camera) => camera.id === selectedCameraId) || state.cameras[0];

  const liveIncidentFeed = useMemo(
    () =>
      state.activeAlerts
        .filter(
          (alert) =>
            alert.camera_id === selectedCamera.id ||
            alert.zone_id === selectedCamera.zoneId ||
            alert.worker_id === "W-002" ||
            alert.worker_id === "W-003",
        )
        .sort((left, right) => right.timestamp - left.timestamp),
    [selectedCamera.id, selectedCamera.zoneId, state.activeAlerts],
  );

  const summaryItems = [
    { label: "Workers", value: String(summary.activeWorkers).padStart(2, "0") },
    { label: "Safe", value: String(summary.safe).padStart(2, "0") },
    { label: "At Risk", value: String(summary.atRisk).padStart(2, "0") },
    { label: "Critical", value: String(summary.critical).padStart(2, "0") },
  ];

  return (
    <div className="space-y-8 pb-8">
      <section className="space-y-4">
        <div className="rounded-2xl border border-border/80 bg-card/80 px-5 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            LIVE SAFETY MONITORING
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">FACTORY A</h2>
              <div className="mt-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                <span className="inline-block size-2 rounded-full bg-emerald-400" /> SITE OPERATIONAL
              </div>
            </div>
            <CameraSelectorTabs
              cameras={state.cameras}
              selectedCameraId={selectedCamera.id}
              onSelect={setSelectedCameraId}
              onReset={() => {
                resetDemoState();
                setSelectedCameraId("camera-02");
              }}
            />
          </div>
        </div>
        <SiteSummaryStrip items={summaryItems} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.65fr_0.95fr]">
        <div className="space-y-5">
          <section className={`rounded-2xl border bg-card/80 p-5 shadow-[0_14px_40px_rgba(0,0,0,0.16)] ${selectedCamera.interpretation === "PPE VIOLATION" ? "border-rose-500/35" : "border-border/80"}`}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">LIVE CAMERA FEEDS</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{selectedCamera.name} / {selectedCamera.zoneName}</h3>
                <p className="mt-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="inline-block size-2 rounded-full bg-emerald-400" /> LIVE INFERENCE
                </p>
              </div>
              <Link
                href="/dashboard/cameras"
                className="text-xs font-semibold uppercase tracking-[0.18em] text-primary transition hover:text-primary/80"
              >
                Open cameras
              </Link>
            </div>

            <div className="grid gap-4 2xl:grid-cols-2">
              {state.cameras.map((camera) => (
                <SecondaryCameraPanel
                  key={camera.id}
                  camera={camera}
                  active={selectedCamera.id === camera.id}
                  onSelect={() => setSelectedCameraId(camera.id)}
                />
              ))}
            </div>
            <div className="mt-4">
              <CameraMetricsBar camera={selectedCamera} />
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <SafetyInterpretationPanel camera={selectedCamera} />
          <IncidentFeed alerts={liveIncidentFeed} />
        </div>
      </section>

    </div>
  );
}
