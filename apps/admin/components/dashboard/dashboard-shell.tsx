"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, UserRound } from "lucide-react";

import { useDashboardData } from "@/components/dashboard/dashboard-provider";
import { cn } from "@vigil-os/shared/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "OVERVIEW" },
  { href: "/dashboard/workers", label: "WORKERS" },
  { href: "/dashboard/incidents", label: "INCIDENTS" },
];

function formatTime(now: number): string {
  if (!now) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);
}

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { adminIdentifier, state, now, socketStatus } = useDashboardData();

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-5 py-5 sm:px-7 lg:px-10">
        <header className="mb-8 border-b border-white/10 pb-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-lime-300">VIGIL OS</p>
                <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-white">
                  Safety Operations
                </h1>
              </div>
              <div className="h-12 w-px bg-white/10" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Factory</p>
                <p className="mt-2 text-base font-medium text-white">{state.siteName}</p>
                <p className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                  <span className="inline-block size-2 rounded-full bg-white" />
                  {state.cameras.every((camera) => camera.status === "online") ? "MONITORING ONLINE" : "MONITORING STARTING / DEGRADED"}
                </p>
              </div>
            </div>

            <div className="justify-self-start text-left lg:justify-self-end lg:text-right">
              <p suppressHydrationWarning className="flex items-center gap-2 text-[30px] font-semibold leading-none tracking-tight text-white lg:justify-end">
                <Clock3 className="size-5 text-white/50" aria-hidden="true" />
                {formatTime(now)}
              </p>
              <p className="mt-3 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/55 lg:justify-end">
                <UserRound className="size-4 text-white/45" aria-hidden="true" />
                {adminIdentifier}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <nav className="flex flex-wrap gap-6" aria-label="Dashboard navigation">
              {NAV_ITEMS.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href === "/dashboard/incidents" && pathname === "/dashboard/alerts");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "border-b pb-2 text-[11px] font-semibold tracking-[0.2em] transition",
                      active
                        ? "border-lime-300 text-white"
                        : "border-transparent text-white/45 hover:border-white/30 hover:text-white",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
              <span
                className={cn(
                  "inline-block size-2 rounded-full",
                  socketStatus === "connected"
                    ? "bg-white"
                    : socketStatus === "connecting"
                      ? "bg-amber-300"
                      : "bg-white/35",
                )}
              />
              {socketStatus === "connected"
                ? "Live events connected"
                : socketStatus === "connecting"
                  ? "Connecting live event stream"
                  : "Live connection lost"}
            </div>
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
