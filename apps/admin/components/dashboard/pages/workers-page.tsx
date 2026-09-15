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
        title="WORKERS"
        description={`${summary.activeWorkers} workers with received safety reports.`}
      />

      <div className="grid gap-4 border border-white/10 bg-black p-5 md:grid-cols-[1.2fr_auto] md:items-end">
        <div>
          <label htmlFor="worker-search" className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            Search worker ID...
          </label>
          <input
            id="worker-search"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search worker ID..."
            className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-sm text-white outline-none transition focus:border-lime-300/35"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`border-b px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${filter === item.value ? "border-lime-300 text-white" : "border-transparent text-white/45 hover:border-white/30 hover:text-white"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {zoneFilter ? (
        <p className="text-sm text-white/55">Filtered to {zoneFilter.replace("zone-", "Zone ")}.</p>
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
