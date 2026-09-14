"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { SectionHeader, ZoneActionRow, ZoneRiskMap } from "@/components/dashboard/dashboard-ui";
import { useDashboardData } from "@/components/dashboard/dashboard-provider";

function zoneHeading(level: string): string {
  if (level === "critical") return "CRITICAL";
  if (level === "high") return "HIGH";
  if (level === "warning") return "MODERATE";
  return "SAFE";
}

export function RiskMapPage() {
  const { zones, state } = useDashboardData();
  const searchParams = useSearchParams();
  const [manualZoneId, setManualZoneId] = useState<string | null>(null);
  const selectedZoneId =
    manualZoneId ||
    searchParams.get("zone") ||
    zones.find((zone) => zone.level === "critical")?.id ||
    zones[0]?.id ||
    "";

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) || zones[0],
    [selectedZoneId, zones],
  );
  const workersInZone = useMemo(
    () => state.workers.filter((worker) => worker.zoneId === selectedZone?.id),
    [selectedZone?.id, state.workers],
  );

  if (!selectedZone) return null;

  return (
    <div className="space-y-6 pb-8">
      <SectionHeader
        eyebrow="Worker Safety Risk"
        title="LIVE SITE RISK"
        description="This facility map is organized by named zones so supervisors can identify where worker safety risk is currently concentrated."
      />

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-border/80 bg-card/75 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
          <ZoneRiskMap zones={zones} workers={state.workers} selectedZoneId={selectedZone.id} onSelect={setManualZoneId} />
        </div>

        <div className="rounded-2xl border border-border/80 bg-card/75 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">{selectedZone.name}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{zoneHeading(selectedZone.level)}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Workers Present</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{selectedZone.workersPresent}</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Active Incidents</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{selectedZone.activeIncidents}</p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Contributing Factors</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {selectedZone.contributingFactors.map((factor) => (
                <li key={factor} className="rounded-xl border border-border/70 bg-muted/15 px-3 py-2">{factor}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workers Present</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {workersInZone.map((worker) => (
                <span key={worker.id} className="rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-medium text-foreground">
                  {worker.id}
                </span>
              ))}
            </div>
          </div>

          <ZoneActionRow zoneId={selectedZone.id} />
        </div>
      </div>
    </div>
  );
}
