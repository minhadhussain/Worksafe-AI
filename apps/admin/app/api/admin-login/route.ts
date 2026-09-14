import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import {
  ADMIN_SESSION_COOKIE_NAME,
  createAdminSessionToken,
  getAdminSessionMaxAgeSeconds,
} from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminLoginRequest = {
  identifier: string;
  passcode: string;
};

type LoginStatus = "success" | "denied";

function isValidPayload(payload: unknown): payload is AdminLoginRequest {
  return !!payload && typeof payload === "object" && "identifier" in payload && "passcode" in payload;
}

function constantTimeStringMatch(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

async function recordLoginEvent({
  identifier,
  status,
  request,
}: {
  identifier: string;
  status: LoginStatus;
  request: Request;
}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const accessKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  const table = process.env.SUPABASE_ADMIN_LOGIN_TABLE || "admin_login_events";

  if (!supabaseUrl || !accessKey) {
    return;
  }

  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = request.headers.get("user-agent") || null;

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessKey}`,
      apikey: accessKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify([
      {
        identifier,
        status,
        source: "admin-login",
        user_agent: userAgent,
        ip_address: ipAddress,
      },
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Supabase insert failed with status ${response.status}`);
  }
}

export async function POST(request: Request) {
  const expectedIdentifier = (process.env.ADMIN_LOGIN_IDENTIFIER || "ADMIN1").trim();
  const expectedPasscode = process.env.ADMIN_LOGIN_PASSCODE;
  if (!expectedIdentifier || !expectedPasscode) {
    return NextResponse.json(
      { message: "Admin login is temporarily unavailable." },
      { status: 503 },
    );
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  if (!isValidPayload(payload)) {
    return NextResponse.json({ message: "Invalid admin login payload." }, { status: 400 });
  }

  const identifier = payload.identifier.trim();
  const passcode = payload.passcode;
  if (!identifier || !passcode) {
    return NextResponse.json(
      { message: "Both the admin identifier and passcode are required." },
      { status: 400 },
    );
  }

  const status: LoginStatus =
    constantTimeStringMatch(identifier, expectedIdentifier) &&
    constantTimeStringMatch(passcode, expectedPasscode)
      ? "success"
      : "denied";

  try {
    await recordLoginEvent({ identifier, status, request });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown Supabase logging error.";
    console.error("admin_login_log_failed", detail);
  }

  if (status === "denied") {
    return NextResponse.json({ message: "Invalid admin credentials." }, { status: 401 });
  }

  const response = NextResponse.json(
    { message: "Access granted. Opening dashboard…", redirectTo: "/dashboard" },
    { status: 200 },
  );
  const sessionToken = createAdminSessionToken(expectedIdentifier);
  if (!sessionToken) {
    return NextResponse.json(
      { message: "Admin login is temporarily unavailable." },
      { status: 503 },
    );
  }
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getAdminSessionMaxAgeSeconds(),
  });
  return response;
}
