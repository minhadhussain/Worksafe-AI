"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChevronDown, Clock3, ShieldCheck, UserRound } from "lucide-react";

import { useDashboardData } from "@/components/dashboard/dashboard-provider";
import { cn } from "@vigil-os/shared/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "OVERVIEW" },
  { href: "/dashboard/workers", label: "WORKERS" },
  { href: "/dashboard/risk-map", label: "RISK MAP" },
  { href: "/dashboard/alerts", label: "ALERTS" },
  { href: "/dashboard/cameras", label: "CAMERAS" },
];

function formatDate(now: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(now);
}

function formatTime(now: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);
}

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { adminIdentifier, state, now, socketStatus } = useDashboardData();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-5 py-5 sm:px-7 lg:px-10">
        <header className="mb-6 rounded-2xl border border-border/80 bg-card/80 px-5 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-primary">VIGIL OS</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight">Safety Operations Center</h1>
              </div>
              <div className="h-10 w-px bg-border/80" />
              <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Site selector
                </p>
                <div className="mt-1 flex items-center gap-2 text-sm font-medium">
                  {state.siteName}
                  <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/75">Status</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-block size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.55)]" />
                  SITE OPERATIONAL
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Current time</p>
                <div className="mt-1 flex items-center gap-2 font-medium text-foreground">
                  <Clock3 className="size-4 text-primary" aria-hidden="true" />
                  {formatTime(now)}
                </div>
              </div>
              <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Date</p>
                <div className="mt-1 flex items-center gap-2 font-medium text-foreground">
                  <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                  {formatDate(now)}
                </div>
              </div>
              <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Admin profile</p>
                <div className="mt-1 flex items-center gap-2 font-medium text-foreground">
                  <UserRound className="size-4 text-primary" aria-hidden="true" />
                  {adminIdentifier}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-border/80 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <nav className="flex flex-wrap gap-2" aria-label="Dashboard navigation">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-semibold tracking-[0.16em] transition",
                      active
                        ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_18px_rgba(169,232,102,0.12)]"
                        : "border-border/80 bg-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="inline-flex items-center gap-2 rounded-lg border border-border/80 bg-muted/15 px-3 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              {socketStatus === "connected"
                ? "Live worker and camera events connected"
                : socketStatus === "connecting"
                  ? "Connecting live event stream"
                  : "Running on demo safety state"}
            </div>
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
