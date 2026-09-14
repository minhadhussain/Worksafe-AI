"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AlertCard, EmptyPanel, SectionHeader } from "@/components/dashboard/dashboard-ui";
import { useDashboardData } from "@/components/dashboard/dashboard-provider";

type AlertTab = "active" | "resolved";

export function AlertsPage() {
  const { state, now } = useDashboardData();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<AlertTab>("active");
  const zoneFilter = searchParams.get("zone");

  const alerts = useMemo(() => {
    const source = tab === "active" ? state.activeAlerts : state.resolvedAlerts;
    return source.filter((alert) => (zoneFilter ? alert.zone_id === zoneFilter : true));
  }, [state.activeAlerts, state.resolvedAlerts, tab, zoneFilter]);

  return (
    <div className="space-y-6 pb-8">
      <SectionHeader
        eyebrow="Alerts"
        title="Safety Alert Center"
        description="Critical incidents are prioritized by severity and always connect back to the relevant worker, zone, or camera context."
      />

      <div className="flex flex-wrap gap-2">
        {[
          { key: "active", label: "ACTIVE" },
          { key: "resolved", label: "RESOLVED" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as AlertTab)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${tab === item.key ? "border-primary/40 bg-primary/10 text-primary" : "border-border/80 bg-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {zoneFilter ? (
        <p className="text-sm text-muted-foreground">Showing alerts for {zoneFilter.replace("zone-", "Zone ")}.</p>
      ) : null}

      {alerts.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {alerts.map((alert) => (
            <AlertCard key={alert.event_id} alert={alert} now={now} />
          ))}
        </div>
      ) : (
        <EmptyPanel
          title="No alerts match this view"
          message="Try switching tabs or opening another zone context."
        />
      )}
    </div>
  );
}
