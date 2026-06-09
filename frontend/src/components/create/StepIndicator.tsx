"use client";

import { Check } from "lucide-react";

export type FlowStep = 1 | 2 | 3 | 4 | 5;

interface StepIndicatorProps {
  currentStep: FlowStep;
}

const STEPS = [
  { num: 1, label: "Idea" },
  { num: 2, label: "Storyboard" },
  { num: 3, label: "Upload" },
  { num: 4, label: "Render" },
  { num: 5, label: "Post" },
] as const;

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const getStepState = (stepNum: number): "active" | "completed" | "inactive" => {
    if (stepNum === currentStep) return "active";
    if (stepNum < currentStep) return "completed";
    return "inactive";
  };

  return (
    <div className="sticky top-0 z-30 bg-[#0B1012] border-b border-[#152226] px-8 py-4 shrink-0">
      <div className="flex items-start justify-center max-w-4xl mx-auto">
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
                          ? "bg-[#152226] text-[#10B981]"
                          : "border border-[#152226] text-[#6B7C85] bg-transparent"
                    }`}
                  >
                    {state === "completed" ? (
                      <Check className="w-4 h-4" strokeWidth={2.5} />
                    ) : (
                      step.num
                    )}
                  </div>
                  {!isLast && (
                    <div className="flex-1 h-px bg-[#152226] mx-2 mt-4 min-w-[16px]" />
                  )}
                </div>
                <div className="mt-2 text-center w-full px-1">
                  <span className="text-xs text-[#6B7C85] block leading-tight">
                    {step.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
