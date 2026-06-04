"use client";

import { Check } from "lucide-react";

export type FlowStep = 1 | 2 | 3;

interface StepIndicatorProps {
  currentStep: FlowStep;
  referencesSkipped: boolean;
  onSkipReferences: () => void;
}

const STEPS = [
  { num: 1, label: "Script" },
  { num: 2, label: "References (optional)" },
  { num: 3, label: "Upload & Render" },
] as const;

export function StepIndicator({
  currentStep,
  referencesSkipped,
  onSkipReferences,
}: StepIndicatorProps) {
  const getStepState = (stepNum: number): "active" | "completed" | "skipped" | "inactive" => {
    if (stepNum === currentStep) return "active";
    if (stepNum < currentStep) {
      if (stepNum === 2 && referencesSkipped) return "skipped";
      return "completed";
    }
    if (stepNum === 2 && referencesSkipped && currentStep > 2) return "skipped";
    return "inactive";
  };

  return (
    <div className="sticky top-0 z-30 bg-[#1C1C1C] border-b border-[#333333] px-8 py-4 shrink-0">
      <div className="flex items-start justify-center max-w-3xl mx-auto">
        {STEPS.map((step, idx) => {
          const state = getStepState(step.num);
          const isLast = idx === STEPS.length - 1;

          return (
            <div key={step.num} className="flex items-start flex-1 last:flex-none">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div className="flex items-center w-full">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 transition-colors ${
                      state === "active"
                        ? "bg-[#10B981] text-white"
                        : state === "completed"
                          ? "bg-[#333333] text-[#10B981]"
                          : state === "skipped"
                            ? "bg-[#333333] text-[#888888]"
                            : "border border-[#333333] text-[#888888] bg-transparent"
                    }`}
                  >
                    {state === "completed" ? (
                      <Check className="w-4 h-4" strokeWidth={2.5} />
                    ) : (
                      step.num
                    )}
                  </div>
                  {!isLast && (
                    <div className="flex-1 h-px bg-[#333333] mx-2 mt-4 min-w-[24px]" />
                  )}
                </div>
                <div className="mt-2 text-center w-full px-1">
                  <span className="text-xs text-[#888888] block leading-tight">
                    {step.label}
                  </span>
                  {step.num === 2 && state === "skipped" && (
                    <span className="text-[10px] text-[#888888] block mt-0.5">Skipped</span>
                  )}
                  {step.num === 2 && currentStep === 1 && (
                    <button
                      type="button"
                      onClick={onSkipReferences}
                      className="text-xs text-[#888888] underline cursor-pointer hover:text-[#EFEFEF] mt-1 block mx-auto"
                    >
                      Skip references
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
