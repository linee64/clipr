"use client";

import React, { useState } from "react";
import { ArrowDown, Camera, ChevronLeft, Clock, Loader2, Music, Palette } from "lucide-react";
import type { Scene, VisualScriptResponse } from "@/lib/types";

interface StoryboardStepProps {
  visualScript: VisualScriptResponse | null;
  isLoading: boolean;
  error: string | null;
  onPhraseEdit: (order: number, phrase: string) => void;
  onRegenerate: () => void;
  onContinue: () => void;
  onBack: () => void;
}

// Backend returns option lists like "dark ambient|lo-fi beats|...". Show the first, cleaned.
function cleanOption(value: string | undefined): string {
  return (value ?? "").split("|")[0].trim();
}
function prettyOption(value: string | undefined): string {
  return cleanOption(value).replace(/_/g, " ");
}

export function StoryboardStep({
  visualScript,
  isLoading,
  error,
  onPhraseEdit,
  onRegenerate,
  onContinue,
  onBack,
}: StoryboardStepProps) {
  const [editingOrder, setEditingOrder] = useState<number | null>(null);

  const totalDuration = visualScript?.scenes.reduce(
    (sum, s) => sum + s.duration_seconds,
    0
  ) ?? 0;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
        <p className="text-sm text-[#6B7C85] mt-4">Building your storyboard...</p>
      </div>
    );
  }

  if (error && !visualScript) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <p className="text-sm text-red-400">{error}</p>
        <button
          type="button"
          onClick={onRegenerate}
          className="mt-4 px-4 py-2 bg-[#0D1416] border border-[#152226] text-[#EFEFEF] rounded-lg text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!visualScript) return null;

  const scenes = [...visualScript.scenes].sort((a, b) => a.order - b.order);

  const stats = [
    { icon: Music, label: "Music vibe", value: cleanOption(visualScript.music_vibe) },
    { icon: Palette, label: "Color grade", value: prettyOption(visualScript.color_grade) },
    { icon: Clock, label: "Total duration", value: `~${totalDuration}s` },
  ];

  return (
    <div className="w-full p-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold text-[#EFEFEF]">Your storyboard</h2>
        <p className="text-sm text-[#6B7C85] mt-1">Film these scenes in order</p>

        <div className="mt-6 space-y-0">
          {scenes.map((scene: Scene, idx: number) => {
            const isAccent = scene.role === "hook" || scene.role === "punch";
            return (
              <div key={scene.order}>
                <div className="bg-[#0D1416] border border-[#152226] rounded-xl p-5 transition-colors hover:border-[#1E343A]">
                  {/* Header: number + role + duration */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-[#152226] text-[#EFEFEF] text-sm font-medium flex items-center justify-center shrink-0">
                        {scene.order}
                      </span>
                      <span
                        className={`text-[10px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-full border ${
                          isAccent
                            ? "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/25"
                            : "text-[#6B7C85] bg-[#11191B] border-[#152226]"
                        }`}
                      >
                        {scene.role}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] text-[#6B7C85] font-mono bg-[#070B0D] border border-[#152226] px-2 py-0.5 rounded-full shrink-0">
                      <Clock className="w-3 h-3" />
                      {scene.duration_seconds}s
                    </span>
                  </div>

                  {/* On-screen phrase (editable) */}
                  {editingOrder === scene.order ? (
                    <input
                      autoFocus
                      value={scene.phrase}
                      onChange={(e) => onPhraseEdit(scene.order, e.target.value)}
                      onBlur={() => setEditingOrder(null)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingOrder(null)}
                      className="w-full mt-3 text-xl font-semibold text-[#EFEFEF] bg-[#070B0D] border border-[#152226] rounded-lg px-3 py-2 outline-none focus:border-[#10B981]"
                    />
                  ) : (
                    <p
                      role="button"
                      tabIndex={0}
                      onClick={() => setEditingOrder(scene.order)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingOrder(scene.order)}
                      className="text-xl font-semibold text-[#EFEFEF] mt-3 cursor-text hover:opacity-80"
                      title="Click to edit the on-screen text"
                    >
                      {scene.phrase}
                    </p>
                  )}

                  {/* What to film panel */}
                  <div className="mt-4 rounded-lg bg-[#070B0D] border border-[#152226] p-3.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Camera className="w-3.5 h-3.5 text-[#10B981]" />
                      <span className="text-[10px] tracking-widest text-[#6B7C85] uppercase font-bold">
                        What to film
                      </span>
                    </div>
                    <p className="text-sm text-[#EFEFEF] leading-relaxed">
                      {scene.film_suggestion}
                    </p>
                  </div>
                </div>

                {idx < scenes.length - 1 && (
                  <div className="flex justify-center py-2">
                    <ArrowDown className="w-4 h-4 text-[#1E343A]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Production details */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl bg-[#0D1416] border border-[#152226] px-4 py-3"
            >
              <div className="w-8 h-8 rounded-lg bg-[#11191B] border border-[#152226] flex items-center justify-center text-[#10B981] shrink-0">
                <stat.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-[#6B7C85] font-mono">
                  {stat.label}
                </p>
                <p className="text-sm text-[#EFEFEF] font-medium truncate capitalize">
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>

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
            onClick={onRegenerate}
            className="flex-1 py-3 bg-[#0D1416] border border-[#152226] text-[#EFEFEF] rounded-lg text-sm font-medium hover:bg-[#11191B] transition-colors"
          >
            Regenerate storyboard
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 py-3 bg-[#10B981] text-white rounded-lg text-sm font-medium hover:bg-[#12cf90] transition-colors"
          >
            I filmed these →
          </button>
        </div>
      </div>
    </div>
  );
}
