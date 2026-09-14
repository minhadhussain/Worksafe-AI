import { NextResponse } from "next/server";

import { fetchHealthSnapshot } from "@vigil-os/shared/server/health-proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await fetchHealthSnapshot(
    process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_INTERNAL_URL,
  );

  return NextResponse.json(snapshot, {
    status: snapshot.status === "ready" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
