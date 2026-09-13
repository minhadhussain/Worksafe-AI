"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getHealth } from "@/lib/health";

export function WorkerConnect() {
  const [state, setState] = useState<"idle" | "checking" | "ready" | "error">("idle");

  async function startShift() {
    setState("checking");
    try {
      const health = await getHealth(AbortSignal.timeout(5_000));
      setState(health.status === "ready" ? "ready" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="space-y-4">
      <Button size="lg" className="w-full" onClick={startShift} disabled={state === "checking"}>
        {state === "checking" ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
        {state === "idle" ? "Start Shift & Connect" : state === "checking" ? "Checking connection…" : "Check connection again"}
      </Button>
      <div role="status" className="min-h-16 text-sm leading-relaxed text-muted-foreground">
        {state === "idle" && "Phase 1 preview: this button checks the backend connection. Live shifts and sensor streaming arrive in Phase 3."}
        {state === "checking" && "Contacting the safety platform…"}
        {state === "ready" && "Backend and Redis are reachable. No shift is being tracked yet; motion and location streaming will be connected in Phase 3."}
        {state === "error" && "The platform is not ready. Check that the API and Redis are running, then try again. No shift has started."}
      </div>
    </div>
  );
}
