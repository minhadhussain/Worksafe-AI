import type { Metadata } from "next";

import { WorkersPage } from "@/components/dashboard/pages/workers-page";

export const metadata: Metadata = { title: "Workers" };

export default function DashboardWorkersRoute() {
  return <WorkersPage />;
}
