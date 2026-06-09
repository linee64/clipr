"use client";

import React from "react";
import { motion } from "framer-motion";
import { Check, Film, X } from "lucide-react";
import type { RenderStatus } from "@/lib/types";
import { resolveBackendUrl } from "@/lib/api";

function progressLabel(progress: number): string {
  if (progress < 15) return "Analyzing the beat...";
  if (progress < 45) return "Cutting your beat-synced montage...";
  if (progress < 62) return "Stitching the cuts together...";
  if (progress < 75) return "Mixing in your music...";
  if (progress < 95) return "Burning word-by-word captions...";
  return "Uploading final video...";
}

const BEAT_BARS = Array.from({ length: 18 });

interface RenderStepProps {
  renderStatus: RenderStatus | null;
  renderError: string | null;
  isRendering: boolean;
  onRetry: () => void;
  onSchedulePost: () => void;
  videoTitle?: string;
  platform?: string;
  caption?: string;
}

export function RenderStep({
  renderStatus,
  renderError,
  isRendering,
  onRetry,
  onSchedulePost,
  videoTitle,
  platform,
  caption,
}: RenderStepProps) {
  const status = renderStatus?.status;
  const isDone = status === "done";
  const isError = status === "error" || !!renderError;
  const progress = renderStatus?.progress ?? 0;

  const title = videoTitle?.trim() || "Your Clipr video";
  const captionText = caption?.trim() || renderStatus?.description?.trim() || title;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="max-w-lg mx-auto">
        {isRendering && !isDone && !isError && (
          <div className="bg-[#0D1416] border border-[#152226] rounded-xl p-8">
            <div className="flex flex-col items-center text-center">
              {/* Phone frame with sweeping scan */}
              <div className="relative aspect-[9/16] w-[150px] rounded-2xl border border-[#152226] bg-[#070B0D] overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.45)]">
                <motion.div
                  className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-[#10B981]/25 to-transparent"
                  animate={{ y: ["-45%", "150%"] }}
                  transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ opacity: [0.4, 1, 0.4], scale: [0.95, 1.05, 0.95] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Film className="w-7 h-7 text-[#10B981]" />
                  </motion.div>
                </div>
              </div>

              {/* Beat equalizer — clips snapping to the beat */}
              <div className="flex items-end gap-[3px] h-10 mt-6">
                {BEAT_BARS.map((_, i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 rounded-full bg-gradient-to-t from-[#10B981]/40 to-[#10B981]"
                    style={{ height: "100%", transformOrigin: "bottom" }}
                    animate={{ scaleY: [0.25, 1, 0.45, 0.85, 0.3] }}
                    transition={{
                      duration: 1 + (i % 4) * 0.18,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.07,
                    }}
                  />
                ))}
              </div>

              <p className="text-lg font-semibold text-[#EFEFEF] mt-6">Rendering your video</p>
              <motion.p
                key={progressLabel(progress)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-[#6B7C85] mt-1"
              >
                {progressLabel(progress)}
              </motion.p>

              {/* Progress bar */}
              <div className="w-full max-w-[300px] h-1.5 bg-[#152226] rounded-full mt-5 overflow-hidden">
                <motion.div
                  className="h-full bg-[#10B981]"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <p className="text-xs text-[#6B7C85] font-mono mt-2">{progress}%</p>
            </div>
          </div>
        )}

        {isDone && renderStatus && (
          <div className="bg-[#0D1416] border border-[#152226] rounded-xl p-6 sm:p-8">
            {/* Header */}
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-[#10B981]/10 border border-[#10B981]/25 flex items-center justify-center">
                <Check className="w-5 h-5 text-[#10B981]" />
              </div>
              <p className="text-xl font-semibold text-[#EFEFEF] mt-4">Your video is ready</p>
              <p className="text-sm text-[#6B7C85] mt-1">
                Review it, then schedule it to your calendar
              </p>
            </div>

            {/* Centered video preview */}
            <div className="mt-6 flex justify-center">
              <div className="aspect-[9/16] w-[230px] max-w-full bg-[#070B0D] rounded-xl border border-[#152226] flex items-center justify-center overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.45)]">
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

            {/* Caption (ready to post) */}
            <div className="mt-6 rounded-lg bg-[#070B0D] border border-[#152226] p-4 text-left">
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

            {/* Actions */}
            <div className="mt-6 space-y-2.5">
              <a
                href={resolveBackendUrl(renderStatus.output_url)}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-[#0D1416] border border-[#152226] text-[#EFEFEF] rounded-lg py-3 text-sm hover:bg-[#11191B] transition-colors"
              >
                Download
              </a>
              <button
                type="button"
                onClick={onSchedulePost}
                className="w-full bg-[#10B981] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#12cf90] transition-colors"
              >
                Schedule & post →
              </button>
            </div>
          </div>
        )}

        {isError && (
          <div className="bg-[#0D1416] border border-[#152226] rounded-xl p-8 space-y-4">
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
