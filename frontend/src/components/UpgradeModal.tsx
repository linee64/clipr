"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { PRO_PRICE_1M, PRO_PRICE_3M, PRO_PRICE_6M, type PlanKind } from "@/lib/plan";

// Four-point sparkle (inline so we don't depend on a specific lucide icon set).
function Spark({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2l1.7 6.6L20 10l-6.3 1.4L12 18l-1.7-6.6L4 10l6.3-1.4L12 2z" />
    </svg>
  );
}

interface UpgradeModalProps {
  open: boolean;
  plan: PlanKind;
  daysLeft: number;
  onClose: () => void;
  onSubscribe: (planType: "1_month" | "3_months" | "6_months") => void;
  onCancel: () => void;
  /** true while a checkout / portal redirect is in flight */
  busy?: boolean;
  defaultSelectedPlan?: "1_month" | "3_months" | "6_months";
}

export function UpgradeModal({
  open,
  plan,
  daysLeft,
  onClose,
  onSubscribe,
  onCancel,
  busy = false,
  defaultSelectedPlan,
}: UpgradeModalProps) {
  const isPro = plan === "pro";
  const [selectedPlan, setSelectedPlan] = useState<"1_month" | "3_months" | "6_months">("3_months");

  useEffect(() => {
    if (open && defaultSelectedPlan) {
      setSelectedPlan(defaultSelectedPlan);
    }
  }, [open, defaultSelectedPlan]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-[8px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative z-10 w-full max-w-[440px] overflow-hidden rounded-[22px] border p-7 sm:p-8 shadow-2xl"
            style={{
              background: "rgba(13, 20, 22, 0.97)",
              backdropFilter: "blur(18px)",
              border: "1px solid rgba(81,224,207,0.4)",
              boxShadow:
                "0 0 40px rgba(81,224,207,0.14), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* soft mint atmosphere */}
            <div
              className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(81,224,207,0.18) 0%, rgba(81,224,207,0) 70%)",
              }}
            />

            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-5 right-5 text-[#6B7C85] hover:text-[#EFEFEF] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#51E0CF]/30 bg-[#51E0CF]/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-[#51E0CF]">
                <Spark className="h-3 w-3" /> Clipr Pro
              </div>

              {isPro ? (
                <>
                  <h2 className="mt-4 text-2xl font-bold tracking-tight text-[#EFEFEF]">
                    You&apos;re on Pro
                  </h2>
                  <p className="mt-1.5 text-sm text-[#6B7C85]">
                    Everything&apos;s unlocked. Thanks for backing Clipr.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-4 text-2xl font-bold tracking-tight text-[#EFEFEF]">
                    Unlock the full studio
                  </h2>
                  <p className="mt-1.5 text-sm text-[#6B7C85]">
                    {daysLeft > 0
                      ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left on your free trial.`
                      : "Your free trial has ended."}
                  </p>
                </>
              )}

              {/* price / plan selection */}
              {!isPro && (
                <div className="mt-5 space-y-2">
                  <button
                    onClick={() => setSelectedPlan("1_month")}
                    className={`w-full flex items-center justify-between rounded-xl border p-3 ${selectedPlan === "1_month" ? "border-[#51E0CF] bg-[#51E0CF]/10" : "border-zinc-800 bg-zinc-900/50"}`}
                  >
                    <div className="text-left">
                      <div className="text-sm font-bold text-white">1-Month Pro</div>
                      <div className="text-xs text-zinc-500 mt-0.5">10 videos, 10 regens/mo</div>
                    </div>
                    <div className="text-right flex items-baseline justify-end gap-1">
                      <div className="text-lg font-bold text-white">{PRO_PRICE_1M}</div>
                      <div className="text-xs text-zinc-500">/mo</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedPlan("3_months")}
                    className={`w-full flex items-center justify-between rounded-xl border p-3 ${selectedPlan === "3_months" ? "border-[#51E0CF] bg-[#51E0CF]/10" : "border-zinc-800 bg-zinc-900/50"}`}
                  >
                    <div className="text-left flex flex-col items-start">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-white">3-Month Pro</div>
                        <span className="bg-[#51E0CF] text-zinc-950 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">Save 38%</span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">20 videos, unlimited regens</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{PRO_PRICE_3M}</div>
                      <div className="text-xs text-zinc-500 line-through">$20.97</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedPlan("6_months")}
                    className={`w-full flex items-center justify-between rounded-xl border p-3 ${selectedPlan === "6_months" ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-800 bg-zinc-900/50"}`}
                  >
                    <div className="text-left">
                      <div className="text-sm font-bold text-white">6-Month Pro</div>
                      <div className="text-xs text-zinc-500 mt-0.5">50 videos, priority queue</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{PRO_PRICE_6M}</div>
                      <div className="text-xs text-zinc-500">~$5.83/mo</div>
                    </div>
                  </button>
                </div>
              )}

              {/* CTA */}
              {isPro ? (
                <div className="mt-7 space-y-1.5">
                  <button
                    onClick={onClose}
                    className="w-full rounded-xl bg-[#51E0CF] py-3 text-sm font-bold text-[#070B0D] hover:bg-[#43cdbd] transition-colors shadow-[0_0_18px_rgba(81,224,207,0.3)]"
                  >
                    Back to studio
                  </button>
                  <button
                    onClick={onCancel}
                    disabled={busy}
                    className="w-full py-1.5 text-center text-xs text-[#6B7C85] hover:text-[#EF8B8B] transition-colors disabled:opacity-50"
                  >
                    {busy ? "Opening billing…" : "Cancel subscription"}
                  </button>
                </div>
              ) : (
                <div className="mt-7 space-y-2.5">
                  <button
                    onClick={() => onSubscribe(selectedPlan)}
                    disabled={busy}
                    className={`w-full rounded-xl py-3.5 text-sm font-bold text-white transition-colors shadow-lg disabled:opacity-60 ${selectedPlan === "6_months" ? "bg-indigo-500 hover:bg-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.35)]" : "bg-[#51E0CF] hover:bg-[#43cdbd] text-[#070B0D] shadow-[0_0_20px_rgba(81,224,207,0.35)]"}`}
                  >
                    {busy
                      ? "Redirecting to checkout…"
                      : selectedPlan === "3_months" && daysLeft > 0
                        ? "Start Free Trial"
                        : "Upgrade to Pro"}
                  </button>
                  <p className="text-center text-[11px] text-[#6B7C85]">
                    Cancel anytime{selectedPlan === "3_months" && daysLeft > 0 ? " — you won't be charged until your trial ends." : "."}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
