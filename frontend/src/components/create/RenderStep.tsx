"use client";

import React from "react";
import { Check, X } from "lucide-react";
import type { RenderStatus } from "@/lib/types";
import { resolveBackendUrl } from "@/lib/api";

function progressLabel(progress: number): string {
  if (progress < 15) return "Downloading clips...";
  if (progress < 30) return "Trimming and color grading...";
  if (progress < 40) return "Analyzing beats...";
  if (progress < 55) return "Syncing to beats...";
  if (progress < 65) return "Concatenating clips...";
  if (progress < 75) return "Mixing audio...";
  if (progress < 88) return "Burning text overlays...";
  if (progress < 95) return "Resizing for platform...";
  return "Uploading final video...";
}

interface RenderStepProps {
  renderStatus: RenderStatus | null;
  renderError: string | null;
  isRendering: boolean;
  onRetry: () => void;
  onSchedulePost: () => void;
}

export function RenderStep({
  renderStatus,
  renderError,
  isRendering,
  onRetry,
  onSchedulePost,
}: RenderStepProps) {
  const status = renderStatus?.status;
  const isDone = status === "done";
  const isError = status === "error" || !!renderError;
  const progress = renderStatus?.progress ?? 0;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="max-w-lg mx-auto">
        {isRendering && !isDone && !isError && (
          <div className="bg-[#242424] border border-[#333333] rounded-xl p-8">
            <p className="text-lg font-medium text-[#EFEFEF]">Rendering your video</p>
            <div className="w-full h-1.5 bg-[#333333] rounded-full mt-6 overflow-hidden">
              <div
                className="h-full bg-[#10B981] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-[#888888] mt-3">
              {progressLabel(progress)} {progress}%
            </p>
          </div>
        )}

        {isDone && renderStatus && (
          <div className="bg-[#242424] border border-[#333333] rounded-xl p-8 space-y-5">
            <Check className="w-8 h-8 text-[#10B981]" />
            <p className="text-xl font-semibold text-[#EFEFEF]">Your video is ready</p>

            <div className="aspect-[9/16] max-w-[200px] bg-[#1a1a1a] rounded-lg border border-[#333333] flex items-center justify-center overflow-hidden">
              {renderStatus.output_url ? (
                <video
                  src={resolveBackendUrl(renderStatus.output_url)}
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                />
              ) : (
                <span className="text-[#888888] text-xs">Preview</span>
              )}
            </div>

            <a
              href={resolveBackendUrl(renderStatus.output_url)}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-[#242424] border border-[#333333] text-[#EFEFEF] rounded-lg py-3 text-sm hover:bg-[#2a2a2a] transition-colors"
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
        )}

        {isError && (
          <div className="bg-[#242424] border border-[#333333] rounded-xl p-8 space-y-4">
            <X className="w-8 h-8 text-red-400" />
            <p className="text-lg font-medium text-[#EFEFEF]">Rendering failed</p>
            <p className="text-sm text-[#888888]">
              {renderStatus?.error || renderError || "Unknown error"}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="w-full bg-[#242424] border border-[#333333] text-[#EFEFEF] rounded-lg py-3 text-sm hover:bg-[#2a2a2a]"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
