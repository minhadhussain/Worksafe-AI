import type { Metadata } from "next";

import { LivePage } from "@/components/dashboard/pages/live-page";

export const metadata: Metadata = { title: "Live" };

export default function DashboardLiveRoute() {
  return <LivePage />;
}
