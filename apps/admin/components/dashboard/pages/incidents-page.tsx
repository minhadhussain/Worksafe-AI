"use client";

import { useMemo, useState } from "react";

import { EmptyPanel, IncidentFeed, SectionHeader } from "@/components/dashboard/dashboard-ui";
import { useDashboardData } from "@/components/dashboard/dashboard-provider";

type IncidentTab = "active" | "resolved";

export function IncidentsPage() {
  const { state } = useDashboardData();
  const [tab, setTab] = useState<IncidentTab>("active");

  const incidents = useMemo(
    () => (tab === "active" ? state.activeAlerts : state.resolvedAlerts),
    [state.activeAlerts, state.resolvedAlerts, tab],
  );

  return (
    <div className="space-y-6 pb-8">
      <SectionHeader
        eyebrow="Incidents"
        title="Safety incident center"
        description="Supervisor view of active and resolved worker-safety incidents across cameras and connected workers."
      />

      <div className="flex flex-wrap gap-6 border-b border-white/10 pb-3">
        {[
          { key: "active", label: "ACTIVE" },
          { key: "resolved", label: "RESOLVED" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as IncidentTab)}
            className={`border-b pb-2 text-[11px] font-semibold tracking-[0.2em] transition ${tab === item.key ? "border-lime-300 text-white" : "border-transparent text-white/45 hover:border-white/30 hover:text-white"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {incidents.length > 0 ? (
        <IncidentFeed alerts={incidents} />
      ) : (
        <EmptyPanel
          title="No incidents in this view"
          message="Switch between active and resolved incidents to review the current safety state."
        />
      )}
    </div>
  );
}
