"use client";

import React, { useRef } from "react";
import { Check, Music, Upload } from "lucide-react";
import type { Scene, UploadedClipSlot, VisualScriptResponse } from "@/lib/types";

const MUSIC_VIBES = ["dark ambient", "lo-fi beats", "atmospheric"] as const;

interface UploadBySlotStepProps {
  visualScript: VisualScriptResponse;
  uploadedClips: Record<number, UploadedClipSlot>;
  audioFile: { file: File; audio_file_id?: string } | null;
  selectedMusicVibe: string;
  onClipUpload: (sceneOrder: number, file: File) => void;
  onClipReplace: (sceneOrder: number, file: File) => void;
  onAudioSelect: (file: File) => void;
  onMusicVibeSelect: (vibe: string) => void;
  onStartRender: () => void;
  isStartingRender: boolean;
}

export function UploadBySlotStep({
  visualScript,
  uploadedClips,
  audioFile,
  selectedMusicVibe,
  onClipUpload,
  onClipReplace,
  onAudioSelect,
  onMusicVibeSelect,
  onStartRender,
  isStartingRender,
}: UploadBySlotStepProps) {
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const audioInputRef = useRef<HTMLInputElement>(null);

  const scenes = [...visualScript.scenes].sort((a, b) => a.order - b.order);
  const uploadedCount = Object.keys(uploadedClips).length;
  const totalScenes = scenes.length;
  const allClipsUploaded = uploadedCount === totalScenes;
  const canRender = allClipsUploaded && audioFile !== null;

  const handleFile = (sceneOrder: number, file: File, isReplace: boolean) => {
    if (isReplace) onClipReplace(sceneOrder, file);
    else onClipUpload(sceneOrder, file);
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold text-[#EFEFEF]">Upload your clips</h2>
        <p className="text-sm text-[#6B7C85] mt-1">Match each clip to its scene</p>

        <div className="mt-6 space-y-3">
          {scenes.map((scene: Scene) => {
            const uploaded = uploadedClips[scene.order];
            const inputId = `clip-input-${scene.order}`;

            return (
              <div
                key={scene.order}
                className="bg-[#0D1416] border border-[#152226] rounded-xl p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#152226] text-[#EFEFEF] text-xs font-medium flex items-center justify-center shrink-0">
                    {scene.order}
                  </span>
                  <span className="text-sm font-medium text-[#EFEFEF] flex-1 truncate">
                    {scene.phrase}
                  </span>
                  <span className="text-xs text-[#6B7C85] shrink-0">
                    {scene.duration_seconds}s
                  </span>
                </div>

                <input
                  ref={(el) => { fileInputRefs.current[scene.order] = el; }}
                  id={inputId}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(scene.order, f, !!uploaded);
                    e.target.value = "";
                  }}
                />

                {!uploaded ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRefs.current[scene.order]?.click()}
                    onKeyDown={(e) =>
                      e.key === "Enter" && fileInputRefs.current[scene.order]?.click()
                    }
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const f = e.dataTransfer.files[0];
                      if (f) handleFile(scene.order, f, false);
                    }}
                    className="mt-3 border border-dashed border-[#152226] rounded-lg p-4 text-center cursor-pointer hover:bg-[#070B0D] transition-colors"
                  >
                    <Upload className="w-5 h-5 text-[#6B7C85] mx-auto" />
                    <p className="text-sm text-[#6B7C85] mt-2">
                      Drop clip here or tap to upload
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-3 bg-[#070B0D] rounded-lg p-3">
                    <div className="w-16 h-10 bg-[#152226] rounded flex items-center justify-center shrink-0">
                      <span className="text-[#6B7C85] text-xs">▶</span>
                    </div>
                    <span className="text-xs text-[#6B7C85] truncate flex-1">
                      {uploaded.file.name}
                    </span>
                    <Check className="w-4 h-4 text-[#10B981] shrink-0" />
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[scene.order]?.click()}
                      className="text-xs text-[#6B7C85] underline shrink-0 hover:text-[#EFEFEF]"
                    >
                      Replace
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <section className="mt-8">
          <h3 className="text-sm font-medium text-[#EFEFEF]">Background music</h3>
          <p className="text-xs text-[#6B7C85] mt-1 mb-3">
            Upload your track or pick a vibe
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {MUSIC_VIBES.map((vibe) => (
              <button
                key={vibe}
                type="button"
                onClick={() => onMusicVibeSelect(vibe)}
                className={`text-xs border rounded-full px-3 py-1 transition-colors ${
                  selectedMusicVibe === vibe
                    ? "border-[#10B981] text-[#10B981]"
                    : "border-[#152226] text-[#6B7C85] hover:text-[#EFEFEF]"
                }`}
              >
                {vibe}
              </button>
            ))}
          </div>

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
              className="border border-dashed border-[#152226] rounded-lg p-4 text-center cursor-pointer hover:bg-[#070B0D] transition-colors"
            >
              <Music className="w-5 h-5 text-[#6B7C85] mx-auto" />
              <p className="text-sm text-[#6B7C85] mt-2">Upload background music</p>
            </div>
          ) : (
            <div className="bg-[#0D1416] border border-[#152226] rounded-lg p-3 flex items-center gap-3">
              <Music className="w-4 h-4 text-[#6B7C85]" />
              <span className="text-sm text-[#EFEFEF] truncate flex-1">
                {audioFile.file.name}
              </span>
              <Check className="w-4 h-4 text-[#10B981]" />
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={onStartRender}
          disabled={!canRender || isStartingRender}
          className={`w-full mt-6 py-3 rounded-lg text-sm font-medium transition-colors ${
            canRender && !isStartingRender
              ? "bg-[#10B981] text-white hover:bg-[#12cf90]"
              : "bg-[#152226] text-[#3A4A50] cursor-not-allowed"
          }`}
        >
          {isStartingRender
            ? "Starting..."
            : `Start render → (${uploadedCount} of ${totalScenes} clips uploaded)`}
        </button>
      </div>
    </div>
  );
}
