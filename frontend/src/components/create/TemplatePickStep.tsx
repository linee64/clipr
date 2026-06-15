"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronLeft, Film, Loader2, Music, RefreshCw } from "lucide-react";
import { resolveBackendUrl, sampleTemplates } from "@/lib/api";
import type { TemplateOption } from "@/lib/types";

interface TemplatePickStepProps {
  platform: string;
  selectedTemplateId: string | null;
  onSelect: (id: string, recommendedTrack?: string, musicManual?: boolean) => void;
  onRender: () => void;
  onBack: () => void;
  isStartingRender: boolean;
  /** true when a track (library or upload) is currently chosen */
  hasMusic?: boolean;
  /** name of the track that will be used (reference-matched or user-picked) */
  musicLabel?: string;
  /** true when the user picked their own track instead of the reference's */
  musicIsCustom?: boolean;
  onChangeMusic?: () => void;
}

function prettyGrade(g: string): string {
  return (g || "").replace(/_/g, " ");
}

export function TemplatePickStep({
  platform,
  selectedTemplateId,
  onSelect,
  onRender,
  onBack,
  isStartingRender,
  hasMusic,
  musicLabel,
  musicIsCustom,
  onChangeMusic,
}: TemplatePickStepProps) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (excludeIds: string[]) => {
      setIsLoading(true);
      setError(null);
      try {
        // Show 3 references at a time; "Show other styles" reshuffles to new ones.
        const { templates: next } = await sampleTemplates(platform, excludeIds);
        setTemplates(next);
        // drop the selection if the chosen style is no longer on screen
        if (selectedTemplateId && !next.some((t) => t.id === selectedTemplateId)) {
          onSelect("");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load styles");
        setTemplates([]);
      } finally {
        setIsLoading(false);
      }
    },
    // selectedTemplateId/onSelect intentionally omitted: load is called explicitly
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [platform]
  );

  useEffect(() => {
    load([]);
  }, [load]);

  const handleShuffle = () => {
    // don't pre-clear: load() drops the selection only if the chosen style isn't in
    // the new set, so shuffling a small pool that returns the same cards keeps the pick
    load(templates.map((t) => t.id));
  };

  // When no previews exist (e.g. a deploy without reference videos) let the user
  // proceed anyway — render falls back to the storyboard's default template.
  const noTemplates = !isLoading && !error && templates.length === 0;
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  // Styles flagged music_manual require the user to choose music before rendering.
  const needsMusic = !!selectedTemplate?.music_manual && !hasMusic;
  const canRender =
    !isStartingRender && (noTemplates || (!!selectedTemplateId && !needsMusic));

  return (
    <div className="w-full p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold text-[#EFEFEF]">Pick a style</h2>
        <p className="text-sm text-[#6B7C85] mt-1">
          Choose the montage you like most — we&apos;ll wrap your clips to match its
          pace and captions (roughly, not 1:1).
        </p>

        {selectedTemplateId && needsMusic ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#10B981]/30 bg-[#10B981]/5 px-3 py-2 text-xs">
            <Music className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
            <span className="min-w-0 flex-1 text-[#EFEFEF]">
              This style needs music — pick a track from the library or upload your own.
            </span>
            {onChangeMusic && (
              <button
                type="button"
                onClick={onChangeMusic}
                className="ml-auto shrink-0 font-medium text-[#10B981] hover:text-[#12cf90] hover:underline"
              >
                Choose music
              </button>
            )}
          </div>
        ) : (
          selectedTemplateId && musicLabel && (
            <div className="mt-3 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl sm:rounded-full border border-[#152226] bg-[#0D1416] px-3 py-1.5 text-xs">
              <Music className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
              <span className="text-[#EFEFEF] font-medium truncate max-w-[180px] sm:max-w-none">{musicLabel}</span>
              <span className="text-[#6B7C85]">
                {musicIsCustom ? "· your pick" : "· matched to this style"}
              </span>
              {onChangeMusic && (
                <button
                  type="button"
                  onClick={onChangeMusic}
                  className="text-[#10B981] hover:text-[#12cf90] hover:underline"
                >
                  Change
                </button>
              )}
            </div>
          )
        )}

        {error && (
          <div className="mt-6 rounded-xl bg-[#0D1416] border border-[#152226] p-6 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button
              type="button"
              onClick={() => load([])}
              className="mt-4 px-4 py-2 bg-[#11191B] border border-[#152226] text-[#EFEFEF] rounded-lg text-sm hover:bg-[#152226]"
            >
              Try again
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="mt-10 flex flex-col items-center justify-center py-10">
            <Loader2 className="w-7 h-7 text-[#10B981] animate-spin" />
            <p className="text-sm text-[#6B7C85] mt-3">Loading styles…</p>
          </div>
        ) : (
          !error && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {templates.map((t, idx) => {
                const wip = !!t.wip;
                const isSelected = !wip && t.id === selectedTemplateId;
                const cut = t.pacing?.target_cut_len;
                const bpm = t.measured?.bpm;
                return (
                  <motion.button
                    type="button"
                    key={t.id}
                    disabled={wip}
                    aria-disabled={wip}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06, duration: 0.25 }}
                    onClick={() => {
                      if (wip) return; // in development — not selectable yet
                      onSelect(t.id, t.recommended_track, t.music_manual);
                    }}
                    className={`group relative text-left rounded-xl overflow-hidden border transition-all ${
                      wip
                        ? "border-[#152226] cursor-not-allowed"
                        : isSelected
                          ? "border-[#10B981] shadow-[0_0_24px_rgba(16,185,129,0.22)]"
                          : "border-[#152226] hover:border-[#1E343A]"
                    }`}
                  >
                    <div className="relative aspect-[9/16] bg-[#070B0D]">
                      {t.preview_url ? (
                        <video
                          src={resolveBackendUrl(t.preview_url)}
                          className={`w-full h-full object-cover ${wip ? "opacity-40 grayscale" : ""}`}
                          muted
                          loop
                          autoPlay
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="w-7 h-7 text-[#1E343A]" />
                        </div>
                      )}

                      {wip && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#070B0D]/45">
                          <span className="px-3 py-1.5 rounded-full bg-[#1C1C1C]/90 border border-[#3A4A50] text-[11px] font-semibold uppercase tracking-wider text-[#EFEFEF] shadow-lg">
                            In development
                          </span>
                        </div>
                      )}

                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#10B981] flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" strokeWidth={3} />
                        </div>
                      )}

                      {/* meta overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/25 px-2 py-0.5 rounded-full">
                            {prettyGrade(t.color_grade)}
                          </span>
                          {cut != null && (
                            <span className="text-[10px] text-[#C8D2D6] bg-black/40 border border-[#152226] px-2 py-0.5 rounded-full font-mono">
                              {cut}s/cut
                            </span>
                          )}
                          {bpm != null && (
                            <span className="text-[10px] text-[#C8D2D6] bg-black/40 border border-[#152226] px-2 py-0.5 rounded-full font-mono">
                              {Math.round(bpm)} bpm
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )
        )}

        {noTemplates && (
          <div className="mt-6 rounded-xl bg-[#0D1416] border border-[#152226] p-6 text-center">
            <p className="text-sm text-[#6B7C85]">
              No style previews available right now — we&apos;ll use the default look.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onBack}
            className="sm:w-auto flex items-center justify-center gap-1.5 py-3 px-4 bg-[#0D1416] border border-[#152226] text-[#6B7C85] rounded-lg text-sm hover:text-[#EFEFEF] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            type="button"
            onClick={handleShuffle}
            disabled={isLoading || isStartingRender}
            className="sm:flex-1 flex items-center justify-center gap-2 py-3 bg-[#0D1416] border border-[#152226] text-[#EFEFEF] rounded-lg text-sm font-medium hover:bg-[#11191B] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Show other styles
          </button>
          <button
            type="button"
            onClick={onRender}
            disabled={!canRender}
            className={`sm:flex-1 py-3 rounded-lg text-sm font-medium transition-colors ${
              canRender
                ? "bg-[#10B981] text-white hover:bg-[#12cf90]"
                : "bg-[#152226] text-[#3A4A50] cursor-not-allowed"
            }`}
          >
            {isStartingRender ? "Starting…" : "Render with this style →"}
          </button>
        </div>
      </div>
    </div>
  );
}
