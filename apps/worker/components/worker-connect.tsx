"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CONFIRMATION_WINDOW_MS, FallDetector } from "@/lib/fall-detector";
import { isSafetyApiConfigured, sendFallEvent, type FallPayload } from "@/lib/fall-api";
import styles from "./worker-safety.module.css";

const WORKER_ID = process.env.NEXT_PUBLIC_WORKER_ID || "W-001";
const SENSOR_WAIT_MS = 5000;
const REPORT_TIMEOUT_MS = 10_000;
type MotionConstructor = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};
type Phase = "idle" | "requesting" | "monitoring" | "possible" | "sending" | "notified" | "failed" | "resolving";
type Screen = { phase: Phase; note?: string };

function accelerationMagnitude(event: DeviceMotionEvent): number | null {
  for (const vector of [event.accelerationIncludingGravity, event.acceleration]) {
    if (vector && [vector.x, vector.y, vector.z].every((n) => typeof n === "number" && Number.isFinite(n))) {
      return Math.hypot(vector.x!, vector.y!, vector.z!) / 9.80665;
    }
  }
  return null;
}

export function WorkerConnect() {
  const [screen, setScreen] = useState<Screen>({ phase: "idle" });
  const phase = useRef<Phase>("idle");
  const mounted = useRef(false);
  const generation = useRef(0);
  const detector = useRef(new FallDetector());
  const listener = useRef<((event: DeviceMotionEvent) => void) | null>(null);
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sensorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const pending = useRef<FallPayload | null>(null);
  const incidentId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const retryResolution = useRef(false);

  const show = useCallback((next: Screen) => {
    phase.current = next.phase;
    if (mounted.current) setScreen(next);
  }, []);

  const cleanup = useCallback(() => {
    generation.current += 1;
    if (listener.current) window.removeEventListener("devicemotion", listener.current);
    listener.current = null;
    for (const timer of [confirmationTimer, sensorTimer, reportTimer]) {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    }
    request.current?.abort();
    request.current = null;
    detector.current.reset();
    pending.current = null;
    incidentId.current = null;
    inFlight.current = false;
    retryResolution.current = false;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cleanup(); };
  }, [cleanup]);

  function stopMonitoring() {
    cleanup();
    show({ phase: "idle" });
  }

  async function reportFall(resolve = false) {
    if (inFlight.current || !pending.current || (resolve && !incidentId.current)) return;
    const session = generation.current;
    inFlight.current = true;
    retryResolution.current = resolve;
    show({ phase: resolve ? "resolving" : "sending" });
    const controller = new AbortController();
    request.current = controller;
    reportTimer.current = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);
    try {
      const acknowledgment = await sendFallEvent(
        pending.current, resolve ? incidentId.current : null, controller.signal,
      );
      if (!mounted.current || generation.current !== session) return;
      incidentId.current = acknowledgment.id;
      if (acknowledgment.status === "resolved") {
        pending.current = null;
        incidentId.current = null;
        detector.current.rearm(performance.now());
        show({ phase: "monitoring" });
      } else {
        show({ phase: "notified" });
      }
    } catch {
      if (!mounted.current || generation.current !== session) return;
      show({ phase: "failed", note: resolve
        ? "Could not confirm resolution. The alert remains active."
        : "Could not reach safety system." });
    } finally {
      // An old request must not change a newly started monitoring session.
      if (generation.current === session) {
        if (reportTimer.current !== null) clearTimeout(reportTimer.current);
        reportTimer.current = null;
        request.current = null;
        inFlight.current = false;
      }
    }
  }

  async function startMonitoring() {
    if (phase.current !== "idle") return;
    if (!window.isSecureContext) {
      show({ phase: "idle", note: "SECURE CONNECTION REQUIRED" });
      return;
    }
    if (typeof window.DeviceMotionEvent === "undefined") {
      show({ phase: "idle", note: "MOTION SENSOR UNAVAILABLE" });
      return;
    }
    if (!isSafetyApiConfigured()) {
      show({ phase: "idle", note: "SAFETY SYSTEM UNAVAILABLE" });
      return;
    }

    const session = ++generation.current;
    show({ phase: "requesting" });
    try {
      // Keep the permission call on the START click, before any asynchronous work.
      const constructor = window.DeviceMotionEvent as MotionConstructor;
      const permission = constructor.requestPermission ? await constructor.requestPermission() : "granted";
      if (!mounted.current || generation.current !== session) return;
      if (permission !== "granted") {
        show({ phase: "idle", note: "MOTION ACCESS DENIED" });
        return;
      }

      detector.current.reset();
      show({ phase: "monitoring" });
      sensorTimer.current = setTimeout(() => {
        if (generation.current !== session) return;
        cleanup();
        show({ phase: "idle", note: "MOTION SENSOR UNAVAILABLE" });
      }, SENSOR_WAIT_MS);

      listener.current = (event) => {
        if (generation.current !== session || pending.current) return;
        const force = accelerationMagnitude(event);
        if (force === null) return;
        if (sensorTimer.current !== null) clearTimeout(sensorTimer.current);
        sensorTimer.current = null;
        const result = detector.current.sample(force, performance.now());
        if (result === "possible") {
          show({ phase: "possible" });
          if (confirmationTimer.current !== null) clearTimeout(confirmationTimer.current);
          confirmationTimer.current = setTimeout(() => {
            confirmationTimer.current = null;
            if (generation.current === session && phase.current === "possible") {
              detector.current.expire(performance.now());
              show({ phase: "monitoring" });
            }
          }, CONFIRMATION_WINDOW_MS);
        } else if (result === "clear") {
          if (confirmationTimer.current !== null) clearTimeout(confirmationTimer.current);
          confirmationTimer.current = null;
          show({ phase: "monitoring" });
        } else if (result === "confirmed") {
          if (confirmationTimer.current !== null) clearTimeout(confirmationTimer.current);
          confirmationTimer.current = null;
          pending.current = { worker_id: WORKER_ID, event_id: crypto.randomUUID(), timestamp: Date.now() / 1000 };
          void reportFall();
        }
      };
      window.addEventListener("devicemotion", listener.current);
    } catch {
      if (!mounted.current || generation.current !== session) return;
      cleanup();
      show({ phase: "idle", note: "MOTION SENSOR UNAVAILABLE" });
    }
  }

  const critical = ["sending", "notified", "failed", "resolving"].includes(screen.phase);
  const circleText = screen.phase === "possible" ? "POSSIBLE FALL"
    : screen.phase === "requesting" ? "STARTING" : "MONITORING";

  return (
    <main id="main" className={`${styles.page} ${critical ? styles.critical : ""}`}>
      <header className={styles.brand}>
        <p>VIGIL OS</p>
        <h1>/ WORKER SAFETY</h1>
      </header>

      <section className={styles.controls} aria-label="Worker safety controls">
        {screen.phase === "idle" ? (
          <button type="button" className={`${styles.circle} ${styles.start}`} onClick={startMonitoring} aria-label="START MONITORING">
            <span>START</span><small>MONITORING</small>
          </button>
        ) : critical ? (
          <div className={styles.alarm} role="alert" aria-atomic="true">
            <h2>{screen.phase === "failed" ? "ALERT FAILED" : "FALL DETECTED"}</h2>
            <p>{screen.phase === "notified" ? "SUPERVISOR NOTIFIED"
              : screen.phase === "sending" ? "SENDING ALERT…"
                : screen.phase === "resolving" ? "CONFIRMING…" : screen.note}</p>
          </div>
        ) : (
          <div className={styles.circle} role="status" aria-atomic="true">
            <span className={styles.indicator} aria-hidden="true" />
            <span className={styles.stateLabel}>{circleText}</span>
            <small>{screen.phase === "possible" ? "Checking…"
              : screen.phase === "requesting" ? "Motion access" : "MOTION ACTIVE"}</small>
          </div>
        )}

        {screen.phase === "notified" && (
          <button type="button" className={styles.action} onClick={() => void reportFall(true)}>I&apos;M OK</button>
        )}
        {screen.phase === "failed" && (
          <button type="button" className={styles.action} onClick={() => void reportFall(retryResolution.current)}>RETRY</button>
        )}
        <button type="button" className={styles.stop} onClick={stopMonitoring} disabled={screen.phase === "idle"}>STOP</button>
        <p className={styles.note} role="status">{screen.phase === "idle" ? screen.note : ""}</p>
      </section>

      <div aria-hidden="true" />
    </main>
  );
}
