"use client";

import React from "react";
import { motion } from "framer-motion";
import { Check, ChevronLeft, X } from "lucide-react";
import type { RenderStatus } from "@/lib/types";
import type { FlowStep } from "./StepIndicator";
import {
  resolveBackendUrl,
  getTwitterStatus,
  startTwitterConnect,
  postToTwitter,
  X_ENABLED,
  type TwitterStatus,
  type TwitterPostResult,
  getLinkedInStatus,
  startLinkedInConnect,
  postToLinkedIn,
  LINKEDIN_ENABLED,
  type LinkedInStatus,
  type LinkedInPostResult,
  getInstagramStatus,
  startInstagramConnect,
  postToInstagram,
  INSTAGRAM_ENABLED,
  type InstagramStatus,
  type InstagramPostResult,
} from "@/lib/api";

// X (Twitter) wordmark — the stylised "X".
function XLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

// LinkedIn "in" mark.
function LinkedInLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

// Instagram Reels mark.
function InstagramLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id="ig-logo-grad" x1="0" y1="24" x2="24" y2="0">
          <stop offset="0%" stopColor="#FFDC80" />
          <stop offset="50%" stopColor="#E1306C" />
          <stop offset="100%" stopColor="#833AB4" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-logo-grad)" />
      <rect x="4" y="4" width="16" height="16" rx="4.5" stroke="white" strokeWidth="2" fill="none" />
      <circle cx="12" cy="12" r="3.5" stroke="white" strokeWidth="2" fill="none" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="white" />
    </svg>
  );
}

// Quick "go back to edit" jumps shown on the download / error screens.
const BACK_TARGETS: { label: string; step: FlowStep }[] = [
  { label: "Subtitles", step: 2 },
  { label: "Clips & music", step: 3 },
  { label: "Reference", step: 4 },
];

function progressLabel(progress: number): string {
  if (progress < 15) return "Analyzing the beat...";
  if (progress < 45) return "Cutting your beat-synced montage...";
  if (progress < 62) return "Stitching the cuts together...";
  if (progress < 75) return "Mixing in your music...";
  if (progress < 95) return "Burning word-by-word captions...";
  return "Uploading final video...";
}

interface RenderStepProps {
  renderStatus: RenderStatus | null;
  renderError: string | null;
  isRendering: boolean;
  onRetry: () => void;
  onSchedulePost: () => void;
  onJumpTo?: (step: FlowStep) => void;
  videoTitle?: string;
  platform?: string;
  caption?: string;
}

