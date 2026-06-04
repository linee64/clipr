import type { ScriptResponse, ScriptVariant, ScriptVariantKey } from "@/lib/types";

export const VARIANT_TABS: { key: ScriptVariantKey; label: string }[] = [
  { key: "aggressive", label: "Aggressive" },
  { key: "storytelling", label: "Storytelling" },
  { key: "educational", label: "Educational" },
];

export type ScriptSection = "hook" | "problem" | "solution" | "cta";

export const SECTION_META: Record<
  ScriptSection,
  { label: string; timing: string; accent: "green" | "gray" }
> = {
  hook: { label: "HOOK", timing: "0 – 3 sec", accent: "green" },
  problem: { label: "PROBLEM", timing: "3 – 15 sec", accent: "gray" },
  solution: { label: "SOLUTION", timing: "15 – 45 sec", accent: "gray" },
  cta: { label: "CTA", timing: "45 – 60 sec", accent: "green" },
};

export function countWords(variant: ScriptVariant): number {
  const text = [variant.hook, variant.problem, variant.solution, variant.cta].join(" ");
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

export function estimateSeconds(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 2.45));
}

export function getVariant(
  data: ScriptResponse | null,
  key: ScriptVariantKey
): ScriptVariant | null {
  if (!data) return null;
  return data[key];
}

export function buildScriptSummary(variant: ScriptVariant): string {
  return [variant.hook, variant.problem, variant.solution, variant.cta]
    .filter(Boolean)
    .join("\n\n");
}
