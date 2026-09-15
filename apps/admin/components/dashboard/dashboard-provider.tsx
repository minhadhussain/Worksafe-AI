"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createInitialDashboardState, summarizeWorkers, type DashboardState } from "@/lib/dashboard-data";
import { adminSocketUrl, applySafetyMessage, fetchSafetySnapshot, type SafetyMessage } from "@/lib/safety-api";

type DashboardContextValue = {
  adminIdentifier: string;
  state: DashboardState;
  now: number;
  socketStatus: "connecting" | "connected" | "disconnected";
  summary: ReturnType<typeof summarizeWorkers>;
  resetDemoState: () => void;
};
const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ adminIdentifier, children }: { adminIdentifier: string; children: ReactNode }) {
  const [state, setState] = useState(createInitialDashboardState);
  // Identical first server/client render; the clock becomes local after hydration.
  const [now, setNow] = useState(0);
  const [socketStatus, setSocketStatus] = useState<DashboardContextValue["socketStatus"]>("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const resetDemoState = useCallback(() => {
    // Retained control now refreshes authoritative state, never fabricates or resets incidents.
    socketRef.current?.close(1000, "Refresh safety state");
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let disposed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function connect() {
      try {
        const snapshot = await fetchSafetySnapshot(AbortSignal.any([
          controller.signal, AbortSignal.timeout(5000),
        ]));
        if (!disposed) setState((current) => applySafetyMessage(current, snapshot));
      } catch { /* The socket may still be available; keep the last observed state. */ }
      if (disposed) return;
      const socket = new WebSocket(adminSocketUrl());
      socketRef.current = socket;
      socket.onopen = () => {
        if (!disposed) { retry = 0; setSocketStatus("connected"); }
      };
      socket.onmessage = (event) => {
        if (disposed) return;
        try {
          const message = JSON.parse(event.data) as SafetyMessage;
          setState((current) => applySafetyMessage(current, message));
        } catch { /* Ignore malformed envelopes; reconnect snapshots restore authoritative state. */ }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (disposed) return;
        setSocketStatus("disconnected");
        setState((current) => ({ ...current, cameras: current.cameras.map((camera) => ({
          ...camera, status: "offline", error: "Connection to safety service lost",
        })) }));
        timer = setTimeout(connect, Math.min(10_000, 1000 * 2 ** retry++));
      };
    }
    void connect();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
      socketRef.current?.close(1000, "Dashboard unmounted");
    };
  }, []);

  const summary = useMemo(() => summarizeWorkers(state.workers), [state.workers]);
  const value = useMemo(() => ({ adminIdentifier, state, now, socketStatus, summary, resetDemoState }),
    [adminIdentifier, state, now, socketStatus, summary, resetDemoState]);
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
export function useDashboardData() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboardData must be used inside DashboardProvider");
  return context;
}
