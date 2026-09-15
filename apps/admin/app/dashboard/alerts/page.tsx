import { redirect } from "next/navigation";

export default function DashboardAlertsRedirectRoute() {
  redirect("/dashboard/incidents");
}
