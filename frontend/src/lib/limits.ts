// Free-tier usage limits. Pro (an active Polar subscription) is unlimited; free
// users get a small allowance per action, counted in localStorage (same trust
// model as the trial clock — resettable, but it's the product gate the UI shows).
// Premium *voices* and *reference styles* are gated separately by their `premium`
// flag from the API (see VoiceoverPicker / TemplatePickStep), not counted here.

export const FREE_LIMITS = {
  /** storyboard regenerations allowed on the free tier */
  regen: 3,
  /** AI voiceover uses (renders with voiceover) allowed on the free tier */
  voiceover: 2,
} as const;

export type LimitKey = keyof typeof FREE_LIMITS;

const STORAGE_KEY: Record<LimitKey, string> = {
  regen: "clipr_usage_regen",
  voiceover: "clipr_usage_voiceover",
};

/** How many times this action has been used so far (0 if never / on error). */
export function getUsage(key: LimitKey): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY[key]));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** Record one use and return the new count. */
export function bumpUsage(key: LimitKey): number {
  const next = getUsage(key) + 1;
  try {
    localStorage.setItem(STORAGE_KEY[key], String(next));
  } catch {
    /* ignore */
  }
  return next;
}

/** Uses remaining for this action; Infinity when Pro. */
export function usesLeft(key: LimitKey, isPro: boolean): number {
  if (isPro) return Infinity;
  return Math.max(0, FREE_LIMITS[key] - getUsage(key));
}

/** Whether the action can still be used (always true for Pro). */
export function canUse(key: LimitKey, isPro: boolean): boolean {
  return isPro || usesLeft(key, isPro) > 0;
}
