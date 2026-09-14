"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { EmptyPanel, SectionHeader, WorkerSafetyTable } from "@/components/dashboard/dashboard-ui";
import { useDashboardData } from "@/components/dashboard/dashboard-provider";

type WorkerFilter = "all" | "safe" | "warning" | "critical";

const FILTERS: Array<{ value: WorkerFilter; label: string }> = [
  { value: "all", label: "ALL" },
  { value: "safe", label: "SAFE" },
  { value: "warning", label: "WARNING" },
  { value: "critical", label: "CRITICAL" },
];

export function WorkersPage() {
  const { state, now, summary } = useDashboardData();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<WorkerFilter>("all");
  const [query, setQuery] = useState("");
  const zoneFilter = searchParams.get("zone");

  const filteredWorkers = useMemo(() => {
    return state.workers.filter((worker) => {
      if (filter !== "all" && worker.status !== filter) return false;
      if (zoneFilter && worker.zoneId !== zoneFilter) return false;
      if (query && !worker.id.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [filter, query, state.workers, zoneFilter]);

  return (
    <div className="space-y-6 pb-8">
      <SectionHeader
        eyebrow="Workers"
        title="Workers"
        description="24 ACTIVE workers are tracked by interpreted safety state, not raw sensor values."
      />

      <div className="grid gap-4 rounded-2xl border border-border/80 bg-card/75 p-5 md:grid-cols-[1.2fr_auto] md:items-end">
        <div>
          <label htmlFor="worker-search" className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Search worker ID...
          </label>
          <input
            id="worker-search"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search worker ID..."
            className="mt-2 h-12 w-full rounded-xl border border-border/80 bg-muted/20 px-4 text-sm text-foreground outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${filter === item.value ? "border-primary/40 bg-primary/10 text-primary" : "border-border/80 bg-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {zoneFilter ? (
        <p className="text-sm text-muted-foreground">Filtered to {zoneFilter.replace("zone-", "Zone ")}.</p>
      ) : null}

      {filteredWorkers.length > 0 ? (
        <WorkerSafetyTable workers={filteredWorkers} now={now} />
      ) : (
        <EmptyPanel
          title="No workers match the current filters"
          message={`Adjust the search or filter selection. ${summary.activeWorkers} active workers are available in the live roster.`}
        />
      )}
    </div>
  );
}
