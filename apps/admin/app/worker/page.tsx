import { redirect } from "next/navigation";

import { WORKER_PORTAL_URL } from "@vigil-os/shared/lib/portal-urls";

export default function AdminWorkerRedirectPage() {
  redirect(WORKER_PORTAL_URL);
}
