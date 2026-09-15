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
            className={`border p-5 text-left transition ${camera.id === selectedCameraId ? "border-white/25 bg-white/[0.02]" : "border-white/10 bg-black hover:border-white/20"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-lime-300">{camera.name}</p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight text-white">{camera.zoneName}</h3>
              </div>
              <span className={`border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${camera.interpretation === "COMPLIANT" ? "border-white/15 text-white" : "border-red-500/35 text-red-300"}`}>
                {camera.status}
              </span>
            </div>
            <div className="mt-4">
              <CameraVideoSurface camera={camera} compact />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/55">
              <div>{camera.hasInference ? camera.workersDetected : "—"} persons detected</div>
              <div className={camera.incidentCount > 0 ? "text-red-500" : "text-white/55"}>{camera.incidentCount} confirmed incidents</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
