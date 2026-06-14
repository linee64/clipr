"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, Music, Play, Scissors, Search, Upload, X } from "lucide-react";
import type {
  AudioSelection,
  Scene,
  TemplateTrack,
  UploadedClipSlot,
  VisualScriptResponse,
} from "@/lib/types";
import { MusicTrimmer } from "./MusicTrimmer";

function fmtSecs(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Animated equalizer bars shown on a track that's currently previewing. */
function EqualizerBars() {
  return (
    <div className="flex items-end gap-[2px] h-3.5" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="w-[2px] rounded-full bg-current"
          initial={{ height: "30%" }}
          animate={{ height: ["30%", "100%", "45%", "85%", "30%"] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.13,
          }}
        />
      ))}
    </div>
  );
}

/** One track as a compact playlist row — reused inline and inside the library. */
function TrackRow({
  track,
  selected,
  playing,
  onSelect,
  onToggle,
}: {
  track: TemplateTrack;
  selected: boolean;
  playing: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={`group flex items-center gap-3 px-3 py-2.5 cursor-pointer border-l-2 transition-colors ${
        selected
          ? "border-l-[#10B981] bg-[#10B981]/[0.06]"
          : "border-l-transparent hover:bg-[#0F1A1D]"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={playing ? "Pause preview" : "Play preview"}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          playing
            ? "bg-[#10B981] text-[#070B0D]"
            : "bg-[#152226] text-[#EFEFEF] group-hover:bg-[#1d2f34]"
        }`}
      >
        {playing ? <EqualizerBars /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
      </button>

      <span className="text-sm font-medium text-[#EFEFEF] truncate flex-1 min-w-0">
        {track.name}
      </span>

      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide text-[#7FA89C] bg-[#10B981]/[0.08] border border-[#10B981]/15 shrink-0 truncate max-w-[45%]">
        {track.vibe}
      </span>

      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${
          selected
            ? "bg-[#10B981] text-[#070B0D] scale-100"
            : "border border-[#2A3A40] text-transparent scale-90"
        }`}
      >
        <Check className="w-3 h-3" strokeWidth={3} />
      </span>
    </div>
  );
}

interface UploadBySlotStepProps {
  visualScript: VisualScriptResponse;
  uploadedClips: Record<number, UploadedClipSlot>;
  audioFile: AudioSelection | null;
  tracks: TemplateTrack[];
  selectedMusicVibe: string;
  onClipUpload: (sceneOrder: number, file: File) => void;
  onClipReplace: (sceneOrder: number, file: File) => void;
  onAudioSelect: (file: File) => void;
  onTrackSelect: (track: TemplateTrack) => void;
  onMusicVibeSelect: (vibe: string) => void;
  onContinue: () => void;
  onBack: () => void;
  /** user picked a start offset (seconds) for the chosen track in the trimmer */
  onTrimChange: (start: number) => void;
}

export function UploadBySlotStep({
  visualScript,
  uploadedClips,
  audioFile,
  tracks,
  onClipUpload,
  onClipReplace,
  onAudioSelect,
  onTrackSelect,
  onContinue,
  onBack,
  onTrimChange,
}: UploadBySlotStepProps) {
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const audioInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [trimmerOpen, setTrimmerOpen] = useState(false);

  // The video length is what the trimmer window represents (capped at 25s).
  const videoSeconds = Math.min(
    25,
    Math.max(
      3,
      visualScript.scenes.reduce((s, sc) => s + (sc.duration_seconds || 0), 0),
    ),
  );
  // An uploaded file has no URL until render — make a local one for the trimmer.
  const uploadUrl = useMemo(
    () => (audioFile?.file ? URL.createObjectURL(audioFile.file) : null),
    [audioFile?.file],
  );
  useEffect(
    () => () => {
      if (uploadUrl) URL.revokeObjectURL(uploadUrl);
    },
    [uploadUrl],
  );
  const trimSrc = audioFile?.isTemplate ? audioFile.url : uploadUrl ?? undefined;

  const scenes = [...visualScript.scenes].sort((a, b) => a.order - b.order);
  const uploadedCount = Object.keys(uploadedClips).length;
  const totalScenes = scenes.length;
  const allClipsUploaded = uploadedCount === totalScenes;
  // Music is optional here — if left empty, the reference picked on the next step
  // supplies a matched track. Only the clips are required to continue.
  const canContinue = allClipsUploaded;

  const handleFile = (sceneOrder: number, file: File, isReplace: boolean) => {
    if (isReplace) onClipReplace(sceneOrder, file);
    else onClipUpload(sceneOrder, file);
  };

  const togglePreview = (track: TemplateTrack) => {
    const audio = previewRef.current;
    if (!audio) return;
    if (playingId === track.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    audio.src = track.url;
    audio.currentTime = 0;
    void audio.play().catch(() => setPlayingId(null));
    setPlayingId(track.id);
  };

  const stopPreview = () => {
    previewRef.current?.pause();
    setPlayingId(null);
  };

  const selectedTrack =
    audioFile?.isTemplate
      ? tracks.find((t) => t.id === audioFile.audio_file_id)
      : undefined;

  // Show 3 tracks inline; keep the chosen one visible even if it lives deeper
  // in the library so the selection never disappears off-screen.
  let previewTracks = tracks.slice(0, 3);
  if (selectedTrack && !previewTracks.some((t) => t.id === selectedTrack.id)) {
    previewTracks = [selectedTrack, ...tracks.slice(0, 2)];
  }

  const q = search.trim().toLowerCase();
  const libraryTracks = q
    ? tracks.filter(
        (t) =>
          t.name.toLowerCase().includes(q) || t.vibe.toLowerCase().includes(q),
      )
    : tracks;

  const closeLibrary = () => {
    stopPreview();
    setLibraryOpen(false);
    setSearch("");
  };

  return (
    <div className="w-full p-6">
      <audio
        ref={previewRef}
        onEnded={() => setPlayingId(null)}
        className="hidden"
      />

      {trimmerOpen && trimSrc && audioFile && (
        <MusicTrimmer
          src={trimSrc}
          name={audioFile.name}
          segmentSeconds={videoSeconds}
          initialStart={audioFile.start ?? 0}
          onApply={onTrimChange}
          onClose={() => setTrimmerOpen(false)}
        />
      )}
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

        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-[#EFEFEF] tracking-tight">
              Background music <span className="text-[#6B7C85] font-normal">· optional</span>
            </h3>
            {tracks.length > 0 && (
              <span className="text-[11px] text-[#6B7C85]">
                {tracks.length} Clipr tracks
              </span>
            )}
          </div>
          <p className="text-xs text-[#6B7C85] mt-1 mb-4">
            Pick a track, or skip it — we&apos;ll match the music to the reference you choose next.
          </p>

          {tracks.length > 0 && (
            <div className="mb-4 rounded-xl border border-[#152226] bg-[#0D1416] overflow-hidden divide-y divide-[#152226]/70">
              {previewTracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  selected={
                    !!audioFile?.isTemplate &&
                    audioFile.audio_file_id === track.id
                  }
                  playing={playingId === track.id}
                  onSelect={() => onTrackSelect(track)}
                  onToggle={() => togglePreview(track)}
                />
              ))}

              {tracks.length > previewTracks.length && (
                <button
                  type="button"
                  onClick={() => setLibraryOpen(true)}
                  className="group w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium text-[#7FA89C] hover:text-[#10B981] hover:bg-[#0F1A1D] transition-colors"
                >
                  <Music className="w-3.5 h-3.5" />
                  Browse all {tracks.length} Clipr tracks
                  <span className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </button>
              )}
            </div>
          )}

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

          {audioFile && !audioFile.isTemplate ? (
            <div className="bg-[#0D1416] border border-[#152226] rounded-xl p-3 flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-[#152226] flex items-center justify-center shrink-0">
                <Music className="w-4 h-4 text-[#10B981]" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#EFEFEF] truncate leading-tight">
                  {audioFile.name}
                </p>
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide text-[#7FA89C] bg-[#10B981]/[0.08] border border-[#10B981]/15">
                  Your track
                </span>
              </div>
              <Check className="w-4 h-4 text-[#10B981] shrink-0" />
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="text-xs text-[#6B7C85] underline shrink-0 hover:text-[#EFEFEF]"
              >
                Replace
              </button>
            </div>
          ) : (
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
              className="group flex items-center gap-3 border border-dashed border-[#152226] rounded-xl p-3 cursor-pointer hover:border-[#1f3338] hover:bg-[#0F1A1D] transition-colors"
            >
              <span className="w-10 h-10 rounded-full bg-[#152226] flex items-center justify-center shrink-0 group-hover:bg-[#1d2f34] transition-colors">
                <Upload className="w-4 h-4 text-[#6B7C85] group-hover:text-[#EFEFEF] transition-colors" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#EFEFEF] leading-tight">
                  Upload your own track
                </p>
                <p className="text-[11px] text-[#6B7C85] mt-0.5">
                  Drop an audio file or tap to browse
                </p>
              </div>
            </div>
          )}

          {audioFile && trimSrc && (
            <button
              type="button"
              onClick={() => setTrimmerOpen(true)}
              className="mt-2.5 w-full flex items-center gap-2.5 rounded-xl border border-[#152226] bg-[#0D1416] px-3 py-2.5 text-left hover:border-[#1f3338] hover:bg-[#0F1A1D] transition-colors"
            >
              <span className="w-8 h-8 rounded-full bg-[#10B981]/[0.12] flex items-center justify-center shrink-0">
                <Scissors className="w-3.5 h-3.5 text-[#10B981]" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-[#EFEFEF] leading-tight">
                  Choose the part of the track
                </span>
                <span className="block text-[11px] text-[#6B7C85] mt-0.5">
                  {audioFile.start
                    ? `Starts at ${fmtSecs(audioFile.start)} · tap to adjust`
                    : "Pick where the music starts, like Instagram"}
                </span>
              </span>
              <span className="text-[11px] font-medium text-[#10B981] shrink-0">
                {audioFile.start ? "Edit" : "Trim"}
              </span>
            </button>
          )}
        </section>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center gap-1.5 py-3 px-4 bg-[#0D1416] border border-[#152226] text-[#6B7C85] rounded-lg text-sm hover:text-[#EFEFEF] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors ${
              canContinue
                ? "bg-[#10B981] text-white hover:bg-[#12cf90]"
                : "bg-[#152226] text-[#3A4A50] cursor-not-allowed"
            }`}
          >
            {`Continue to styles → (${uploadedCount} of ${totalScenes} clips uploaded)`}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {libraryOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeLibrary}
            />
            <motion.div
              role="dialog"
              aria-label="Clipr music library"
              className="relative w-full sm:max-w-lg max-h-[85vh] sm:max-h-[72vh] flex flex-col bg-[#0B1214]/95 border border-[#1f3338] rounded-t-2xl sm:rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl overflow-hidden"
              initial={{ y: 40, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 30, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                <div>
                  <h4 className="text-base font-semibold text-[#EFEFEF] tracking-tight">
                    Clipr library
                  </h4>
                  <p className="text-[11px] text-[#6B7C85] mt-0.5">
                    {tracks.length} curated tracks — preview, then pick one
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeLibrary}
                  aria-label="Close library"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B7C85] hover:text-[#EFEFEF] hover:bg-[#152226] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 pb-3 shrink-0">
                <div className="flex items-center gap-2 rounded-lg bg-[#0D1416] border border-[#152226] px-3 py-2 focus-within:border-[#1f3338]">
                  <Search className="w-4 h-4 text-[#6B7C85] shrink-0" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or vibe…"
                    autoFocus
                    className="flex-1 bg-transparent text-sm text-[#EFEFEF] placeholder:text-[#3A4A50] outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3 divide-y divide-[#152226]/60">
                {libraryTracks.length > 0 ? (
                  libraryTracks.map((track) => (
                    <TrackRow
                      key={track.id}
                      track={track}
                      selected={
                        !!audioFile?.isTemplate &&
                        audioFile.audio_file_id === track.id
                      }
                      playing={playingId === track.id}
                      onSelect={() => {
                        onTrackSelect(track);
                        closeLibrary();
                      }}
                      onToggle={() => togglePreview(track)}
                    />
                  ))
                ) : (
                  <p className="text-sm text-[#6B7C85] text-center py-10">
                    No tracks match “{search}”
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
