import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { ADMIN_PANEL_URL, buildPortalUrl } from "@vigil-os/shared/lib/portal-urls";

function shouldSkipRouting(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname === "/icon.svg"
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (shouldSkipRouting(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin-login")) {
    return NextResponse.redirect(buildPortalUrl(ADMIN_PANEL_URL, pathname, search));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/icon.svg"],
};
