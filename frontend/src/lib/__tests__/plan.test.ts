import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readPlan, setPlan, TRIAL_DAYS } from "@/lib/plan";

const DAY = 86_400_000;
const T0 = new Date("2026-01-01T00:00:00Z").getTime();

describe("plan / trial clock", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("starts a fresh trial with the full day count", () => {
    const p = readPlan();
    expect(p.plan).toBe("trial");
    expect(p.daysLeft).toBe(TRIAL_DAYS);
    expect(p.expired).toBe(false);
  });

  it("counts down by elapsed days", () => {
    readPlan(); // start the clock at T0
    vi.setSystemTime(T0 + DAY);
    const p = readPlan();
    expect(p.daysLeft).toBe(TRIAL_DAYS - 1);
    expect(p.expired).toBe(false);
  });

  it("expires once TRIAL_DAYS have elapsed", () => {
    readPlan();
    vi.setSystemTime(T0 + TRIAL_DAYS * DAY);
    const p = readPlan();
    expect(p.daysLeft).toBe(0);
    expect(p.expired).toBe(true);
  });

  it("setPlan('pro') persists and is never marked expired", () => {
    setPlan("pro");
    vi.setSystemTime(T0 + 99 * DAY); // even long after the trial would have ended
    const p = readPlan();
    expect(p.plan).toBe("pro");
    expect(p.expired).toBe(false); // 'expired' only applies to the trial plan
  });

  it("a new account email resets the clock and clears inherited Pro", () => {
    localStorage.setItem("clipr_email", "old@x.co");
    readPlan(); // binds the clock to old@x.co
    setPlan("pro");
    expect(readPlan().plan).toBe("pro"); // sanity: old account is Pro

    localStorage.setItem("clipr_email", "new@x.co"); // switch account
    const p = readPlan();
    expect(p.plan).toBe("trial"); // inherited Pro cleared
    expect(p.daysLeft).toBe(TRIAL_DAYS); // fresh clock
  });
});
