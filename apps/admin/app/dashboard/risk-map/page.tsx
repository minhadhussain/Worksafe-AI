import type { Metadata } from "next";

import { RiskMapPage } from "@/components/dashboard/pages/risk-map-page";

export const metadata: Metadata = { title: "Risk Map" };

export default function DashboardRiskMapRoute() {
  return <RiskMapPage />;
}
