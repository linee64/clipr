"use client";

import { Check } from "lucide-react";
import { motion } from "framer-motion";

export type FlowStep = 1 | 2 | 3 | 4 | 5 | 6;

interface StepIndicatorProps {
  currentStep: FlowStep;
}

const STEPS = [
  { num: 1, label: "Idea" },
  { num: 2, label: "Storyboard" },
  { num: 3, label: "Upload" },
  { num: 4, label: "Style" },
  { num: 5, label: "Render" },
  { num: 6, label: "Post" },
] as const;

const MONO =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

type StepState = "completed" | "active" | "inactive";

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const getStepState = (stepNum: number): StepState => {
    if (stepNum === currentStep) return "active";
    if (stepNum < currentStep) return "completed";
    return "inactive";
  };

  // Equal 6-column grid => each dot sits at the horizontal center of its own
  // cell, i.e. at 1/12, 3/12 ... 11/12 of the track. So the rail spans the
  // middle 10/12 of the width (first dot center -> last dot center), and the
  // mint fill covers the (currentStep - 1) of 5 segments already crossed — its
  // right edge lands exactly on the active dot's center.
  const progress = (currentStep - 1) / (STEPS.length - 1); // 0 .. 1

  return (
    <div className="shrink-0 border-b border-[#152226]/80 bg-zinc-950/45 backdrop-blur-md px-8 py-5 shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
      <div className="relative mx-auto max-w-2xl">
        {/* ---- Rail overlay ---- */}
        <div
          className="pointer-events-none absolute inset-x-[8.3333%] top-0 flex h-7 items-center"
          aria-hidden
        >
          <div className="relative h-[2px] w-full bg-[#152226]">
            {/* mint progress fill — the single purposeful animation */}
            <motion.div
              className="absolute inset-y-0 left-0 bg-[#10B981]"
              style={{ boxShadow: "0 0 14px rgba(16,185,129,0.65)" }}
              initial={false}
              animate={{ width: `${progress * 100}%` }}
              transition={{ type: "spring", stiffness: 180, damping: 28 }}
            />
          </div>
        </div>

        {/* ---- Step cells ---- */}
        <div className="relative grid grid-cols-6">
          {STEPS.map((step) => {
            const state = getStepState(step.num);
            return (
              <div key={step.num} className="flex min-w-0 flex-col items-center group">
                {/* fixed-height dot row keeps the rail centered + height steady */}
                <div className="flex h-7 items-center justify-center">
                  <Dot state={state} num={step.num} />
                </div>

                {/* single-line label — truncates instead of wrapping */}
                <span
                  className="mt-3 block max-w-full truncate px-1 text-[10px] uppercase font-bold tracking-[0.15em] transition-all duration-300"
                  style={{
                    fontFamily: MONO,
                    color:
                      state === "active"
                        ? "#10B981"
                        : state === "completed"
                          ? "#A3B3BC"
                          : "#53656F",
                    textShadow: state === "active" ? "0 0 8px rgba(16,185,129,0.25)" : "none",
                  }}
                  title={step.label}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Dot({ state, num }: { state: StepState; num: number }) {
  if (state === "completed") {
    return (
      <div 
        className="relative z-10 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-[#10B981] text-[#070B0D] shadow-[0_0_10px_rgba(16,185,129,0.4)]"
        style={{ width: "22px", height: "22px" }}
      >
        <Check className="h-3 w-3" strokeWidth={3.5} />
      </div>
    );
  }

  if (state === "active") {
    return (
      <div className="relative z-10 flex h-8 w-8 items-center justify-center">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            border: "2.5px solid #10B981",
            boxShadow: "0 0 16px rgba(16,185,129,0.35)",
          }}
          initial={false}
          animate={{ scale: [0.85, 1.1, 0.85], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut" }}
        />
        <span
          className="relative h-3 w-3 rounded-full bg-[#10B981]"
          style={{ boxShadow: "0 0 14px rgba(0,229,160,0.7)" }}
        />
      </div>
    );
  }

  // inactive
  return (
    <div
      className="relative z-10 flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[#070B0D] border-2 border-[#152226] group-hover:border-[#53656F]/50 transition-colors duration-200"
    >
      <span
        className="text-[9px] font-bold leading-none"
        style={{ fontFamily: MONO, color: "#53656F" }}
      >
        {num}
      </span>
    </div>
  );
}
