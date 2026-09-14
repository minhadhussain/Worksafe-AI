import type { Metadata } from "next";

import { CamerasPage } from "@/components/dashboard/pages/cameras-page";

export const metadata: Metadata = { title: "Cameras" };

export default function DashboardCamerasRoute() {
  return <CamerasPage />;
}
