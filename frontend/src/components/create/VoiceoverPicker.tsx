"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Mic, Pause, Play } from "lucide-react";
import { getVoices, previewVoiceover } from "@/lib/api";
import type { Voice, VoiceoverSettings } from "@/lib/types";

interface VoiceoverPickerProps {
  value: VoiceoverSettings;
  onChange: (next: VoiceoverSettings) => void;
}

/** A nicely-cased label for the voice's accent/use-case if ElevenLabs provides one. */
function voiceTag(v: Voice): string {
  const l = v.labels || {};
  return (l.accent || l.description || l.use_case || v.category || "").toString();
}

/**
 * AI-voiceover controls for the upload step: a toggle that, when on, lazily loads the
 * account's ElevenLabs voices, lets the user pick one, tune the speaking speed, and
 * hear a sample — all without leaving the flow. Voices are only fetched once the user
 * actually turns voiceover on, so creators who don't use it never trigger the call
 * (or a "not configured" error). The chosen voice + speed flow into the render request.
 */
export function VoiceoverPicker({ value, onChange }: VoiceoverPickerProps) {
  const { enabled, voiceId, speed } = value;

  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Preview playback state: which voice is being synthesized, and which is playing.
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch voices the first time voiceover is enabled (and on a manual retry).
  useEffect(() => {
    if (!enabled || loaded || loading) return;
    let active = true;
    setLoading(true);
    setError(null);
    getVoices()
      .then(({ voices: list }) => {
        if (!active) return;
        setVoices(list);
        setLoaded(true);
        // Auto-select the first voice so an enabled toggle always has a usable pick.
        if (!voiceId && list[0]) {
          onChange({ enabled, voiceId: list[0].voice_id, speed });
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Couldn't load voices.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loaded]);

  // Stop any preview when the component unmounts.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const stopPlayback = () => {
    audioRef.current?.pause();
    setPlayingId(null);
  };

  const toggle = () => {
    if (enabled) stopPlayback();
    onChange({ ...value, enabled: !enabled });
  };

  const selectVoice = (id: string) => {
    stopPlayback();
    onChange({ ...value, voiceId: id });
  };

  const handlePreview = async (id: string) => {
    // Clicking the playing voice stops it.
    if (playingId === id) {
      stopPlayback();
      return;
    }
    stopPlayback();
    setPreviewLoadingId(id);
    setError(null);
    try {
      const { audio_base64, content_type } = await previewVoiceover({
        voice_id: id,
        speed,
      });
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = `data:${content_type || "audio/mpeg"};base64,${audio_base64}`;
      audio.onended = () => setPlayingId(null);
      await audio.play();
      setPlayingId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setPreviewLoadingId(null);
    }
  };

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-full bg-[#10B981]/[0.12] flex items-center justify-center shrink-0">
            <Mic className="w-4 h-4 text-[#10B981]" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#EFEFEF] tracking-tight">
              AI voiceover{" "}
              <span className="text-[#6B7C85] font-normal">· optional</span>
            </h3>
            <p className="text-[11px] text-[#6B7C85] mt-0.5 truncate">
              Narrate each scene&apos;s line — the music ducks under the voice
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle AI voiceover"
          onClick={toggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
            enabled ? "bg-[#10B981]" : "bg-[#152226]"
          }`}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm ${
              enabled ? "right-0.5" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div
            key="vo-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4">
              {loading && (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-[#152226] bg-[#0D1416] py-8 text-[#6B7C85]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#10B981]" />
                  <span className="text-sm">Loading voices…</span>
                </div>
              )}

              {!loading && error && (
                <div className="rounded-xl border border-[#EF8B8B]/20 bg-[#EF8B8B]/[0.06] px-3 py-3">
                  <p className="text-xs text-[#EF8B8B]">{error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setLoaded(false);
                      setError(null);
                    }}
                    className="mt-2 text-[11px] font-medium text-[#10B981] underline hover:text-[#12cf90]"
                  >
                    Try again
                  </button>
                </div>
              )}

              {!loading && !error && voices.length > 0 && (
                <>
                  <div className="rounded-xl border border-[#152226] bg-[#0D1416] overflow-hidden">
                    <div className="max-h-56 overflow-y-auto scrollbar-thin divide-y divide-[#152226]/70">
                      {voices.map((v) => {
                        const selected = v.voice_id === voiceId;
                        const isLoadingPrev = previewLoadingId === v.voice_id;
                        const isPlaying = playingId === v.voice_id;
                        const tag = voiceTag(v);
                        return (
                          <div
                            key={v.voice_id}
                            role="button"
                            tabIndex={0}
                            aria-pressed={selected}
                            onClick={() => selectVoice(v.voice_id)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && selectVoice(v.voice_id)
                            }
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
                                void handlePreview(v.voice_id);
                              }}
                              aria-label={
                                isPlaying ? "Stop preview" : `Preview ${v.name}`
                              }
                              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                isPlaying
                                  ? "bg-[#10B981] text-[#070B0D]"
                                  : "bg-[#152226] text-[#EFEFEF] group-hover:bg-[#1d2f34]"
                              }`}
                            >
                              {isLoadingPrev ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : isPlaying ? (
                                <Pause className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
                              )}
                            </button>

                            <span className="text-sm font-medium text-[#EFEFEF] truncate flex-1 min-w-0">
                              {v.name}
                            </span>

                            {tag && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide text-[#7FA89C] bg-[#10B981]/[0.08] border border-[#10B981]/15 shrink-0 truncate max-w-[40%]">
                                {tag}
                              </span>
                            )}

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
                      })}
                    </div>
                  </div>

                  {/* Speaking speed */}
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#152226] bg-[#0D1416] px-3 py-2.5">
                    <span className="text-xs font-medium text-[#9FB0B6] shrink-0">
                      Speed
                    </span>
                    <input
                      type="range"
                      min={0.7}
                      max={1.2}
                      step={0.05}
                      value={speed}
                      onChange={(e) =>
                        onChange({ ...value, speed: Number(e.target.value) })
                      }
                      aria-label="Voiceover speed"
                      className="flex-1 accent-[#10B981]"
                    />
                    <span className="text-xs font-mono text-[#6B7C85] shrink-0 w-10 text-right">
                      {speed.toFixed(2)}×
                    </span>
                  </div>
                </>
              )}

              {!loading && !error && loaded && voices.length === 0 && (
                <p className="rounded-xl border border-[#152226] bg-[#0D1416] py-6 text-center text-sm text-[#6B7C85]">
                  No voices found on this ElevenLabs account.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
