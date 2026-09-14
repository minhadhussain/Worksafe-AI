import type { Metadata } from "next";

import { OverviewPage } from "@/components/dashboard/pages/overview-page";

export const metadata: Metadata = { title: "Overview" };

export default function DashboardOverviewRoute() {
  return <OverviewPage />;
}
