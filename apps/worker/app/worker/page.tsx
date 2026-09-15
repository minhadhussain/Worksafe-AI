import type { Metadata } from "next";

import { WorkerPortal } from "@/components/worker-portal";

export const metadata: Metadata = { title: "Worker Safety" };

export default function WorkerPage() {
  return <WorkerPortal />;
}
