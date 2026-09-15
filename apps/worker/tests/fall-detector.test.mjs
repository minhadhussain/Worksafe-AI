import assert from "node:assert/strict";
import test from "node:test";
import { FallDetector } from "../lib/fall-detector.ts";

test("one noisy impact expires without a confirmed fall", () => {
  const detector = new FallDetector();
  assert.equal(detector.sample(3.2, 0), "possible");
  assert.equal(detector.sample(1, 100), null);
  assert.equal(detector.expire(699), false);
  assert.equal(detector.expire(700), true);
  assert.equal(detector.sample(3.2, 800), "possible");
});

test("confirmation requires multiple impacts spanning enough time", () => {
  const detector = new FallDetector();
  assert.equal(detector.sample(3, 0), "possible");
  assert.equal(detector.sample(3, 50), null);
  assert.equal(detector.sample(3, 100), null);
  assert.equal(detector.sample(3, 150), "confirmed");
  assert.equal(detector.sample(4, 200), null);
});

test("duplicate timestamps cannot turn one observation into a fall", () => {
  const detector = new FallDetector();
  assert.equal(detector.sample(4, 100), "possible");
  for (let index = 0; index < 50; index++) assert.equal(detector.sample(4, 100), null);
  assert.equal(detector.expire(800), true);
});

test("separate isolated spikes do not accumulate across confirmation windows", () => {
  const detector = new FallDetector();
  for (const timestamp of [0, 800, 1600, 2400]) {
    assert.equal(detector.sample(3, timestamp), "possible");
  }
});

test("resolution rearms with cooldown, and STOP resets all detector state", () => {
  const detector = new FallDetector();
  detector.sample(3, 0);
  detector.sample(3, 80);
  assert.equal(detector.sample(3, 160), "confirmed");
  detector.rearm(1000);
  assert.equal(detector.sample(3, 10_999), null);
  assert.equal(detector.sample(3, 11_000), "possible");
  detector.reset();
  assert.equal(detector.sample(3, 11_001), "possible");
  detector.reset();
  assert.equal(detector.sample(3, 20), "possible");
});

test("unavailable or non-finite sensor values cannot create an incident", () => {
  const detector = new FallDetector();
  assert.equal(detector.sample(NaN, 0), null);
  assert.equal(detector.sample(Infinity, 50), null);
  assert.equal(detector.sample(4, NaN), null);
  assert.equal(detector.sample(0, 100), null);
});
