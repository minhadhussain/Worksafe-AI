import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CameraOff, HardHat, MapPin, Move3D } from "lucide-react";

import { WorkerConnect } from "@/components/worker-connect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Worker Client" };

export default function WorkerPage() {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-8">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" /> Platform overview</Link>
      <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground"><HardHat className="size-7" aria-hidden="true" /></div>
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-primary">WorkVision / Worker</p>
      <h1 className="text-3xl font-semibold tracking-tight">SafeGuard Telemetry Client</h1>
      <p className="mb-7 mt-4 leading-relaxed text-muted-foreground">Your privacy is protected. No camera or microphone access is required.</p>
      <WorkerConnect />
      <Card className="mt-7">
        <CardHeader><CardTitle className="text-sm">Designed for a phone in your pocket</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li className="flex items-center gap-3"><Move3D className="size-4 shrink-0" aria-hidden="true" /> Motion signals for fall detection</li>
            <li className="flex items-center gap-3"><MapPin className="size-4 shrink-0" aria-hidden="true" /> Location for facility zone routing</li>
            <li className="flex items-center gap-3"><CameraOff className="size-4 shrink-0 text-primary" aria-hidden="true" /> Camera and microphone blocked</li>
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Sensor permissions will be requested from the Start Shift click when telemetry is implemented. This preview does not request device permissions.</p>
        </CardContent>
      </Card>
    </main>
  );
}