export function RenderStep({
  renderStatus,
  renderError,
  onRetry,
  onJumpTo,
  videoTitle,
  platform,
  caption,
}: RenderStepProps) {
  const status = renderStatus?.status;
  const isDone = status === "done";
  const isError = status === "error" || !!renderError;
  const progress = renderStatus?.progress ?? 0;
  // Before the backend job exists (clips still uploading), renderStatus is null —
  // show an explicit upload phase so the screen is never blank.
  const phaseLabel = renderStatus ? progressLabel(progress) : "Uploading your clips...";

  const title = videoTitle?.trim() || "Your Clipr video";
  const captionText = caption?.trim() || renderStatus?.description?.trim() || title;

  // Cycling NLE operation labels during render
  const opLabels = ["✂️ Cutting", "🎬 Splicing", "🎨 Color grading", "🔊 Syncing audio", "📐 Framing", "✨ Adding effects"];
  const [opIdx, setOpIdx] = React.useState(0);
  React.useEffect(() => {
    if (isDone || isError) return;
    const id = setInterval(() => setOpIdx((i) => (i + 1) % opLabels.length), 2500);
    return () => clearInterval(id);
  }, [isDone, isError, opLabels.length]);

  // X (Twitter) auto-post state. We check the connection once the render lands so
  // the button can offer "Connect X" vs "Post to X" without an extra click.
  const [xStatus, setXStatus] = React.useState<TwitterStatus | null>(null);
  const [posting, setPosting] = React.useState(false);
  const [postResult, setPostResult] = React.useState<TwitterPostResult | null>(null);
  const [postError, setPostError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isDone || !X_ENABLED) return;
    let alive = true;
    getTwitterStatus()
      .then((s) => alive && setXStatus(s))
      .catch(() => alive && setXStatus({ connected: false }));
    return () => {
      alive = false;
    };
  }, [isDone]);

  const handlePostToX = async () => {
    const url = renderStatus?.output_url;
    if (!url) return;
    setPosting(true);
    setPostError(null);
    try {
      const result = await postToTwitter({ output_url: url, caption: captionText });
      setPostResult(result);
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Couldn't post to X. Try again.");
    } finally {
      setPosting(false);
    }
  };

  // LinkedIn auto-post state (parallels X).
  const [liStatus, setLiStatus] = React.useState<LinkedInStatus | null>(null);
  const [liPosting, setLiPosting] = React.useState(false);
  const [liPostResult, setLiPostResult] = React.useState<LinkedInPostResult | null>(null);
  const [liPostError, setLiPostError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isDone || !LINKEDIN_ENABLED) return;
    let alive = true;
    getLinkedInStatus()
      .then((s) => alive && setLiStatus(s))
      .catch(() => alive && setLiStatus({ connected: false }));
    return () => {
      alive = false;
    };
  }, [isDone]);

  const handlePostToLinkedIn = async () => {
    const url = renderStatus?.output_url;
    if (!url) return;
    setLiPosting(true);
    setLiPostError(null);
    try {
      const result = await postToLinkedIn({ output_url: url, caption: captionText });
      setLiPostResult(result);
    } catch (e) {
      setLiPostError(e instanceof Error ? e.message : "Couldn't post to LinkedIn. Try again.");
    } finally {
      setLiPosting(false);
    }
  };

  // Instagram Reels auto-post state (parallels X / LinkedIn).
  const [igStatus, setIgStatus] = React.useState<InstagramStatus | null>(null);
  const [igPosting, setIgPosting] = React.useState(false);
  const [igPostResult, setIgPostResult] = React.useState<InstagramPostResult | null>(null);
  const [igPostError, setIgPostError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isDone || !INSTAGRAM_ENABLED) return;
    let alive = true;
    getInstagramStatus()
      .then((s) => alive && setIgStatus(s))
      .catch(() => alive && setIgStatus({ connected: false }));
    return () => {
      alive = false;
    };
  }, [isDone]);

  const handlePostToInstagram = async () => {
    const url = renderStatus?.output_url;
    if (!url) return;
    setIgPosting(true);
    setIgPostError(null);
    try {
      const result = await postToInstagram({ output_url: url, caption: captionText });
      setIgPostResult(result);
    } catch (e) {
      setIgPostError(e instanceof Error ? e.message : "Couldn't post to Instagram. Try again.");
    } finally {
      setIgPosting(false);
    }
  };

  return (
    <div className="w-full p-4 sm:p-6">
      {onJumpTo && (isDone || isError) && (
        <div className={`${isDone ? "max-w-4xl" : "max-w-lg"} mx-auto mb-4 flex flex-wrap items-center gap-2`}>
          <span className="text-[11px] uppercase tracking-wider font-mono text-[#6B7C85] mr-1">
            Go back to edit
          </span>
          {BACK_TARGETS.map((b) => (
            <button
              key={b.step}
              type="button"
              onClick={() => onJumpTo(b.step)}
              className="inline-flex items-center gap-1 rounded-full border border-[#152226] bg-[#0D1416] px-3 py-1.5 text-xs text-[#6B7C85] hover:text-[#10B981] hover:border-[#10B981]/40 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {b.label}
            </button>
          ))}
        </div>
      )}
      <div className={`${isDone ? "max-w-4xl" : "max-w-2xl"} mx-auto`}>
        {!isDone && !isError && (
          <div className="bg-[#0D1416] border border-[#152226] rounded-xl p-5 sm:p-8">
            {(() => {
              const pct = Math.max(0, Math.min(100, progress));

              /* ── NLE clip track data ─────────────────────────── */
              const clipTracks = [
                { label: "V1", clips: [
                  { start: 0, w: 18, color: "#10B981", delay: 0 },
                  { start: 20, w: 14, color: "#14B8A6", delay: 0.15 },
                  { start: 36, w: 22, color: "#10B981", delay: 0.25 },
                  { start: 60, w: 16, color: "#059669", delay: 0.4 },
                  { start: 78, w: 22, color: "#10B981", delay: 0.5 },
                ]},
                { label: "V2", clips: [
                  { start: 4, w: 12, color: "#06B6D4", delay: 0.1 },
                  { start: 26, w: 20, color: "#0891B2", delay: 0.3 },
                  { start: 52, w: 18, color: "#06B6D4", delay: 0.45 },
                  { start: 72, w: 28, color: "#0E7490", delay: 0.55 },
                ]},
                { label: "V3", clips: [
                  { start: 0, w: 30, color: "#8B5CF6", delay: 0.2 },
                  { start: 34, w: 24, color: "#7C3AED", delay: 0.35 },
                  { start: 62, w: 38, color: "#8B5CF6", delay: 0.5 },
                ]},
              ];

              /* ── Audio waveform (36 bars) ────────────────────── */
              const waveBars = Array.from({ length: 36 }, (_, i) => {
                const x = (i / 35);
                return 0.2 + 0.8 * Math.abs(Math.sin(x * Math.PI * 3.5 + 1.2) * Math.cos(x * Math.PI * 2.1));
              });

              /* ── Cut markers ────────────────────────────────── */
              const cutPositions = [18, 36, 52, 60, 78];

              /* ── Timeline ruler ticks ────────────────────────── */
              const rulerTicks = Array.from({ length: 11 }, (_, i) => i * 10);

              /* ── Cycling operation labels ────────────────────── */
              const currentOpLabel = opLabels[opIdx];

              return (
                <div className="relative flex flex-col items-center text-center px-1 sm:px-4 py-2">
                  {/* atmospheric glow */}
                  <div
                    className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
                    style={{ background: "radial-gradient(ellipse, rgba(16,185,129,0.07) 0%, rgba(6,182,212,0.04) 40%, transparent 70%)" }}
                  />

                  {/* ── NLE WINDOW CHROME ───────────────────────── */}
                  <div
                    className="relative w-full max-w-[520px] rounded-xl overflow-hidden border"
                    style={{ borderColor: "#1E2D32", background: "#080E10", boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 30px rgba(16,185,129,0.06)" }}
                  >
                    {/* Title bar */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "#152226", background: "#0A1214" }}>
                      <div className="flex gap-1.5">
                        <span className="w-[9px] h-[9px] rounded-full bg-[#EF4444]/80" />
                        <span className="w-[9px] h-[9px] rounded-full bg-[#F59E0B]/80" />
                        <span className="w-[9px] h-[9px] rounded-full bg-[#10B981]/80" />
                      </div>
                      <span className="text-[9px] font-mono text-[#3A4A50] ml-2">Clipr Timeline — {title}</span>
                      <div className="ml-auto flex items-center gap-1.5">
                        <motion.span
                          className="w-1.5 h-1.5 rounded-full bg-[#10B981]"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                        />
                        <span className="text-[8px] font-mono text-[#10B981]">RENDERING</span>
                      </div>
                    </div>

                    {/* ── Preview strip (mini) ─────────────────── */}
                    <div className="px-3 pt-3 pb-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[8px] font-mono text-[#3A4A50] uppercase tracking-wider">Preview</span>
                        <motion.span
                          key={opIdx}
                          className="text-[8px] font-mono text-[#10B981]/70"
                          animate={{ opacity: [0, 1, 1, 0] }}
                          transition={{ duration: 2.5, repeat: 0, times: [0, 0.1, 0.85, 1] }}
                        >
                          {currentOpLabel}
                        </motion.span>
                      </div>
                      {/* Mini preview frames */}
                      <div className="flex gap-[2px] h-[32px] overflow-hidden rounded-md">
                        {Array.from({ length: 16 }, (_, i) => (
                          <motion.div
                            key={i}
                            className="flex-1 rounded-[2px]"
                            style={{
                              background: `linear-gradient(${135 + i * 15}deg, ${
                                i % 3 === 0 ? "rgba(16,185,129,0.3)" : i % 3 === 1 ? "rgba(6,182,212,0.25)" : "rgba(139,92,246,0.25)"
                              } 0%, rgba(8,14,16,0.9) 80%)`,
                            }}
                            animate={{
                              opacity: i / 16 * 100 < pct ? [0.5, 1, 0.8] : [0.15, 0.25, 0.15],
                            }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.06 }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* ── RULER ─────────────────────────────────── */}
                    <div className="relative mx-3 mt-2 h-4 border-b" style={{ borderColor: "#152226" }}>
                      {rulerTicks.map((t) => (
                        <div key={t} className="absolute top-0 flex flex-col items-center" style={{ left: `${t}%` }}>
                          <div className="w-px h-2" style={{ background: t % 20 === 0 ? "#3A4A50" : "#1E2D32" }} />
                          {t % 20 === 0 && (
                            <span className="text-[7px] font-mono text-[#3A4A50] mt-0.5 leading-none">
                              {`${Math.floor(t * 0.3 / 60)}:${String(Math.floor((t * 0.3) % 60)).padStart(2, "0")}`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* ── TRACKS ────────────────────────────────── */}
                    <div className="relative mx-3 mt-1 space-y-[3px]">
                      {clipTracks.map((track, ti) => (
                        <div key={track.label} className="relative flex items-center gap-1.5">
                          {/* Track label */}
                          <span
                            className="text-[8px] font-mono font-bold shrink-0 w-5 text-right"
                            style={{ color: ti === 0 ? "#10B981" : ti === 1 ? "#06B6D4" : "#8B5CF6" }}
                          >
                            {track.label}
                          </span>
                          {/* Track lane */}
                          <div className="relative flex-1 h-[22px] rounded-[3px] overflow-hidden" style={{ background: "#0B1315" }}>
                            {track.clips.map((clip, ci) => (
                              <motion.div
                                key={ci}
                                className="absolute top-[2px] bottom-[2px] rounded-[3px] overflow-hidden"
                                style={{
                                  left: `${clip.start}%`,
                                  width: `${clip.w}%`,
                                  background: `linear-gradient(90deg, ${clip.color}55 0%, ${clip.color}33 50%, ${clip.color}55 100%)`,
                                  borderLeft: `2px solid ${clip.color}`,
                                  borderRight: `1px solid ${clip.color}44`,
                                }}
                                initial={{ scaleX: 0, opacity: 0 }}
                                animate={{ scaleX: 1, opacity: 1 }}
                                transition={{
                                  duration: 0.6,
                                  delay: clip.delay + 0.3,
                                  ease: [0.22, 1, 0.36, 1],
                                }}
                              >
                                {/* Inner thumbnail-like shimmer */}
                                <motion.div
                                  className="absolute inset-0"
                                  style={{
                                    background: `repeating-linear-gradient(90deg, transparent 0px, ${clip.color}18 2px, transparent 4px)`,
                                  }}
                                  animate={{ x: ["-100%", "100%"] }}
                                  transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: ci * 0.4 }}
                                />
                                {/* Clip label */}
                                {clip.w > 15 && (
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[7px] font-mono text-white/50 tracking-wide">
                                    clip_{ti + 1}.{ci + 1}
                                  </span>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* ── Audio waveform track ─────────────────── */}
                      <div className="relative flex items-center gap-1.5">
                        <span className="text-[8px] font-mono font-bold shrink-0 w-5 text-right text-[#F59E0B]">A1</span>
                        <div className="relative flex-1 h-[18px] rounded-[3px] overflow-hidden flex items-end gap-[1px] px-[2px]" style={{ background: "#0B1315" }}>
                          {waveBars.map((h, i) => (
                            <motion.div
                              key={i}
                              className="flex-1 rounded-t-[1px]"
                              style={{
                                background: i / waveBars.length * 100 < pct ? "#F59E0B" : "#F59E0B33",
                                transformOrigin: "bottom",
                              }}
                              animate={{
                                scaleY: [h * 0.7, h, h * 0.5, h * 0.9, h * 0.7],
                                opacity: i / waveBars.length * 100 < pct ? [0.7, 1, 0.6, 0.9, 0.7] : 0.25,
                              }}
                              transition={{ duration: 0.8 + i * 0.02, repeat: Infinity, ease: "easeInOut" }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* ── PLAYHEAD ─────────────────────────────── */}
                      <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: "25px", right: 0 }}>
                        <motion.div
                          className="absolute top-0 bottom-0"
                          style={{ left: `${pct}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        >
                          {/* Playhead line */}
                          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#EF4444]" style={{ boxShadow: "0 0 8px rgba(239,68,68,0.5)" }} />
                          {/* Playhead head */}
                          <div
                            className="absolute left-[-4px] top-[-2px] w-[10px] h-[6px] rounded-b-sm"
                            style={{ background: "#EF4444", boxShadow: "0 2px 6px rgba(239,68,68,0.4)" }}
                          />
                        </motion.div>
                      </div>

                      {/* ── CUT MARKERS (scissors) ───────────────── */}
                      <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: "25px", right: 0 }}>
                        {cutPositions.map((pos, i) => (
                          <motion.div
                            key={i}
                            className="absolute top-0 bottom-0"
                            style={{ left: `${pos}%` }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 0, 0.6, 0.6, 0] }}
                            transition={{ duration: 4, times: [0, 0.15, 0.2, 0.8, 1], repeat: Infinity, delay: i * 0.8 + 1 }}
                          >
                            <div className="w-px h-full" style={{ background: "rgba(245,158,11,0.3)", borderLeft: "1px dashed rgba(245,158,11,0.4)" }} />
                            <span className="absolute -top-0.5 -left-1 text-[7px]">✂️</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* ── Bottom bar ────────────────────────────── */}
                    <div className="flex items-center justify-between px-3 py-2 mt-2 border-t" style={{ borderColor: "#152226", background: "#0A1214" }}>
                      <div className="flex items-center gap-3">
                        <span className="text-[8px] font-mono text-[#3A4A50]">30fps</span>
                        <span className="text-[8px] font-mono text-[#3A4A50]">1080×1920</span>
                        <span className="text-[8px] font-mono text-[#3A4A50]">9:16</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-mono text-[#10B981]">{Math.round(pct)}%</span>
                        <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: "#152226" }}>
                          <motion.div
                            className="h-full rounded-full bg-[#10B981]"
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Status text below timeline ─────────────── */}
                  <p className="mt-6 text-lg font-semibold text-[#EFEFEF]">Building your edit</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <motion.span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-[#10B981]"
                      style={{ boxShadow: "0 0 8px rgba(16,185,129,0.7)" }}
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.p
                      key={phaseLabel}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="text-sm text-[#6B7C85]"
                    >
                      {phaseLabel}
                    </motion.p>
                  </div>

                  {/* main progress bar */}
                  <div className="mt-4 h-1.5 w-full max-w-[340px] overflow-hidden rounded-full bg-[#152226]">
                    <motion.div
                      className="h-full rounded-full bg-[#10B981]"
                      style={{ boxShadow: "0 0 14px rgba(16,185,129,0.5)" }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <div className="mt-2 flex w-full max-w-[340px] justify-between font-mono text-[9px] tabular-nums text-[#6B7C85]">
                    {["0:00", "0:08", "0:15", "0:22", "0:30"].map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <p className="mt-1 font-mono text-xs tabular-nums text-[#6B7C85]">{Math.round(pct)}%</p>
                </div>
              );
            })()}
          </div>
        )}

        {isDone && renderStatus && (
          <div className="bg-[#0D1416] border border-[#152226] rounded-xl p-6 sm:p-8">
            <div className="grid md:grid-cols-[260px_1fr] gap-6 lg:gap-8 items-stretch">
              {/* Left: video */}
              <div className="flex justify-center md:justify-start">
                <div className="aspect-[9/16] w-[260px] max-w-full bg-[#070B0D] rounded-xl border border-[#152226] flex items-center justify-center overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.45)]">
                  {renderStatus.output_url ? (
                    <video
                      src={resolveBackendUrl(renderStatus.output_url)}
                      className="w-full h-full object-cover"
                      controls
                      playsInline
                    />
                  ) : (
                    <span className="text-[#6B7C85] text-xs">Preview</span>
                  )}
                </div>
              </div>

              {/* Right: details + actions */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#10B981]/10 border border-[#10B981]/25 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-semibold text-[#EFEFEF]">Your video is ready</p>
                    <p className="text-sm text-[#6B7C85] mt-0.5">
                      Review it, then schedule it to your calendar
                    </p>
                  </div>
                </div>

                {/* Caption (ready to post) */}
                <div className="mt-6 flex-1 rounded-lg bg-[#070B0D] border border-[#152226] p-4 text-left">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-[#6B7C85] font-mono">
                      Caption
                    </span>
                    {platform && (
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/25 px-2 py-0.5 rounded-full">
                        {platform}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#EFEFEF] leading-relaxed whitespace-pre-line">
                    {captionText}
                  </p>
                </div>

                {/* Saved-to-library note */}
                <div className="mt-5 flex items-center gap-2 text-xs text-[#6B7C85]">
                  <Check className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                  Saved to <span className="text-[#EFEFEF]">My Content</span>
                </div>

                {/* Actions */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <a
                    href={resolveBackendUrl(renderStatus.output_url)}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full text-center bg-[#10B981] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#12cf90] transition-colors"
                  >
                    Download
                  </a>

                  {X_ENABLED && (postResult ? (
                    <a
                      href={postResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 bg-[#0D1416] border border-[#10B981]/40 text-[#10B981] rounded-lg py-3 text-sm font-medium hover:bg-[#10B981]/10 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      Posted — view on X
                    </a>
                  ) : xStatus && !xStatus.connected ? (
                    <button
                      type="button"
                      onClick={() =>
                        startTwitterConnect().catch((e) =>
                          setPostError(e instanceof Error ? e.message : "Couldn't open X. Try again.")
                        )
                      }
                      title="Connect your X account to post"
                      className="w-full flex items-center justify-center gap-2 bg-[#0D1416] border border-[#152226] text-[#EFEFEF] rounded-lg py-3 text-sm font-medium hover:border-[#10B981]/40 hover:bg-[#10191B] transition-colors"
                    >
                      <XLogo className="w-3.5 h-3.5" />
                      Connect X to post
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePostToX}
                      disabled={posting || !xStatus}
                      className="w-full flex items-center justify-center gap-2 bg-[#0D1416] border border-[#152226] text-[#EFEFEF] rounded-lg py-3 text-sm font-medium hover:border-[#10B981]/40 hover:bg-[#10191B] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {posting ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
                          Posting to X…
                        </>
                      ) : (
                        <>
                          <XLogo className="w-3.5 h-3.5" />
                          Post to X
                        </>
                      )}
                    </button>
                  ))}

                  {LINKEDIN_ENABLED && (liPostResult ? (
                    <a
                      href={liPostResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 bg-[#0D1416] border border-[#10B981]/40 text-[#10B981] rounded-lg py-3 text-sm font-medium hover:bg-[#10B981]/10 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      Posted — view on LinkedIn
                    </a>
                  ) : liStatus && !liStatus.connected ? (
                    <button
                      type="button"
                      onClick={() =>
                        startLinkedInConnect().catch((e) =>
                          setLiPostError(e instanceof Error ? e.message : "Couldn't open LinkedIn. Try again.")
                        )
                      }
                      title="Connect your LinkedIn account to post"
                      className="w-full flex items-center justify-center gap-2 bg-[#0D1416] border border-[#152226] text-[#EFEFEF] rounded-lg py-3 text-sm font-medium hover:border-[#10B981]/40 hover:bg-[#10191B] transition-colors"
                    >
                      <LinkedInLogo className="w-3.5 h-3.5" />
                      Connect LinkedIn to post
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePostToLinkedIn}
                      disabled={liPosting || !liStatus}
                      className="w-full flex items-center justify-center gap-2 bg-[#0D1416] border border-[#152226] text-[#EFEFEF] rounded-lg py-3 text-sm font-medium hover:border-[#10B981]/40 hover:bg-[#10191B] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {liPosting ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
                          Posting to LinkedIn…
                        </>
                      ) : (
                        <>
                          <LinkedInLogo className="w-3.5 h-3.5" />
                          Post to LinkedIn
                        </>
                      )}
                    </button>
                  ))}

                  {INSTAGRAM_ENABLED && (igPostResult ? (
                    <a
                      href={igPostResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 bg-[#0D1416] border border-[#10B981]/40 text-[#10B981] rounded-lg py-3 text-sm font-medium hover:bg-[#10B981]/10 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      Posted — view on Instagram
                    </a>
                  ) : igStatus && !igStatus.connected ? (
                    <button
                      type="button"
                      onClick={() =>
                        startInstagramConnect().catch((e) =>
                          setIgPostError(e instanceof Error ? e.message : "Couldn't open Instagram. Try again.")
                        )
                      }
                      title="Connect your Instagram account to post"
                      className="w-full flex items-center justify-center gap-2 bg-[#0D1416] border border-[#152226] text-[#EFEFEF] rounded-lg py-3 text-sm font-medium hover:border-[#10B981]/40 hover:bg-[#10191B] transition-colors"
                    >
                      <InstagramLogo className="w-3.5 h-3.5" />
                      Connect Instagram to post
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePostToInstagram}
                      disabled={igPosting || !igStatus}
                      className="w-full flex items-center justify-center gap-2 bg-[#0D1416] border border-[#152226] text-[#EFEFEF] rounded-lg py-3 text-sm font-medium hover:border-[#10B981]/40 hover:bg-[#10191B] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {igPosting ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
                          Posting to Instagram…
                        </>
                      ) : (
                        <>
                          <InstagramLogo className="w-3.5 h-3.5" />
                          Post to Instagram
                        </>
                      )}
                    </button>
                  ))}
                </div>

                {X_ENABLED && postError && (
                  <p className="mt-2.5 text-xs text-[#EF8B8B] leading-relaxed">{postError}</p>
                )}
                {LINKEDIN_ENABLED && liPostError && (
                  <p className="mt-2.5 text-xs text-[#EF8B8B] leading-relaxed">{liPostError}</p>
                )}
                {INSTAGRAM_ENABLED && igPostError && (
                  <p className="mt-2.5 text-xs text-[#EF8B8B] leading-relaxed">{igPostError}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {isError && (
          <div className="bg-[#0D1416] border border-[#152226] rounded-xl p-5 sm:p-8 space-y-4">
            <X className="w-8 h-8 text-red-400" />
            <p className="text-lg font-medium text-[#EFEFEF]">Rendering failed</p>
            <p className="text-sm text-[#6B7C85]">
              {renderStatus?.error || renderError || "Unknown error"}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="w-full bg-[#0D1416] border border-[#152226] text-[#EFEFEF] rounded-lg py-3 text-sm hover:bg-[#11191B]"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
