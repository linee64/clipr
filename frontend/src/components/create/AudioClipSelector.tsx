"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export interface ClipSelection {
  startTime: number;
  endTime: number;
  startPercent: number;
  endPercent: number;
}

interface AudioClipSelectorProps {
  /** the audio the user already chose */
  audioFile: File;
  /** fires whenever the selected region settles (on release) and once on load */
  onSelectionChange?: (sel: ClipSelection) => void;
  /** initial selection length as a fraction of the whole track */
  initialFraction?: number;
  /** waveform height in px */
  height?: number;
}

const BAR_W = 3;
const BAR_GAP = 2;
const GRADIENT = "linear-gradient(95deg,#FFC83D 0%,#FF7A45 34%,#FF4D8D 68%,#B14BFF 100%)";

function roundedBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = Math.min(w / 2, h / 2);
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }
}

type DragMode = "move" | "left" | "right";

export function AudioClipSelector({
  audioFile,
  onSelectionChange,
  initialFraction = 0.3,
  height = 128,
}: AudioClipSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const rawRef = useRef<Float32Array | null>(null);
  const durationRef = useRef(0);
  const widthRef = useRef(0);
  const selRef = useRef({ start: 0, end: initialFraction });
  const draggingRef = useRef(false);
  const dragRef = useRef<{ mode: DragMode; x: number; s0: number; e0: number } | null>(null);
  const onChangeRef = useRef(onSelectionChange);
  onChangeRef.current = onSelectionChange;

  const [duration, setDuration] = useState(0);
  const [width, setWidth] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sel, setSel] = useState({ start: 0, end: initialFraction });
  const [playhead, setPlayhead] = useState(0); // 0..1
  const [src, setSrc] = useState("");

  selRef.current = sel;
  durationRef.current = duration;
  widthRef.current = width;

  // ---- decode the file into peak data (local File -> no CORS) ----
  useEffect(() => {
    let alive = true;
    setReady(false);
    setFailed(false);
    rawRef.current = null;
    (async () => {
      try {
        const buf = await audioFile.arrayBuffer();
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const decoded = await ctx.decodeAudioData(buf);
        void ctx.close();
        if (!alive) return;
        rawRef.current = decoded.getChannelData(0);
        setDuration(decoded.duration || 0);
        setReady(true);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [audioFile]);

  // ---- playable object URL for preview ----
  useEffect(() => {
    const url = URL.createObjectURL(audioFile);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  // ---- responsive width ----
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const barCount = Math.max(16, Math.floor(width / (BAR_W + BAR_GAP)));

  // peaks downsampled to the number of bars that fit
  const peaks = useMemo(() => {
    const raw = rawRef.current;
    if (!ready || !raw || barCount <= 0) return null;
    const block = Math.max(1, Math.floor(raw.length / barCount));
    const stride = Math.max(1, Math.floor(block / 160));
    const out = new Array<number>(barCount);
    let max = 0;
    for (let i = 0; i < barCount; i++) {
      const base = i * block;
      let peak = 0;
      for (let j = 0; j < block; j += stride) {
        const v = Math.abs(raw[base + j] || 0);
        if (v > peak) peak = v;
      }
      out[i] = peak;
      if (peak > max) max = peak;
    }
    const norm = max || 1;
    return out.map((v) => Math.max(0.05, (v / norm) ** 0.82));
  }, [ready, barCount]);

  // ---- draw the waveform (bright inside the selection, dim outside) ----
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !peaks || width <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    cvs.width = Math.round(width * dpr);
    cvs.height = Math.round(height * dpr);
    cvs.style.width = `${width}px`;
    cvs.style.height = `${height}px`;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const n = peaks.length;
    const slot = width / n;
    const mid = height / 2;
    for (let i = 0; i < n; i++) {
      const frac = (i + 0.5) / n;
      const inside = frac >= sel.start && frac <= sel.end;
      const h = Math.max(3, peaks[i] * height * 0.84);
      const x = i * slot + (slot - BAR_W) / 2;
      ctx.fillStyle = inside ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.15)";
      roundedBar(ctx, x, mid - h / 2, BAR_W, h);
    }
  }, [peaks, sel.start, sel.end, width, height]);

  const emit = useCallback((start: number, end: number) => {
    const d = durationRef.current;
    onChangeRef.current?.({
      startTime: start * d,
      endTime: end * d,
      startPercent: start,
      endPercent: end,
    });
  }, []);

  // emit the initial region once the track length is known
  useEffect(() => {
    if (ready && duration > 0) emit(selRef.current.start, selRef.current.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, duration]);

  // ---- preview playback: loop the region while dragging, play it through on release ----
  const onTimeUpdate = () => {
    const a = audioElRef.current;
    const d = durationRef.current;
    if (!a || !d) return;
    const { start, end } = selRef.current;
    setPlayhead(a.currentTime / d);
    // loop within the selected region (Instagram-style continuous preview)
    if (a.currentTime >= end * d - 0.015 || a.currentTime < start * d - 0.05) {
      a.currentTime = start * d;
    }
  };

  const previewFrom = (frac: number) => {
    const a = audioElRef.current;
    const d = durationRef.current;
    if (!a || !d) return;
    a.currentTime = Math.max(0, frac * d);
    void a.play().catch(() => {});
  };

  // ---- drag (pointer events cover mouse + touch) ----
  const beginDrag = useCallback(
    (mode: DragMode, clientX: number) => {
      const s = selRef.current;
      dragRef.current = { mode, x: clientX, s0: s.start, e0: s.end };
      draggingRef.current = true;
      // moving/resizing MUTES the preview (no scrubbing / speed-up) — it resumes on release
      audioElRef.current?.pause();

      const move = (cx: number) => {
        const d = dragRef.current;
        const W = widthRef.current;
        if (!d || !W) return;
        const delta = (cx - d.x) / W;
        const mw = duration > 0 ? Math.min(0.5, Math.max(0.04, 1 / duration)) : 0.06;
        let start = d.s0;
        let end = d.e0;
        if (d.mode === "left") {
          start = Math.min(Math.max(0, d.s0 + delta), d.e0 - mw);
        } else if (d.mode === "right") {
          end = Math.max(Math.min(1, d.e0 + delta), d.s0 + mw);
        } else {
          const w = d.e0 - d.s0;
          start = Math.min(Math.max(0, d.s0 + delta), 1 - w);
          end = start + w;
        }
        selRef.current = { start, end };
        setSel({ start, end });
        // keep the cursor pinned to the edge being dragged; audio stays paused
        setPlayhead(d.mode === "right" ? end : start);
      };
      const onMove = (e: PointerEvent) => {
        e.preventDefault();
        move(e.clientX);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        draggingRef.current = false;
        dragRef.current = null;
        const cur = selRef.current;
        emit(cur.start, cur.end);
        // released -> music plays again, looping the selected region
        previewFrom(cur.start);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [duration, emit],
  );

  const leftPx = sel.start * width;
  const widthPx = Math.max(0, (sel.end - sel.start) * width);

  return (
    <div className="w-full select-none" style={{ touchAction: "none" }}>
      <audio
        ref={audioElRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          if (!durationRef.current) setDuration(e.currentTarget.duration || 0);
        }}
        onTimeUpdate={onTimeUpdate}
        onEnded={() => setPlayhead(selRef.current.start)}
        className="hidden"
      />

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-2xl"
        style={{ height, background: "#1C1C1C" }}
      >
        {/* waveform */}
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* loading shimmer */}
        {!ready && !failed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-end gap-[3px] h-10 opacity-60">
              {Array.from({ length: 14 }).map((_, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-white/30"
                  style={{
                    height: `${30 + ((i * 37) % 70)}%`,
                    animation: "acs-pulse 1s ease-in-out infinite",
                    animationDelay: `${i * 0.06}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-white/40">Couldn&apos;t read this audio file.</p>
          </div>
        )}

        {/* playhead */}
        {ready && (
          <div
            className="absolute top-2 bottom-2 w-px bg-white/70 pointer-events-none"
            style={{ left: `${playhead * 100}%`, opacity: draggingRef.current ? 1 : 0.5 }}
          />
        )}

        {/* selection window */}
        {ready && width > 0 && (
          <div
            className="absolute top-0 bottom-0 cursor-grab active:cursor-grabbing"
            style={{
              left: leftPx,
              width: widthPx,
              borderRadius: 16,
              boxShadow: "0 0 18px 1px rgba(255,77,141,0.35), 0 0 32px 4px rgba(177,75,255,0.18)",
              touchAction: "none",
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              beginDrag("move", e.clientX);
            }}
          >
            {/* gradient frame (border only — interior shows the bright bars through it) */}
            <div
              className="absolute inset-0"
              style={{
                borderRadius: 16,
                padding: 2.5,
                background: GRADIENT,
                WebkitMask:
                  "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
                pointerEvents: "none",
              }}
            />

            {/* left handle */}
            <div
              className="absolute left-0 top-0 bottom-0 flex items-center justify-center w-10 sm:w-[22px]"
              style={{ transform: "translateX(-50%)", cursor: "ew-resize", touchAction: "none" }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                beginDrag("left", e.clientX);
              }}
            >
              <span
                className="rounded-full"
                style={{ width: 5, height: "44%", background: GRADIENT, boxShadow: "0 0 8px rgba(255,120,80,0.6)" }}
              />
            </div>

            {/* right handle */}
            <div
              className="absolute right-0 top-0 bottom-0 flex items-center justify-center w-10 sm:w-[22px]"
              style={{ transform: "translateX(50%)", cursor: "ew-resize", touchAction: "none" }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                beginDrag("right", e.clientX);
              }}
            >
              <span
                className="rounded-full"
                style={{ width: 5, height: "44%", background: GRADIENT, boxShadow: "0 0 8px rgba(177,75,255,0.6)" }}
              />
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes acs-pulse{0%,100%{transform:scaleY(0.5);opacity:0.4}50%{transform:scaleY(1);opacity:0.9}}`}</style>
    </div>
  );
}

export default AudioClipSelector;
