"use client";

import React, { useRef, useEffect, useCallback } from "react";

interface VideoItem {
  src: string;
  tag: string;
  title: string;
  desc: string;
}

interface InfiniteVideoCarouselProps {
  videos: VideoItem[];
}

/**
 * Infinite snap-scroll carousel.
 *
 * Strategy: render 5 copies of the array.  Start in the middle (set 2).
 * On every scroll frame, if we drift into set 0 or set 4, instantly
 * teleport to the equivalent offset in set 2 — with snap temporarily
 * disabled so the browser doesn't fight the jump.  Because there's
 * always ≥1 full buffer set between the user and the teleport zone,
 * the reset is completely invisible.
 */
export function InfiniteVideoCarousel({ videos }: InfiniteVideoCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const count = videos.length;
  const copies = 5;
  const expanded = Array.from({ length: copies }, () => videos).flat();
  const isResetting = useRef(false);

  // Measure the pixel width of one full set of cards (count cards + gaps)
  const getSetWidth = useCallback(() => {
    const el = scrollRef.current;
    if (!el || count === 0) return 0;
    const firstCard = el.children[0] as HTMLElement | undefined;
    const secondCard = el.children[1] as HTMLElement | undefined;
    if (!firstCard) return 0;
    const gap = secondCard
      ? secondCard.offsetLeft - (firstCard.offsetLeft + firstCard.offsetWidth)
      : 16;
    return (firstCard.offsetWidth + gap) * count;
  }, [count]);

  // On mount → jump to the start of set 2 (middle)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || count === 0) return;
    requestAnimationFrame(() => {
      const setW = getSetWidth();
      el.style.scrollBehavior = "auto";
      el.scrollLeft = setW * 2; // start of set index 2
      el.style.scrollBehavior = "";
    });
  }, [count, getSetWidth]);

  // On every scroll: if we've drifted into set 0 or set 4, teleport to set 2
  const handleScroll = useCallback(() => {
    if (isResetting.current) return;
    const el = scrollRef.current;
    if (!el || count === 0) return;

    const setW = getSetWidth();
    if (setW === 0) return;

    const left = el.scrollLeft;
    // Boundaries: set0 = [0, setW), set1 = [setW, 2*setW), set2 = [2*setW, 3*setW), ...
    // Teleport when user enters set 0 or set 4
    if (left < setW || left >= setW * 4) {
      isResetting.current = true;

      // Disable snap so the browser doesn't animate to a snap point
      const prevSnap = el.style.scrollSnapType;
      el.style.scrollSnapType = "none";
      el.style.scrollBehavior = "auto";

      // Shift by ±2 sets to land in set 2 or 3
      if (left < setW) {
        el.scrollLeft = left + setW * 2;
      } else {
        el.scrollLeft = left - setW * 2;
      }

      // Re-enable snap on next frame
      requestAnimationFrame(() => {
        el.style.scrollSnapType = prevSnap || "";
        el.style.scrollBehavior = "";
        isResetting.current = false;
      });
    }
  }, [count, getSetWidth]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="
          flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 px-4
          scrollbar-hide
        "
      >
        {expanded.map((video, idx) => (
          <div
            key={idx}
            className="
              group relative flex flex-col justify-between rounded-2xl bg-zinc-950
              border border-zinc-900 overflow-hidden hover:border-zinc-800
              transition-all duration-300 shadow-xl
              flex-shrink-0 w-[65vw] snap-center
              sm:w-[45vw]
            "
          >
            {/* Video */}
            <div className="relative aspect-[9/14] sm:aspect-[9/16] w-full overflow-hidden bg-zinc-900/50">
              <video
                src={video.src}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-60 pointer-events-none" />
              <span className="absolute top-3 left-3 text-[10px] uppercase font-mono tracking-wider font-semibold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/25 px-2.5 py-1 rounded-full backdrop-blur-md">
                {video.tag}
              </span>
            </div>

            {/* Meta */}
            <div className="p-4 sm:p-5 space-y-1.5 bg-zinc-950 z-10 border-t border-zinc-900/80">
              <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-[#10B981] transition-colors">
                {video.title}
              </h3>
              <p className="text-[11px] sm:text-xs text-zinc-400 leading-relaxed font-light">
                {video.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Swipe hint */}
      <p className="text-center text-[10px] text-zinc-600 mt-3 tracking-wide font-mono">
        ← swipe to explore →
      </p>
    </div>
  );
}
