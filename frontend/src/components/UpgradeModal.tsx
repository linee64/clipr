"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import { PRO_PRICE, TRIAL_DAYS, type PlanKind } from "@/lib/plan";

// Four-point sparkle (inline so we don't depend on a specific lucide icon set).
function Spark({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2l1.7 6.6L20 10l-6.3 1.4L12 18l-1.7-6.6L4 10l6.3-1.4L12 2z" />
    </svg>
  );
}

const FEATURES = [
  "Unlimited AI video renders",
  "Every reference style & template",
  "Auto-post to X, TikTok & LinkedIn",
  "Beat-synced cuts + word-by-word captions",
  "Priority rendering",
];

interface UpgradeModalProps {
  open: boolean;
  plan: PlanKind;
  daysLeft: number;
  onClose: () => void;
  onSubscribe: () => void;
  onCancel: () => void;
  /** true while a checkout / portal redirect is in flight */
  busy?: boolean;
}

export function UpgradeModal({
  open,
  plan,
  daysLeft,
  onClose,
  onSubscribe,
  onCancel,
  busy = false,
}: UpgradeModalProps) {
  const isPro = plan === "pro";
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
              border: "1px solid rgba(16,185,129,0.4)",
              boxShadow:
                "0 0 40px rgba(16,185,129,0.14), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* soft mint atmosphere */}
            <div
              className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0) 70%)",
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
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-[#10B981]">
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

              {/* price */}
              <div className="mt-5 flex flex-wrap items-end gap-x-1.5 gap-y-1">
                <span className="text-4xl font-extrabold tracking-tight text-[#EFEFEF]">
                  {PRO_PRICE}
                </span>
                <span className="mb-1 text-sm text-[#6B7C85]">/month</span>
                {!isPro && (
                  <span className="mb-1 ml-1 rounded-full border border-[#10B981]/25 bg-[#10B981]/10 px-2 py-0.5 text-[10px] font-semibold text-[#10B981]">
                    {TRIAL_DAYS}-day free trial
                  </span>
                )}
              </div>

              {/* features */}
              <ul className="mt-5 space-y-2.5">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#EFEFEF]">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#10B981]/15">
                      <Check className="h-2.5 w-2.5 text-[#10B981]" strokeWidth={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {isPro ? (
                <div className="mt-7 space-y-1.5">
                  <button
                    onClick={onClose}
                    className="w-full rounded-xl bg-[#10B981] py-3 text-sm font-bold text-[#070B0D] hover:bg-[#12cf90] transition-colors shadow-[0_0_18px_rgba(16,185,129,0.3)]"
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
                    onClick={onSubscribe}
                    disabled={busy}
                    className="w-full rounded-xl bg-[#10B981] py-3.5 text-sm font-bold text-[#070B0D] hover:bg-[#12cf90] transition-colors shadow-[0_0_20px_rgba(16,185,129,0.35)] disabled:opacity-60"
                  >
                    {busy
                      ? "Redirecting to checkout…"
                      : `${daysLeft > 0 ? "Upgrade to Pro" : "Reactivate Pro"} · ${PRO_PRICE}/mo`}
                  </button>
                  <p className="text-center text-[11px] text-[#6B7C85]">
                    Cancel anytime{daysLeft > 0 ? " — you won't be charged until your trial ends." : "."}
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
