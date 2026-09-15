export type FallPayload = { worker_id: string; event_id: string; timestamp: number };
export type FallAcknowledgment = { id: string; status: "active" | "resolved" };

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const WORKER_TOKEN = process.env.NEXT_PUBLIC_WORKER_TOKEN || "dev_device_worker_001";

export function isSafetyApiConfigured(): boolean {
  return Boolean(API_BASE_URL);
}

export async function sendFallEvent(
  payload: FallPayload,
  incidentId: string | null,
  signal: AbortSignal,
): Promise<FallAcknowledgment> {
  if (!API_BASE_URL) throw new Error("Safety API is not configured");
  const resolving = incidentId !== null;
  const response = await fetch(`${API_BASE_URL}/api/worker/fall${resolving ? "/resolve" : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${WORKER_TOKEN}` },
    body: JSON.stringify(resolving ? { worker_id: payload.worker_id, incident_id: incidentId } : payload),
    signal,
  });
  const body = await response.json();
  const incident = body?.incident;
  if (!response.ok || body?.status !== (resolving ? "resolved" : "accepted") ||
      typeof incident?.id !== "string" || !incident.id ||
      incident.worker_id !== payload.worker_id || incident.type !== "FALL_DETECTED" ||
      (incident.status !== "active" && incident.status !== "resolved") ||
      (resolving && (incident.id !== incidentId || incident.status !== "resolved"))) {
    throw new Error("Safety service did not acknowledge the event");
  }
  return { id: incident.id, status: incident.status };
}
