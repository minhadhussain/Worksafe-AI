import type { Metadata } from "next";

import { WorkerProfilePage } from "@/components/dashboard/pages/worker-profile-page";

type WorkerProfileRouteProps = {
  params: Promise<{
    workerId: string;
  }>;
};

export const metadata: Metadata = { title: "Worker Profile" };

export default async function DashboardWorkerProfileRoute({
  params,
}: WorkerProfileRouteProps) {
  const { workerId } = await params;
  return <WorkerProfilePage workerId={workerId} />;
}
