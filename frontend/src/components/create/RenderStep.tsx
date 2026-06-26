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
      <div className={`${isDone ? "max-w-4xl" : "max-w-lg"} mx-auto`}>
        {!isDone && !isError && (
          <div className="bg-[#0D1416] border border-[#152226] rounded-xl p-5 sm:p-8">
            {(() => {
              const pct = Math.max(0, Math.min(100, progress));
              return (
                <div className="relative flex flex-col items-center text-center px-2 sm:px-6 py-2">
                  {/* atmospheric mint glow behind the phone */}
                  <div
                    className="pointer-events-none absolute left-1/2 top-[120px] h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
                    style={{ background: "radial-gradient(circle, rgba(16,185,129,0.10) 0%, rgba(16,185,129,0) 70%)" }}
                  />

                  {/* PHONE — breathes on the downbeat with a beat-pulse ring */}
                  <motion.div
                    className="relative"
                    animate={{ scale: [1, 1.018, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <motion.div
                      className="absolute -inset-3 rounded-[2rem] border"
                      style={{ borderColor: "rgba(16,185,129,0.35)" }}
                      animate={{ opacity: [0, 0.55, 0], scale: [0.92, 1.1, 1.16] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                    />
                    <div
                      className="relative aspect-[9/16] w-[164px] overflow-hidden rounded-[1.6rem] border bg-[#070B0D] p-2"
                      style={{ borderColor: "#152226", boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 22px rgba(16,185,129,0.12)" }}
                    >
                      <div className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-[#152226]" />

                      {/* clip tiles snapping into the frame on the beat */}
                      <div className="mt-4 grid grid-cols-2 gap-1.5">
                        {[0, 1, 2, 3].map((i) => (
                          <motion.div
                            key={i}
                            className="aspect-square overflow-hidden rounded-md border"
                            style={{ borderColor: "rgba(16,185,129,0.18)", background: "linear-gradient(135deg, rgba(16,185,129,0.16) 0%, rgba(13,20,22,0.9) 60%)" }}
                            animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.6, 0.6, 1, 1, 0.6], y: [10, 10, 0, 0, 10] }}
                            transition={{ duration: 3.2, times: [0, 0.05, 0.22, 0.85, 1], repeat: Infinity, ease: "easeOut", delay: i * 0.12 }}
                          >
                            <div className="flex h-full items-end justify-center gap-[2px] p-1.5">
                              {[0, 1, 2].map((b) => (
                                <motion.span
                                  key={b}
                                  className="w-[2px] flex-1 rounded-full bg-[#10B981]"
                                  style={{ transformOrigin: "bottom" }}
                                  animate={{ scaleY: [0.3, 1, 0.4, 0.8, 0.3] }}
                                  transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: (i + b) * 0.09 }}
                                />
                              ))}
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* caption chips popping word-by-word */}
                      <div className="absolute inset-x-3 bottom-7 flex flex-wrap justify-center gap-1">
                        {["beat", "synced", "cut"].map((w, i) => (
                          <motion.span
                            key={w}
                            className="rounded-[5px] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide"
                            style={{ color: "#070B0D", background: "#10B981", boxShadow: "0 0 12px rgba(16,185,129,0.45)" }}
                            animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, 6], scale: [0.8, 1, 1, 0.8] }}
                            transition={{ duration: 1.6, times: [0, 0.18, 0.8, 1], repeat: Infinity, ease: "easeOut", delay: 0.5 + i * 0.22 }}
                          >
                            {w}
                          </motion.span>
                        ))}
                      </div>

                      {/* mint scan line sweeping the timeline */}
                      <motion.div
                        className="absolute inset-x-0 h-10"
                        style={{ background: "linear-gradient(to bottom, transparent, rgba(16,185,129,0.22), transparent)" }}
                        animate={{ y: ["-30%", "150%"] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      />

                      {/* in-phone timeline — playhead rides real progress */}
                      <div className="absolute inset-x-2.5 bottom-2.5 h-1 overflow-hidden rounded-full bg-[#152226]">
                        <motion.div
                          className="h-full rounded-full bg-[#10B981]"
                          style={{ boxShadow: "0 0 10px rgba(16,185,129,0.6)" }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </motion.div>

                  {/* phase label with pulsing status dot */}
                  <p className="mt-8 text-lg font-semibold text-[#EFEFEF]">Building your edit</p>
                  <div className="mt-1 flex items-center gap-2">
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

                  {/* progress timeline */}
                  <div className="mt-5 h-1.5 w-full max-w-[300px] overflow-hidden rounded-full bg-[#152226]">
                    <motion.div
                      className="h-full rounded-full bg-[#10B981]"
                      style={{ boxShadow: "0 0 14px rgba(16,185,129,0.5)" }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <div className="mt-2 flex w-full max-w-[300px] justify-between font-mono text-[9px] tabular-nums text-[#6B7C85]">
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
