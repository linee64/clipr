"use client";

import { Film } from "lucide-react";

interface VideoQuotaBadgeProps {
  /** Renders remaining this month */
  left: number;
  /** Monthly allowance for the current plan */
  limit: number;
  /** Lifetime unlimited Pro — hide the monthly cap UI */
  unlimited?: boolean;
  /** Tighter layout for sidebars / headers */
  compact?: boolean;
  className?: string;
}

function normalize(left: number, limit: number) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
  const safeLeft = Number.isFinite(left) ? Math.max(0, Math.min(left, safeLimit)) : safeLimit;
  const used = safeLimit - safeLeft;
  const pct = safeLimit > 0 ? (safeLeft / safeLimit) * 100 : 0;
  const empty = safeLeft <= 0;
  const low = !empty && safeLeft <= 2;
  return { safeLimit, safeLeft, used, pct, empty, low };
}

/** Monthly video-render allowance — visible quota chip with a mini progress bar. */
export function VideoQuotaBadge({
  left,
  limit,
  unlimited = false,
  compact = false,
  className = "",
}: VideoQuotaBadgeProps) {
  if (unlimited) {
    const chip = (
      <span
        className={`inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border border-[#51E0CF]/25 bg-[#51E0CF]/10 px-2 py-0.5 text-[10px] font-semibold text-[#51E0CF] ${className}`}
        title="Unlimited video renders"
      >
        <Film className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">Unlimited videos</span>
      </span>
    );
    if (compact) return chip;
    return (
      <div
        className={`rounded-lg border border-[#51E0CF]/25 bg-[#51E0CF]/10 px-3 py-2.5 ${className}`}
        title="Unlimited video renders"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#EFEFEF]">
          <Film className="h-3.5 w-3.5 shrink-0 text-[#51E0CF]" aria-hidden />
          Video renders
          <span className="ml-auto text-[11px] font-bold text-[#51E0CF]">Unlimited</span>
        </span>
      </div>
    );
  }

  const { safeLimit, safeLeft, used, pct, empty, low } = normalize(left, limit);

  if (compact) {
    if (empty) {
      return (
        <span
          className={`inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border border-[#EF8B8B]/30 bg-[#EF8B8B]/10 px-2 py-0.5 text-[10px] font-semibold text-[#EF8B8B] ${className}`}
          title={`${safeLeft} of ${safeLimit} video renders left this month`}
        >
          <Film className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{safeLeft}/{safeLimit} videos</span>
        </span>
      );
    }
    if (low) {
      return (
        <span
          className={`inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 ${className}`}
          title={`${safeLeft} of ${safeLimit} video renders left this month`}
        >
          <Film className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{safeLeft}/{safeLimit} videos</span>
        </span>
      );
    }
    return (
      <span
        className={`inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border border-[#51E0CF]/25 bg-[#51E0CF]/10 px-2 py-0.5 text-[10px] font-semibold text-[#51E0CF] ${className}`}
        title={`${safeLeft} of ${safeLimit} video renders left this month`}
      >
        <Film className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">{safeLeft}/{safeLimit} videos</span>
      </span>
    );
  }

  if (empty) {
    return (
      <div
        className={`rounded-lg border border-[#EF8B8B]/30 bg-[#EF8B8B]/10 px-3 py-2.5 space-y-2 ${className}`}
        title="Monthly video render allowance"
      >
        <QuotaBody safeLeft={safeLeft} safeLimit={safeLimit} used={used} pct={pct} empty low={low} />
      </div>
    );
  }
  if (low) {
    return (
      <div
        className={`rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 space-y-2 ${className}`}
        title="Monthly video render allowance"
      >
        <QuotaBody safeLeft={safeLeft} safeLimit={safeLimit} used={used} pct={pct} empty={empty} low />
      </div>
    );
  }
  return (
    <div
      className={`rounded-lg border border-[#51E0CF]/25 bg-[#51E0CF]/10 px-3 py-2.5 space-y-2 ${className}`}
      title="Monthly video render allowance"
    >
      <QuotaBody safeLeft={safeLeft} safeLimit={safeLimit} used={used} pct={pct} empty={empty} low={low} />
    </div>
  );
}

function QuotaBody({
  safeLeft,
  safeLimit,
  used,
  pct,
  empty,
  low,
}: {
  safeLeft: number;
  safeLimit: number;
  used: number;
  pct: number;
  empty: boolean;
  low: boolean;
}) {
  const accentClass = empty ? "text-[#EF8B8B]" : low ? "text-amber-400" : "text-[#51E0CF]";
  const barClass = empty ? "bg-[#EF8B8B]" : low ? "bg-amber-400" : "bg-[#51E0CF]";

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#EFEFEF]">
          <Film className={`h-3.5 w-3.5 shrink-0 ${accentClass}`} aria-hidden />
          Video renders
        </span>
        <span className={`text-[11px] font-bold tabular-nums ${accentClass}`}>
          {safeLeft}
          <span className="font-normal text-[#6B7C85]"> / {safeLimit}</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#152226]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barClass}`}
          style={{
            width: `${pct}%`,
            boxShadow: empty ? "none" : "0 0 8px rgba(81,224,207,0.35)",
          }}
        />
      </div>
      <p className="text-[10px] text-[#6B7C85] leading-snug">
        {empty
          ? "Monthly limit reached — resets on the 1st (UTC)."
          : low
            ? `${safeLeft} render${safeLeft === 1 ? "" : "s"} left this month.`
            : `${used} used · ${safeLeft} left this month.`}
      </p>
    </>
  );
}
