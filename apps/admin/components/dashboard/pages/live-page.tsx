"use client";

import { useMemo, useState } from "react";

import {
  CameraSelectorTabs,
  IncidentFeed,
  LiveCameraPanel,
  SafetyInterpretationPanel,
  SectionHeader,
} from "@/components/dashboard/dashboard-ui";
import { useDashboardData } from "@/components/dashboard/dashboard-provider";

export function LivePage() {
  const { state, resetDemoState } = useDashboardData();
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
    <div className="space-y-6 pb-8">
      <SectionHeader
        eyebrow="Live"
        title="Active CCTV monitoring"
        description="Continuous monitoring view for active camera inference, PPE interpretation, and incident response."
        action={
          <CameraSelectorTabs
            cameras={state.cameras}
            selectedCameraId={selectedCamera.id}
            onSelect={setSelectedCameraId}
            onReset={() => {
              resetDemoState();
              setSelectedCameraId("CAM-LEFT");
            }}
          />
        }
      />

      <div className="grid gap-6">
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
      </div>
    </div>
  );
}
