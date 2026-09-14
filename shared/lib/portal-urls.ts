const DEFAULT_ADMIN_PANEL_URL = "http://localhost:3000";
const DEFAULT_WORKER_PORTAL_URL = "http://localhost:3001";

function normalizeOrigin(origin: string, fallback: string): string {
  try {
    return new URL(origin).origin;
  } catch {
    return fallback;
  }
}

export const ADMIN_PANEL_URL = normalizeOrigin(
  process.env.NEXT_PUBLIC_ADMIN_PANEL_URL || DEFAULT_ADMIN_PANEL_URL,
  DEFAULT_ADMIN_PANEL_URL,
);

export const WORKER_PORTAL_URL = normalizeOrigin(
  process.env.NEXT_PUBLIC_WORKER_PORTAL_URL || DEFAULT_WORKER_PORTAL_URL,
  DEFAULT_WORKER_PORTAL_URL,
);

export const ADMIN_PANEL_HOST = new URL(ADMIN_PANEL_URL).host;
export const WORKER_PORTAL_HOST = new URL(WORKER_PORTAL_URL).host;

export function isWorkerPortalHost(host: string | null | undefined): boolean {
  return (host || "").toLowerCase() === WORKER_PORTAL_HOST.toLowerCase();
}

export function isAdminPanelHost(host: string | null | undefined): boolean {
  return (host || "").toLowerCase() === ADMIN_PANEL_HOST.toLowerCase();
}

export function buildPortalUrl(
  origin: string,
  pathname: string,
  search = "",
): string {
  const url = new URL(origin);
  url.pathname = pathname;
  url.search = search;
  return url.toString();
}
