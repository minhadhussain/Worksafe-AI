import type { Metadata } from "next";

import { AlertsPage } from "@/components/dashboard/pages/alerts-page";

export const metadata: Metadata = { title: "Alerts" };

export default function DashboardAlertsRoute() {
  return <AlertsPage />;
}
