import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardProvider } from "@/components/dashboard/dashboard-provider";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  ADMIN_SESSION_COOKIE_NAME,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const session = verifyAdminSessionToken(sessionToken);

  if (!session) {
    redirect("/admin-login");
  }

  return (
    <DashboardProvider adminIdentifier={session.identifier}>
      <DashboardShell>{children}</DashboardShell>
    </DashboardProvider>
  );
}
