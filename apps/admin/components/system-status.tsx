"use client";

import { useEffect, useState } from "react";
import { Activity, Database, Server } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@vigil-os/shared/components/ui/card";
import { getHealth, type HealthSnapshot } from "@vigil-os/shared/lib/health";
import { cn } from "@vigil-os/shared/lib/utils";

export function SystemStatus() {
  const [health, setHealth] = useState<HealthSnapshot | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const snapshot = await getHealth(
          AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]),
        );
        if (!controller.signal.aborted) setHealth(snapshot);
      } catch {
        if (!controller.signal.aborted) {
          setHealth({ status: "unavailable", api: "down", redis: "unknown" });
        }
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 15_000);
      }
    }

    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  const ready = health?.status === "ready";
  const label = !health ? "Checking services" : ready ? "Core services online" : "Service attention needed";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-primary" aria-hidden="true" /> Infrastructure
        </CardTitle>
        <CardDescription>Live service checks · refreshes every 15 seconds</CardDescription>
      </CardHeader>
      <CardContent aria-live="polite" aria-atomic="true">
        <p className="mb-5 flex items-center gap-2 text-sm font-medium">
          <span className={cn("size-2 rounded-full", !health ? "bg-muted-foreground" : ready ? "bg-emerald-400" : "bg-amber-400")} />
          {label}
        </p>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="flex items-center gap-2 text-muted-foreground"><Server className="size-4" aria-hidden="true" /> FastAPI</dt>
            <dd>{!health ? "Checking…" : health.api === "up" ? "Reachable" : "Unreachable"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="flex items-center gap-2 text-muted-foreground"><Database className="size-4" aria-hidden="true" /> Redis</dt>
            <dd>{!health ? "Checking…" : health.redis === "up" ? "Connected" : health.redis === "down" ? "Disconnected" : "Unknown"}</dd>
          </div>
        </dl>
        <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
          Infrastructure health only. Worker telemetry and vision inference run on separate realtime channels.
        </p>
      </CardContent>
    </Card>
  );
}
