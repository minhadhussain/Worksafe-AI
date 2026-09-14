export type HealthSnapshot = {
  status: "ready" | "degraded" | "unavailable";
  api: "up" | "down";
  redis: "up" | "down" | "unknown";
};

export async function getHealth(signal?: AbortSignal): Promise<HealthSnapshot> {
  const response = await fetch("/api/health", { cache: "no-store", signal });
  // 503 is a valid, structured dependency-health response.
  if (response.status !== 200 && response.status !== 503) {
    throw new Error("Health check failed");
  }
  return response.json();
}
