import { NextResponse } from "next/server";

import type { HealthSnapshot } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  let snapshot: HealthSnapshot;
  try {
    // Server-only URL works both on the host and on the Compose network.
    const base = (process.env.API_INTERNAL_URL || "http://localhost:8000").replace(/\/$/, "");
    const response = await fetch(`${base}/health/ready`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    const body: unknown = await response.json();
    if (
      (response.status !== 200 && response.status !== 503) ||
      !body || typeof body !== "object" ||
      !("status" in body) || !("dependencies" in body) ||
      !body.dependencies || typeof body.dependencies !== "object" ||
      !("redis" in body.dependencies) ||
      !((response.status === 200 && body.status === "ready" && body.dependencies.redis === "up") ||
        (response.status === 503 && body.status === "degraded" && body.dependencies.redis === "down"))
    ) {
      throw new Error("Unexpected readiness response");
    }
    snapshot = {
      status: response.ok ? "ready" : "degraded",
      api: "up",
      redis: body.dependencies.redis as "up" | "down",
    };
  } catch {
    snapshot = { status: "unavailable", api: "down", redis: "unknown" };
  }

  return NextResponse.json(snapshot, {
    status: snapshot.status === "ready" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
