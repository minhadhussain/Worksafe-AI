import Link from "next/link";
import { ArrowRight, Camera, CircuitBoard, HardHat, Layers3, ShieldCheck, Smartphone } from "lucide-react";

import { SystemStatus } from "@/components/system-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const modules = [
  { title: "Vision monitoring", icon: Camera, phase: "02", description: "Fixed CCTV feeds and PPE detection with YOLOv8." },
  { title: "Worker telemetry", icon: Smartphone, phase: "03", description: "Motion and location signals from a phone in a pocket." },
  { title: "Machine health", icon: CircuitBoard, phase: "04", description: "Temperature and vibration readings from ESP32 nodes." },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-5 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-6">
        <Link href="/" className="flex items-center gap-3 text-lg font-bold tracking-tight" aria-label="WorkVision home">
          <span className="rounded-lg bg-primary p-2 text-primary-foreground"><HardHat className="size-5" aria-hidden="true" /></span>
          WORKVISION
        </Link>
        <span className="rounded border border-border px-3 py-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">Phase 01 / Foundation</span>
      </header>

      <main id="main" className="py-10 sm:py-14">
        <section className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">Safety operations / Platform setup</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">One site. One safety view.</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              The foundation for connected workers, intelligent vision, and machine health. Built around immediate, actionable safety signals.
            </p>
          </div>
          <Button asChild size="lg"><Link href="/worker"><Smartphone aria-hidden="true" /> Start Shift <ArrowRight aria-hidden="true" /></Link></Button>
        </section>

        <section className="grid items-start gap-6 lg:grid-cols-[1.7fr_1fr]" aria-label="Platform foundation">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Layers3 className="size-4 text-primary" aria-hidden="true" /> Connected safety, step by step</CardTitle>
              <CardDescription>The application shell is ready. Detection modules are the next milestones.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {modules.map(({ title, icon: Icon, phase, description }) => (
                  <li key={phase} className="flex gap-4 py-5 first:pt-1 last:pb-1">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-5" aria-hidden="true" /></div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold">{title}</h2>
                        <span className="font-mono text-xs text-muted-foreground">PLANNED / {phase}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <div className="space-y-6">
            <SystemStatus />
            <div className="flex items-start gap-3 rounded-xl border border-border p-5">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold">Worker privacy by design</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">No camera or microphone access on worker phones. Vision comes from fixed site cameras.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-wrap justify-between gap-3 border-t border-border py-6 text-xs text-muted-foreground">
        <span>WorkVision · Vision-first industrial safety</span>
        <span>Next.js / FastAPI / Redis</span>
      </footer>
    </div>
  );
}
