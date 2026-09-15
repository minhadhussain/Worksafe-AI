"use client";

import Link from "next/link";
import { ArrowLeft, Clock3, Move3D } from "lucide-react";

import { ConnectivityPill, EmptyPanel, SectionHeader, SignalValue, WorkerPpeList, WorkerSummaryPills, WorkerTimeline } from "@/components/dashboard/dashboard-ui";
import { useDashboardData } from "@/components/dashboard/dashboard-provider";
import { formatRelativeTime } from "@/lib/dashboard-data";

export function WorkerProfilePage({ workerId }: { workerId: string }) {
  const { state, now } = useDashboardData();
  const worker = state.workers.find((item) => item.id === workerId);

  if (!worker) {
    return (
      <EmptyPanel
        title="Worker not found"
        message="The selected worker is not present in the current active roster."
      />
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <Link href="/dashboard/workers" className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to workers
      </Link>

      <SectionHeader
        eyebrow="Worker Safety Profile"
        title={`WORKER ${worker.id}`}
        description="Supervisor-facing worker context with interpreted PPE, motion, connectivity, and recent safety events."
      />

      <WorkerSummaryPills worker={worker} />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6 border border-white/10 bg-black p-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-semibold tracking-tight text-white">Last report</h3>
            <ConnectivityPill worker={worker} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SignalValue icon={<Clock3 className="size-4 text-primary" aria-hidden="true" />} label="Last Telemetry" value={formatRelativeTime(now, worker.lastSeenAt)} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="border border-white/10 bg-black p-5">
            <h3 className="text-xl font-semibold tracking-tight text-white">PPE</h3>
            <div className="mt-4">
              <WorkerPpeList worker={worker} />
            </div>
          </div>
          <div className="border border-white/10 bg-black p-5">
            <h3 className="text-xl font-semibold tracking-tight text-white">Motion</h3>
            <div className="mt-4">
              <SignalValue icon={<Move3D className="size-4 text-primary" aria-hidden="true" />} label="Current Motion State" value={worker.motion === "fall_detected" ? "Fall Detected" : "Normal"} />
            </div>
          </div>
        </div>
      </div>

      <section>
        <SectionHeader
          eyebrow="Recent Safety Events"
          title="Worker activity timeline"
          description="Recent interpreted worker context without exposing raw accelerometer, gyroscope, or GPS values."
        />
        <WorkerTimeline timeline={worker.timeline} now={now} />
      </section>
    </div>
  );
}
