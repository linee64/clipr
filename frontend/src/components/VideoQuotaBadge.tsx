"use client";

import { Film } from "lucide-react";

interface VideoQuotaBadgeProps {
  /** Renders remaining this month */
  left: number;
  /** Monthly allowance for the current plan */
  limit: number;
  /** Tighter layout for sidebars / headers */
  compact?: boolean;
  className?: string;
}

/** Monthly video-render allowance — visible quota chip with a mini progress bar. */
export function VideoQuotaBadge({
  left,
  limit,
  compact = false,
  className = "",
}: VideoQuotaBadgeProps) {
  const safeLimit = Math.max(1, limit);
  const safeLeft = Math.max(0, left);
  const used = Math.min(safeLimit, safeLimit - safeLeft);
  const pct = (safeLeft / safeLimit) * 100;
  const empty = safeLeft <= 0;
  const low = !empty && safeLeft <= 2;

  const accent = empty ? "#EF8B8B" : low ? "#F5A623" : "#10B981";
  const border = empty
    ? "border-[#EF8B8B]/30 bg-[#EF8B8B]/[0.06]"
    : low
      ? "border-[#F5A623]/30 bg-[#F5A623]/[0.06]"
      : "border-[#10B981]/25 bg-[#10B981]/[0.06]";

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${border} ${className}`}
        style={{ color: accent }}
        title={`${safeLeft} of ${safeLimit} video renders left this month`}
      >
        <Film className="h-3 w-3 shrink-0" aria-hidden />
        {safeLeft}/{safeLimit} videos
      </span>
    );
  }

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 space-y-2 ${border} ${className}`}
      title="Monthly video render allowance"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#EFEFEF]">
          <Film className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} aria-hidden />
          Video renders
        </span>
        <span className="text-[11px] font-bold tabular-nums" style={{ color: accent }}>
          {safeLeft}
          <span className="font-normal text-[#6B7C85]"> / {safeLimit}</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#152226]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: accent,
            boxShadow: empty ? "none" : `0 0 8px ${accent}66`,
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
    </div>
  );
}
