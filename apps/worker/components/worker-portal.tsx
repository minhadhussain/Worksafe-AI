import Link from "next/link";
import { CameraOff, HardHat, MapPin, Move3D } from "lucide-react";

import { WorkerConnect } from "@/components/worker-connect";
import { Card, CardContent, CardHeader, CardTitle } from "@vigil-os/shared/components/ui/card";
import { ADMIN_PANEL_URL } from "@vigil-os/shared/lib/portal-urls";

type WorkerPortalProps = {
  showAdminLink?: boolean;
};

export function WorkerPortal({ showAdminLink = true }: WorkerPortalProps) {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-8">
      {showAdminLink ? (
        <Link
          href={ADMIN_PANEL_URL}
          className="mb-8 inline-flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground"
        >
          Admin panel
        </Link>
      ) : null}
      <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <HardHat className="size-7" aria-hidden="true" />
      </div>
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-primary">VIGIL OS / Worker</p>
      <h1 className="text-3xl font-semibold tracking-tight">VIGIL OS Telemetry Client</h1>
      <p className="mb-7 mt-4 leading-relaxed text-muted-foreground">
        Your privacy is protected. No camera or microphone access is required.
      </p>
      <WorkerConnect />
      <Card className="mt-7">
        <CardHeader>
          <CardTitle className="text-sm">Designed for a phone in your pocket</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li className="flex items-center gap-3">
              <Move3D className="size-4 shrink-0" aria-hidden="true" /> Motion signals for
              fall detection
            </li>
            <li className="flex items-center gap-3">
              <MapPin className="size-4 shrink-0" aria-hidden="true" /> Location for facility
              zone routing
            </li>
            <li className="flex items-center gap-3">
              <CameraOff className="size-4 shrink-0 text-primary" aria-hidden="true" /> Camera
              and microphone blocked
            </li>
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            The Start Shift tap requests motion and location access, acquires a screen wake lock
            when available, and opens the live worker telemetry socket.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
