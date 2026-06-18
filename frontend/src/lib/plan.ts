// Subscription / trial state — local-only for now (there's no payment backend yet).
// The 3-day free trial is tracked from a start timestamp written on first run, and
// "upgrading" flips a local flag. To wire a real provider (Stripe) later, replace
// `setPlan` with a checkout redirect and hydrate `readPlan` from the subscription.

export const TRIAL_DAYS = 3;
export const PRO_PRICE = "$25";

export type PlanKind = "trial" | "pro";

export interface PlanState {
  plan: PlanKind;
  /** whole days remaining in the trial (0 once it has elapsed) */
  daysLeft: number;
  /** true when on the trial and it has run out */
  expired: boolean;
}

const TRIAL_KEY = "clipr_trial_start";
const PLAN_KEY = "clipr_plan";
const DAY_MS = 86_400_000;

const DEFAULT: PlanState = { plan: "trial", daysLeft: TRIAL_DAYS, expired: false };

/** Read the plan state, lazily starting the trial clock on first access. */
export function readPlan(): PlanState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    let start = Number(localStorage.getItem(TRIAL_KEY));
    if (!start || Number.isNaN(start)) {
      start = Date.now();
      localStorage.setItem(TRIAL_KEY, String(start));
    }
    const plan: PlanKind = localStorage.getItem(PLAN_KEY) === "pro" ? "pro" : "trial";
    const used = Math.floor((Date.now() - start) / DAY_MS);
    const daysLeft = Math.max(0, TRIAL_DAYS - used);
    return { plan, daysLeft, expired: plan === "trial" && daysLeft <= 0 };
  } catch {
    return DEFAULT;
  }
}

/** Switch the plan (no real billing yet) and return the fresh state. */
export function setPlan(plan: PlanKind): PlanState {
  try {
    localStorage.setItem(PLAN_KEY, plan);
  } catch {
    /* ignore */
  }
  return readPlan();
}
