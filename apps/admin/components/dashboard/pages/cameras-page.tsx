"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { CameraFeedPanel, CameraVideoSurface, SectionHeader } from "@/components/dashboard/dashboard-ui";
import { useDashboardData } from "@/components/dashboard/dashboard-provider";

export function CamerasPage() {
  const { state } = useDashboardData();
  const searchParams = useSearchParams();
  const zoneFilter = searchParams.get("zone");
  const filteredCameras = useMemo(
    () => state.cameras.filter((camera) => (zoneFilter ? camera.zoneId === zoneFilter : true)),
    [state.cameras, zoneFilter],
  );

  const [manualCameraId, setManualCameraId] = useState<string | null>(null);
  const selectedCameraId =
    manualCameraId ||
    searchParams.get("camera") ||
    filteredCameras[0]?.id ||
    state.cameras[0]?.id ||
    "";

  const selectedCamera = filteredCameras.find((camera) => camera.id === selectedCameraId) || filteredCameras[0];

  if (!selectedCamera) return null;

  return (
    <div className="space-y-6 pb-8">
      <SectionHeader
        eyebrow="Cameras"
        title="CCTV Monitoring"
        description="Each feed surfaces video playback, current worker counts, and active PPE interpretation from the AI system."
      />

      <CameraFeedPanel camera={selectedCamera} />

      <div className="grid gap-4 lg:grid-cols-2">
        {filteredCameras.map((camera) => (
          <button
            key={camera.id}
            type="button"
            onClick={() => setManualCameraId(camera.id)}
            className={`rounded-2xl border p-5 text-left transition ${camera.id === selectedCameraId ? "border-primary/40 bg-primary/6" : "border-border/80 bg-card/75 hover:border-primary/30"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">{camera.name}</p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">{camera.zoneName}</h3>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${camera.interpretation === "COMPLIANT" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/35 bg-rose-500/10 text-rose-300"}`}>
                {camera.status}
              </span>
            </div>
            <div className="mt-4">
              <CameraVideoSurface camera={camera} compact />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
              <div>{camera.workersDetected} workers</div>
              <div>{camera.ppeViolations} PPE violations</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
