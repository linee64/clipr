"use client";

import React, { useState } from "react";
import { ArrowDown, Camera, Loader2 } from "lucide-react";
import type { Scene, VisualScriptResponse } from "@/lib/types";

interface StoryboardStepProps {
  visualScript: VisualScriptResponse | null;
  isLoading: boolean;
  error: string | null;
  onPhraseEdit: (order: number, phrase: string) => void;
  onRegenerate: () => void;
  onContinue: () => void;
}

function roleBadgeClass(role: string): string {
  if (role === "hook" || role === "punch") return "text-[#10B981]";
  return "text-[#888888]";
}

export function StoryboardStep({
  visualScript,
  isLoading,
  error,
  onPhraseEdit,
  onRegenerate,
  onContinue,
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
        <p className="text-sm text-[#888888] mt-4">Building your storyboard...</p>
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
          className="mt-4 px-4 py-2 bg-[#242424] border border-[#333333] text-[#EFEFEF] rounded-lg text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!visualScript) return null;

  const scenes = [...visualScript.scenes].sort((a, b) => a.order - b.order);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold text-[#EFEFEF]">Your storyboard</h2>
        <p className="text-sm text-[#888888] mt-1">Film these scenes in order</p>

        <div className="mt-6 space-y-0">
          {scenes.map((scene: Scene, idx: number) => (
            <div key={scene.order}>
              <div className="bg-[#242424] border border-[#333333] rounded-xl p-5">
                <div className="flex gap-4">
                  <div className="w-[60%]">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-[#333333] text-[#EFEFEF] text-sm font-medium flex items-center justify-center">
                        {scene.order}
                      </span>
                      <span
                        className={`text-xs tracking-widest uppercase font-semibold ${roleBadgeClass(scene.role)}`}
                      >
                        {scene.role}
                      </span>
                    </div>

                    {editingOrder === scene.order ? (
                      <input
                        autoFocus
                        value={scene.phrase}
                        onChange={(e) => onPhraseEdit(scene.order, e.target.value)}
                        onBlur={() => setEditingOrder(null)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingOrder(null)}
                        className="w-full mt-3 text-xl font-semibold text-[#EFEFEF] bg-[#1a1a1a] border border-[#444] rounded-lg px-3 py-2 outline-none focus:border-[#10B981]"
                      />
                    ) : (
                      <p
                        role="button"
                        tabIndex={0}
                        onClick={() => setEditingOrder(scene.order)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingOrder(scene.order)}
                        className="text-xl font-semibold text-[#EFEFEF] mt-3 cursor-text hover:opacity-80"
                      >
                        {scene.phrase}
                      </p>
                    )}

                    <p className="text-xs text-[#888888] mt-2">
                      {scene.duration_seconds} seconds
                    </p>
                  </div>

                  <div className="w-[40%] border-l border-[#333333] pl-4">
                    <p className="text-xs tracking-widest text-[#888888] uppercase">
                      What to film
                    </p>
                    <p className="text-sm text-[#EFEFEF] mt-1">{scene.film_suggestion}</p>
                    <Camera className="w-4 h-4 text-[#888888] mt-2" />
                  </div>
                </div>
              </div>

              {idx < scenes.length - 1 && (
                <div className="flex justify-center py-2">
                  <ArrowDown className="w-4 h-4 text-[#333333]" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-xs text-[#888888]">Music vibe: </span>
            <span className="text-[#EFEFEF]">{visualScript.music_vibe}</span>
          </div>
          <div>
            <span className="text-xs text-[#888888]">Color grade: </span>
            <span className="text-[#EFEFEF]">{visualScript.color_grade}</span>
          </div>
          <div>
            <span className="text-xs text-[#888888]">Total duration: </span>
            <span className="text-[#EFEFEF]">~{totalDuration} seconds</span>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onRegenerate}
            className="flex-1 py-3 bg-[#242424] border border-[#333333] text-[#EFEFEF] rounded-lg text-sm font-medium hover:bg-[#2a2a2a] transition-colors"
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
