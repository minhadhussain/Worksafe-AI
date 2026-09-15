"use client";

import { useMemo, useState } from "react";

import {
  CameraSelectorTabs,
  IncidentFeed,
  LiveCameraPanel,
  SafetyInterpretationPanel,
  WorkerSafetyTable,
} from "@/components/dashboard/dashboard-ui";
import { useDashboardData } from "@/components/dashboard/dashboard-provider";

export function OverviewPage() {
  const { state, now, resetDemoState } = useDashboardData();
  const [selectedCameraId, setSelectedCameraId] = useState<string>("CAM-LEFT");

  const selectedCamera =
    state.cameras.find((camera) => camera.id === selectedCameraId) || state.cameras[0];

  const liveIncidentFeed = useMemo(
    () =>
      state.activeAlerts
        .filter(
          (alert) =>
            alert.camera_id === selectedCamera.id ||
            alert.type === "FALL_DETECTED",
        )
        .sort((left, right) => right.timestamp - left.timestamp),
    [selectedCamera.id, state.activeAlerts],
  );

  return (
    <div className="space-y-8 pb-8">
      <section className="space-y-4">
        <div className="border-b border-white/10 pb-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-lime-300">
            LIVE SAFETY MONITORING
          </p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-white">FACTORY A</h2>
              <div className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                <span className="inline-block size-2 rounded-full bg-white" />
                {state.cameras.every((camera) => camera.status === "online") ? "CAMERAS ONLINE" : "CONNECTING CAMERAS"}
              </div>
            </div>
            <CameraSelectorTabs
              cameras={state.cameras}
              selectedCameraId={selectedCamera.id}
              onSelect={setSelectedCameraId}
              onReset={() => {
                resetDemoState();
                setSelectedCameraId("CAM-LEFT");
              }}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        <div className="grid min-w-0 grid-cols-1 gap-0 border border-white/10 md:grid-cols-2">
          {state.cameras.map((camera) => (
                <LiveCameraPanel
                  key={camera.id}
                  camera={camera}
                  selected={camera.id === selectedCamera.id}
                  onSelect={() => setSelectedCameraId(camera.id)}
                />
              ))}
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-2">
          <SafetyInterpretationPanel camera={selectedCamera} />
          <IncidentFeed alerts={liveIncidentFeed} />
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-lime-300">
            Worker Safety
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Worker safety status
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
            A compact operational worker roster showing interpreted PPE and motion state for supervisor action.
          </p>
        </div>
        <WorkerSafetyTable workers={state.workers} now={now} />
      </section>
    </div>
  );
}
