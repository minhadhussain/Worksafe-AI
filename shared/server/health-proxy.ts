import type { HealthSnapshot } from "../lib/health";


export async function fetchHealthSnapshot(
  apiInternalUrl: string | undefined,
): Promise<HealthSnapshot> {
  try {
    const base = (apiInternalUrl || "http://localhost:8000").replace(/\/$/, "");
    const response = await fetch(`${base}/health/ready`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    const body: unknown = await response.json();
    if (
      (response.status !== 200 && response.status !== 503) ||
      !body ||
      typeof body !== "object" ||
      !("status" in body) ||
      !("dependencies" in body) ||
      !body.dependencies ||
      typeof body.dependencies !== "object" ||
      !("redis" in body.dependencies) ||
      !(
        (response.status === 200 && body.status === "ready" && body.dependencies.redis === "up") ||
        (response.status === 503 &&
          body.status === "degraded" &&
          body.dependencies.redis === "down")
      )
    ) {
      throw new Error("Unexpected readiness response");
    }
    return {
      status: response.ok ? "ready" : "degraded",
      api: "up",
      redis: body.dependencies.redis as "up" | "down",
    };
  } catch {
    return { status: "unavailable", api: "down", redis: "unknown" };
  }
}
