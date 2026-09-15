import type { Metadata } from "next";

import { IncidentsPage } from "@/components/dashboard/pages/incidents-page";

export const metadata: Metadata = { title: "Incidents" };

export default function DashboardIncidentsRoute() {
  return <IncidentsPage />;
}
