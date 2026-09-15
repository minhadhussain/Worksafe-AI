// Keep the existing impact threshold, but require short temporal confirmation.
export const FALL_TRIGGER_G = 2.5;
export const CONFIRMATION_WINDOW_MS = 700;
export const MIN_CONFIRMATION_SPAN_MS = 120;
export const REQUIRED_IMPACT_SAMPLES = 3;
export const FALL_COOLDOWN_MS = 10_000;

type Candidate = { startedAt: number; lastSampleAt: number; samples: number };

export class FallDetector {
  private candidate: Candidate | null = null;
  private cooldownUntil = 0;

  sample(forceG: number, now: number): "possible" | "confirmed" | "clear" | null {
    if (!Number.isFinite(forceG) || !Number.isFinite(now) || now < this.cooldownUntil) return null;
    const expired = this.expire(now);
    if (forceG < FALL_TRIGGER_G) return expired ? "clear" : null;

    if (!this.candidate) {
      this.candidate = { startedAt: now, lastSampleAt: now, samples: 1 };
      return "possible";
    }

    // Multiple events with the same timestamp cannot confirm a fall.
    if (now <= this.candidate.lastSampleAt) return null;
    this.candidate.lastSampleAt = now;
    this.candidate.samples += 1;
    if (this.candidate.samples >= REQUIRED_IMPACT_SAMPLES &&
        now - this.candidate.startedAt >= MIN_CONFIRMATION_SPAN_MS) {
      this.rearm(now);
      return "confirmed";
    }
    return null;
  }

  expire(now: number): boolean {
    if (this.candidate && now - this.candidate.startedAt >= CONFIRMATION_WINDOW_MS) {
      this.candidate = null;
      return true;
    }
    return false;
  }

  rearm(now: number): void {
    this.candidate = null;
    this.cooldownUntil = now + FALL_COOLDOWN_MS;
  }

  reset(): void {
    this.candidate = null;
    this.cooldownUntil = 0;
  }
}
