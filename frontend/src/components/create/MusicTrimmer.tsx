"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Pause, Play, X } from "lucide-react";

interface MusicTrimmerProps {
  /** playable audio source (template track url, or object URL of an upload) */
  src: string;
  name: string;
  /** length of the segment to pick = the video duration (seconds) */
  segmentSeconds: number;
  /** current chosen start offset (seconds) */
  initialStart?: number;
  onApply: (start: number) => void;
  onClose: () => void;
}

const BUCKETS = 64;

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Decode the audio and return normalized peak heights [0..1]. Null on failure
 *  (e.g. CORS) — the trimmer then shows a neutral bar pattern but still works. */
async function computePeaks(src: string): Promise<number[] | null> {
  try {
    const resp = await fetch(src);
    const buf = await resp.arrayBuffer();
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const audio = await ctx.decodeAudioData(buf);
    const data = audio.getChannelData(0);
    const block = Math.floor(data.length / BUCKETS) || 1;
    const peaks: number[] = [];
    for (let i = 0; i < BUCKETS; i++) {
      let max = 0;
      for (let j = 0; j < block; j++) {
        const v = Math.abs(data[i * block + j] || 0);
        if (v > max) max = v;
      }
      peaks.push(max);
    }
    void ctx.close();
    const peak = Math.max(...peaks, 0.0001);
    return peaks.map((p) => Math.max(0.06, p / peak));
  } catch {
    return null;
  }
}

export function MusicTrimmer({
  src,
  name,
  segmentSeconds,
  initialStart = 0,
  onApply,
  onClose,
}: MusicTrimmerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [loadingPeaks, setLoadingPeaks] = useState(true);
  const [start, setStart] = useState(Math.max(0, initialStart));
  const [playhead, setPlayhead] = useState(0); // seconds, for the moving cursor
  const [playing, setPlaying] = useState(false);

  // segment can't be longer than the track
  const segment = duration > 0 ? Math.min(segmentSeconds, duration) : segmentSeconds;
  const maxStart = Math.max(0, duration - segment);

  useEffect(() => {
    let alive = true;
    setLoadingPeaks(true);
    computePeaks(src).then((p) => {
      if (alive) {
        setPeaks(p);
        setLoadingPeaks(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [src]);

  // clamp the chosen start once we know the duration
  useEffect(() => {
    if (duration > 0) setStart((s) => Math.min(Math.max(0, s), maxStart));
  }, [duration, maxStart]);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = start;
    setPlayhead(start);
    void a.play().catch(() => setPlaying(false));
    setPlaying(true);
  }, [start]);

  // loop playback within the chosen [start, start+segment] window
  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a) return;
    setPlayhead(a.currentTime);
    if (a.currentTime >= start + segment - 0.03) {
      a.currentTime = start;
      setPlayhead(start);
    }
  };

  // ---- dragging the segment window ----
  const dragStart = (clientX: number) => {
    const el = trackRef.current;
    if (!el || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const grabOffset = (start / duration) * rect.width; // px from left to window start
    const pointerInWindow = clientX - rect.left - grabOffset; // grab anchor inside window

    const move = (cx: number) => {
      const x = cx - rect.left - pointerInWindow;
      const frac = Math.min(1, Math.max(0, x / rect.width));
      const newStart = Math.min(maxStart, Math.max(0, frac * duration));
      setStart(newStart);
      if (playing && audioRef.current) {
        audioRef.current.currentTime = newStart;
        setPlayhead(newStart);
      }
    };
    const onMove = (e: PointerEvent) => move(e.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const winLeftPct = duration > 0 ? (start / duration) * 100 : 0;
  const winWidthPct = duration > 0 ? (segment / duration) * 100 : 100;
  const playheadPct = duration > 0 ? (playhead / duration) * 100 : 0;

  const bars = peaks ?? Array.from({ length: BUCKETS }, (_, i) => 0.35 + 0.25 * Math.sin(i));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => {
          stop();
          onClose();
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg rounded-2xl border border-[#1E343A] bg-[#0D1416] p-4 sm:p-5 shadow-[0_0_40px_rgba(0,0,0,0.6)]"
      >
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={onTimeUpdate}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#EFEFEF] truncate">{name}</h3>
            <p className="text-xs text-[#6B7C85] mt-0.5">
              Drag to pick the part of the track for your video
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stop();
              onClose();
            }}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[#6B7C85] hover:text-[#EFEFEF] hover:bg-[#152226] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* waveform + draggable window */}
        <div
          ref={trackRef}
          className="relative mt-5 h-24 w-full select-none touch-none rounded-lg bg-[#070B0D] overflow-hidden"
          onPointerDown={(e) => {
            // clicking outside the window jumps the window start there, then drags
            const rect = trackRef.current!.getBoundingClientRect();
            const frac = (e.clientX - rect.left) / rect.width;
            setStart(Math.min(maxStart, Math.max(0, frac * duration - segment / 2)));
            dragStart(e.clientX);
          }}
        >
          {/* bars */}
          <div className="absolute inset-0 flex items-center gap-[2px] px-1">
            {bars.map((h, i) => {
              const t = duration > 0 ? (i / BUCKETS) * duration : 0;
              const inWindow = t >= start && t <= start + segment;
              return (
                <span
                  key={i}
                  className={`flex-1 rounded-full transition-colors ${
                    inWindow ? "bg-[#10B981]" : "bg-[#2A3A40]"
                  }`}
                  style={{ height: `${Math.round(h * 100)}%` }}
                />
              );
            })}
          </div>

          {loadingPeaks && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#070B0D]/60">
              <Loader2 className="w-5 h-5 text-[#10B981] animate-spin" />
            </div>
          )}

          {/* draggable selection window */}
          {duration > 0 && (
            <div
              className="absolute top-0 bottom-0 rounded-lg border-2 border-[#10B981] bg-[#10B981]/10 cursor-grab active:cursor-grabbing"
              style={{ left: `${winLeftPct}%`, width: `${winWidthPct}%` }}
              onPointerDown={(e) => {
                e.stopPropagation();
                dragStart(e.clientX);
              }}
            >
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-medium text-[#10B981] whitespace-nowrap pointer-events-none">
                ⟷ drag
              </span>
            </div>
          )}

          {/* playhead */}
          {playing && (
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-white/80 pointer-events-none"
              style={{ left: `${playheadPct}%` }}
            />
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-[#6B7C85]">
          <span>
            From <span className="text-[#10B981] font-medium">{fmt(start)}</span> ·{" "}
            {Math.round(segment)}s
          </span>
          <span>{duration > 0 ? fmt(duration) : "—"} total</span>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => (playing ? stop() : play())}
            disabled={duration <= 0}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#152226] text-[#EFEFEF] text-sm font-medium hover:bg-[#1d2f34] transition-colors disabled:opacity-50"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {playing ? "Pause" : "Preview"}
          </button>
          <button
            type="button"
            onClick={() => {
              stop();
              onApply(Math.round(start * 10) / 10);
              onClose();
            }}
            className="flex-1 py-2.5 rounded-lg bg-[#10B981] text-white text-sm font-medium hover:bg-[#12cf90] transition-colors"
          >
            Use this part
          </button>
        </div>
      </motion.div>
    </div>
  );
}
