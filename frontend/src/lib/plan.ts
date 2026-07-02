// Subscription / trial state. Real Pro comes from Polar (the dashboard hydrates
// readPlan from the billing status); this local clock is the pre-subscription
// "try it free" period. The trial is scoped to the signed-in account (clipr_email)
// so a NEW account in the same browser gets a fresh trial instead of inheriting a
// previous user's elapsed clock (or their local Pro flag).

export const TRIAL_DAYS = 3;
export const PRO_PRICE = "$6.99";
export const PRO_PRICE_1M = "$6.99";
export const PRO_PRICE_3M = "$12.99";
export const PRO_PRICE_6M = "$34.99";
export const FREE_VIDEO_LIMIT = 5;
export const PRO_VIDEO_LIMIT = 20;

export type PlanKind = "trial" | "pro";

export interface PlanState {
  plan: PlanKind;
  /** whole days remaining in the trial (0 once it has elapsed) */
  daysLeft: number;
  /** true when on the trial and it has run out */
  expired: boolean;
}

const TRIAL_KEY = "clipr_trial_start";
const TRIAL_EMAIL_KEY = "clipr_trial_email"; // which account the clock belongs to
const PLAN_KEY = "clipr_plan";
const EMAIL_KEY = "clipr_email";
const DAY_MS = 86_400_000;

const DEFAULT: PlanState = { plan: "trial", daysLeft: TRIAL_DAYS, expired: false };

/** Read the plan state, lazily starting the trial clock on first access.
 *
 * The clock is keyed to the signed-in email: if it differs from the account the
 * stored clock belongs to (i.e. a new/different account in this browser), the
 * trial restarts and any inherited local Pro flag is cleared — the dashboard then
 * re-hydrates real Pro from the billing status. */
export function readPlan(): PlanState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const email = (localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();
    const trialEmail = (localStorage.getItem(TRIAL_EMAIL_KEY) || "").trim().toLowerCase();
    let start = Number(localStorage.getItem(TRIAL_KEY));

    // Fresh trial when a known account doesn't match the clock's owner.
    if (email && email !== trialEmail) {
      start = Date.now();
      localStorage.setItem(TRIAL_KEY, String(start));
      localStorage.setItem(TRIAL_EMAIL_KEY, email);
      localStorage.setItem(PLAN_KEY, "trial"); // don't inherit another account's Pro
    } else if (!start || Number.isNaN(start)) {
      start = Date.now();
      localStorage.setItem(TRIAL_KEY, String(start));
      if (email) localStorage.setItem(TRIAL_EMAIL_KEY, email);
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
