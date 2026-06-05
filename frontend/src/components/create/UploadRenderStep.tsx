"use client";

import React, { useRef } from "react";
import {
  Check,
  Copy,
  Music,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { RenderStatus, UploadedClip } from "@/lib/types";
import { resolveBackendUrl } from "@/lib/api";
import { ClipList } from "./ClipList";

type OutputPlatform = "TikTok" | "LinkedIn" | "Reels";

function progressLabel(progress: number, platform: string): string {
  if (progress < 20) return "Downloading clips...";
  if (progress < 40) return "Concatenating clips...";
  if (progress < 50) return `Optimizing for ${platform}...`;
  if (progress < 60) return "Mixing audio...";
  if (progress < 85) return "Generating subtitles...";
  if (progress < 90) return "Writing description...";
  return "Uploading final video...";
}

interface UploadRenderStepProps {
  ideaTitle: string;
  platform: string;
  format: string;
  hookPreview: string;
  scriptSaved: boolean;
  uploadedClips: UploadedClip[];
  onClipsChange: (clips: UploadedClip[]) => void;
  onClipUpdate: (id: string, patch: Partial<UploadedClip>) => void;
  onClipRemove: (id: string) => void;
  onAddClips: (files: FileList) => void;
  audioFile: { file: File; audio_file_id?: string } | null;
  audioVolume: number;
  onAudioVolumeChange: (v: number) => void;
  onAudioSelect: (file: File) => void;
  onAudioRemove: () => void;
  addSubtitles: boolean;
  onAddSubtitlesChange: (v: boolean) => void;
  outputPlatform: OutputPlatform;
  onOutputPlatformChange: (p: OutputPlatform) => void;
  isRendering: boolean;
  isStartingRender: boolean;
  renderStatus: RenderStatus | null;
  renderError: string | null;
  onStartRender: () => void;
  onRetryRender: () => void;
  onSchedulePost: () => void;
}

export function UploadRenderStep({
  ideaTitle,
  platform,
  format,
  hookPreview,
  scriptSaved,
  uploadedClips,
  onClipsChange,
  onClipUpdate,
  onClipRemove,
  onAddClips,
  audioFile,
  audioVolume,
  onAudioVolumeChange,
  onAudioSelect,
  onAudioRemove,
  addSubtitles,
  onAddSubtitlesChange,
  outputPlatform,
  onOutputPlatformChange,
  isRendering,
  isStartingRender,
  renderStatus,
  renderError,
  onStartRender,
  onRetryRender,
  onSchedulePost,
}: UploadRenderStepProps) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = React.useState(false);

  const clipCount = uploadedClips.length;
  const hasClips = clipCount > 0;
  const status = renderStatus?.status;
  const isDone = status === "done";
  const isError = status === "error" || !!renderError;
  const progress = renderStatus?.progress ?? 0;

  const handleCopyDescription = async () => {
    const text = renderStatus?.description ?? "";
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const outputPlatforms: OutputPlatform[] = ["TikTok", "LinkedIn", "Reels"];
  const aspectLabels: Record<OutputPlatform, string> = {
    TikTok: "9:16",
    LinkedIn: "16:9",
    Reels: "9:16",
  };

  return (
    <div className="flex gap-6 flex-1 min-h-0 overflow-hidden p-6">
      <div className="w-[60%] overflow-y-auto scrollbar-thin pr-1">
        <section>
          <h3 className="text-sm font-medium text-[#EFEFEF]">Video clips</h3>
          <p className="text-xs text-[#888888] mt-1 mb-4">
            Upload your filmed clips in order. Use the speaker icon to mute clip audio — only background music will play.
          </p>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) onAddClips(e.target.files);
              e.target.value = "";
            }}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => videoInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && videoInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files.length) onAddClips(e.dataTransfer.files);
            }}
            className="border border-dashed border-[#333333] rounded-xl p-8 text-center bg-[#1a1a1a] hover:bg-[#242424] cursor-pointer transition"
          >
            <Upload className="w-6 h-6 text-[#888888] mx-auto" />
            <p className="text-sm text-[#888888] mt-2">
              Drop clips here or click to upload
            </p>
            <p className="text-xs text-[#555555] mt-1">MP4, MOV up to 500MB each</p>
          </div>
          <ClipList
            clips={uploadedClips}
            onReorder={onClipsChange}
            onUpdate={onClipUpdate}
            onRemove={onClipRemove}
          />
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-medium text-[#EFEFEF]">Background audio</h3>
          <p className="text-xs text-[#888888] mt-1 mb-4">
            Optional — add ambient music or sound
          </p>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onAudioSelect(f);
              e.target.value = "";
            }}
          />
          {!audioFile ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => audioInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && audioInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) onAudioSelect(f);
              }}
              className="border border-dashed border-[#333333] rounded-xl p-5 text-center bg-[#1a1a1a] hover:bg-[#242424] cursor-pointer transition"
            >
              <Music className="w-5 h-5 text-[#888888] mx-auto" />
              <p className="text-sm text-[#888888] mt-2">
                Drop audio or click to upload
              </p>
              <p className="text-xs text-[#555555] mt-1">MP3, WAV up to 50MB</p>
            </div>
          ) : (
            <div className="bg-[#242424] border border-[#333333] rounded-lg p-3 flex items-center gap-3">
              <Music className="w-4 h-4 text-[#888888] shrink-0" />
              <span className="text-sm text-[#EFEFEF] truncate flex-1">
                {audioFile.file.name}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-[#888888]">Volume</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={audioVolume}
                  onChange={(e) => onAudioVolumeChange(Number(e.target.value))}
                  className="w-20 accent-[#10B981]"
                />
                <span className="text-xs text-[#888888] w-8">{audioVolume}%</span>
              </div>
              <button
                type="button"
                onClick={onAudioRemove}
                className="text-[#888888] hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-medium text-[#EFEFEF] mb-3">Options</h3>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-[#EFEFEF]">Add subtitles automatically</p>
              <p className="text-xs text-[#888888]">Generated by Whisper AI</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={addSubtitles}
              onClick={() => onAddSubtitlesChange(!addSubtitles)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                addSubtitles ? "bg-[#10B981]" : "bg-[#333333]"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                  addSubtitles ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
          <div className="mt-4">
            <p className="text-sm text-[#888888] mb-2">Output format</p>
            <div className="flex flex-wrap gap-2">
              {outputPlatforms.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onOutputPlatformChange(p)}
                  className={`text-xs border rounded-full px-3 py-1 transition-colors ${
                    outputPlatform === p
                      ? "border-[#10B981] text-[#10B981]"
                      : "border-[#333333] text-[#888888] hover:text-[#EFEFEF]"
                  }`}
                >
                  {p} ({aspectLabels[p]})
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="w-[40%] flex flex-col min-h-0 overflow-y-auto scrollbar-thin">
        <div className="bg-[#242424] border border-[#333333] rounded-xl p-5 mb-4">
          <p className="text-xs tracking-widest text-[#888888]">SCRIPT SUMMARY</p>
          <p className="text-sm text-[#EFEFEF] mt-2 italic line-clamp-4">
            &ldquo;{hookPreview}&rdquo;
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <span className="text-xs border border-[#333333] rounded-full px-2.5 py-0.5 text-[#888888]">
              {platform}
            </span>
            <span className="text-xs border border-[#333333] rounded-full px-2.5 py-0.5 text-[#888888]">
              {format}
            </span>
          </div>
        </div>

        <div className="bg-[#242424] border border-[#333333] rounded-xl p-5 flex-1">
          {!isRendering && !isDone && !isError && (
            <>
              <p className="text-sm font-medium text-[#EFEFEF]">Ready to render</p>
              <ul className="text-xs text-[#888888] mt-3 space-y-1">
                <li>{scriptSaved ? "✓" : "○"} Script saved</li>
                <li>
                  {hasClips ? "✓" : "○"} {clipCount} clip{clipCount !== 1 ? "s" : ""}{" "}
                  uploaded
                </li>
                <li>{audioFile ? "✓" : "○"} Background audio (optional)</li>
              </ul>
              <button
                type="button"
                onClick={onStartRender}
                disabled={!hasClips || isStartingRender}
                className={`w-full rounded-lg py-3 text-sm font-medium mt-4 transition-colors ${
                  hasClips && !isStartingRender
                    ? "bg-[#10B981] text-white hover:bg-[#12cf90]"
                    : "bg-[#333333] text-[#555555] cursor-not-allowed"
                }`}
              >
                {isStartingRender ? "Starting..." : "Start rendering →"}
              </button>
            </>
          )}

          {isRendering && !isDone && !isError && (
            <>
              <p className="text-sm font-medium text-[#EFEFEF]">Rendering your video</p>
              <div className="w-full h-1.5 bg-[#333333] rounded-full mt-4 overflow-hidden">
                <div
                  className="h-full bg-[#10B981] transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-[#888888] mt-2">
                {progressLabel(progress, outputPlatform)} {progress}%
              </p>
            </>
          )}

          {isDone && renderStatus && (
            <div className="space-y-4">
              <Check className="w-6 h-6 text-[#10B981]" />
              <p className="text-base font-semibold text-[#EFEFEF]">Your video is ready!</p>
              <div className="relative">
                <p className="text-xs tracking-widest text-[#888888]">Generated description</p>
                <button
                  type="button"
                  onClick={handleCopyDescription}
                  className="absolute top-0 right-0 p-1 text-[#888888] hover:text-[#EFEFEF]"
                  title="Copy"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <p className="text-sm text-[#EFEFEF] bg-[#1a1a1a] rounded-lg p-3 mt-2 pr-8">
                  {renderStatus.description || ideaTitle}
                </p>
                {copied && (
                  <span className="text-[10px] text-[#10B981]">Copied!</span>
                )}
              </div>
              <a
                href={resolveBackendUrl(renderStatus.output_url)}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-[#242424] border border-[#333333] text-[#EFEFEF] rounded-lg py-2.5 text-sm hover:bg-[#2a2a2a] transition-colors"
              >
                Download video
              </a>
              <button
                type="button"
                onClick={onSchedulePost}
                className="w-full bg-[#10B981] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#12cf90] transition-colors"
              >
                Schedule & post →
              </button>
            </div>
          )}

          {isError && (
            <div className="space-y-3">
              <X className="w-6 h-6 text-red-400" />
              <p className="text-sm text-[#EFEFEF]">Rendering failed</p>
              <p className="text-xs text-[#888888]">
                {renderStatus?.error || renderError || "Unknown error"}
              </p>
              <button
                type="button"
                onClick={onRetryRender}
                className="w-full bg-[#242424] border border-[#333333] text-[#EFEFEF] rounded-lg py-2.5 text-sm hover:bg-[#2a2a2a]"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}