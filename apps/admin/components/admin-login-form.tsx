"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { Button } from "@vigil-os/shared/components/ui/button";

type SubmitState = "idle" | "submitting" | "error";

type AdminLoginResponse = {
  message?: string;
  redirectTo?: string;
};

export function AdminLoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [passcode, setPasscode] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState(
    "Use your admin identifier and passcode to continue to the command center.",
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("Verifying access…");

    try {
      const response = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, passcode }),
      });
      const body = (await response.json().catch(() => ({}))) as AdminLoginResponse;

      if (!response.ok) {
        setState("error");
        setMessage(body.message || "Admin login failed.");
        return;
      }

      setState("idle");
      setMessage(body.message || "Access granted. Opening the dashboard…");
      router.push(body.redirectTo || "/dashboard");
      router.refresh();
    } catch {
      setState("error");
      setMessage("The admin login service is temporarily unavailable. Please try again shortly.");
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label htmlFor="admin-identifier" className="text-sm font-medium text-foreground">
          Admin username
        </label>
        <input
          id="admin-identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          autoFocus
          required
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="ADMIN1"
          className="h-12 w-full rounded-xl border border-border/80 bg-muted/20 px-4 text-sm text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="admin-passcode" className="text-sm font-medium text-foreground">
          Passcode
        </label>
        <input
          id="admin-passcode"
          name="passcode"
          type="password"
          autoComplete="current-password"
          required
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          placeholder="Enter admin passcode"
          className="h-12 w-full rounded-xl border border-border/80 bg-muted/20 px-4 text-sm text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={state === "submitting"}>
        {state === "submitting" ? (
          <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight aria-hidden="true" />
        )}
        {state === "submitting" ? "Signing In…" : "Admin Login"}
      </Button>

      <p
        role="status"
        className={`text-sm leading-relaxed ${state === "error" ? "text-red-300" : "text-muted-foreground"}`}
      >
        {message}
      </p>
    </form>
  );
}
