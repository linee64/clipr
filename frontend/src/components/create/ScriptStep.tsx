"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, PlayCircle } from "lucide-react";
import type { ScriptResponse, ScriptVariantKey } from "@/lib/types";
import {
  SECTION_META,
  VARIANT_TABS,
  countWords,
  estimateSeconds,
  getVariant,
  type ScriptSection,
} from "./scriptUtils";

interface ScriptStepProps {
  ideaTitle: string;
  ideaHook: string;
  platform: string;
  format: string;
  scriptData: ScriptResponse | null;
  isLoading: boolean;
  error: string | null;
  selectedVariant: ScriptVariantKey;
  onVariantChange: (v: ScriptVariantKey) => void;
  editedScripts: ScriptResponse | null;
  onScriptEdit: (variant: ScriptVariantKey, section: ScriptSection, value: string) => void;
  onBrowseReferences: () => void;
  onSkipToUpload: () => void;
  onScriptSaved?: () => void;
}

function EditableSection({
  section,
  value,
  original,
  onChange,
  textSize,
}: {
  section: ScriptSection;
  value: string;
  original: string;
  onChange: (v: string) => void;
  textSize: "base" | "sm";
}) {
  const meta = SECTION_META[section];
  const ref = useRef<HTMLDivElement>(null);
  const isEdited = value.trim() !== original.trim();

  useEffect(() => {
    if (ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value;
    }
  }, [value]);

  const borderColor =
    meta.accent === "green" ? "border-[#10B981]" : "border-[#333333]";

  return (
    <div className={`py-4 border-l-2 ${borderColor} pl-4`}>
      <div className="flex items-center gap-1 mb-2">
        <span className="text-xs tracking-widest text-[#888888]">{meta.label}</span>
        <span className="text-xs text-[#555555] ml-1">{meta.timing}</span>
        {isEdited && (
          <span
            className="w-[3px] h-[3px] rounded-full bg-[#10B981] ml-1"
            title="Edited"
          />
        )}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.textContent ?? "")}
        onFocus={(e) => {
          if (!e.currentTarget.textContent?.trim()) {
            e.currentTarget.textContent = "";
          }
        }}
        data-placeholder={`Enter ${meta.label.toLowerCase()}...`}
        className={`script-editable outline-none leading-relaxed text-[#EFEFEF] ${
          textSize === "base" ? "text-base" : "text-sm"
        } empty:before:content-[attr(data-placeholder)] empty:before:text-[#555555]`}
      />
    </div>
  );
}

export function ScriptStep({
  ideaTitle,
  platform,
  format,
  scriptData,
  isLoading,
  error,
  selectedVariant,
  onVariantChange,
  editedScripts,
  onScriptEdit,
  onBrowseReferences,
  onSkipToUpload,
  onScriptSaved,
}: ScriptStepProps) {
  const [savedFlash, setSavedFlash] = useState(false);
  const originalRef = useRef<ScriptResponse | null>(null);

  useEffect(() => {
    if (scriptData && !originalRef.current) {
      originalRef.current = JSON.parse(JSON.stringify(scriptData));
    }
  }, [scriptData]);

  const activeVariant = editedScripts
    ? editedScripts[selectedVariant]
    : getVariant(scriptData, selectedVariant);

  const originalVariant = originalRef.current?.[selectedVariant];

  const wordCount = activeVariant ? countWords(activeVariant) : 0;
  const secEstimate = estimateSeconds(wordCount);

  const handleSave = useCallback(() => {
    if (!editedScripts) return;
    localStorage.setItem(`clipr_script_${ideaTitle}`, JSON.stringify(editedScripts));
    onScriptSaved?.();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }, [editedScripts, ideaTitle, onScriptSaved]);

  const updateSection = useCallback(
    (section: ScriptSection, value: string) => {
      onScriptEdit(selectedVariant, section, value);
    },
    [onScriptEdit, selectedVariant]
  );

  const tabClass = (key: ScriptVariantKey) =>
    `text-sm pb-2 border-b-2 transition-colors ${
      selectedVariant === key
        ? "text-[#EFEFEF] border-[#10B981]"
        : "text-[#888888] border-transparent hover:text-[#EFEFEF]"
    }`;

  const loadingMessages = useMemo(
    () => [
      "generating...",
      "structuring hook...",
      "writing problem & solution...",
      "finalizing variants...",
    ],
    []
  );
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (!isLoading) return;
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % loadingMessages.length), 850);
    return () => clearInterval(t);
  }, [isLoading, loadingMessages.length]);

  return (
    <div className="flex gap-6 flex-1 min-h-0 overflow-hidden p-6">
      <div className="w-[60%] flex flex-col min-h-0 overflow-hidden">
        <div className="flex gap-6 border-b border-[#333333] mb-4 shrink-0">
          {VARIANT_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onVariantChange(tab.key)}
              className={tabClass(tab.key)}
              disabled={isLoading}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
          <div className="bg-[#242424] border border-[#333333] rounded-xl p-6">
            {isLoading && (
              <div className="py-12 text-center space-y-3">
                <div className="w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-[#888888] font-mono">
                  {loadingMessages[msgIdx]}
                </p>
              </div>
            )}

            {!isLoading && error && (
              <div className="mb-4 text-sm text-red-400 bg-red-950/20 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {!isLoading && activeVariant && originalVariant && (
              <>
                <EditableSection
                  section="hook"
                  value={activeVariant.hook}
                  original={originalVariant.hook}
                  onChange={(v) => updateSection("hook", v)}
                  textSize="base"
                />
                <div className="border-t border-[#333333]" />
                <EditableSection
                  section="problem"
                  value={activeVariant.problem}
                  original={originalVariant.problem}
                  onChange={(v) => updateSection("problem", v)}
                  textSize="sm"
                />
                <div className="border-t border-[#333333]" />
                <EditableSection
                  section="solution"
                  value={activeVariant.solution}
                  original={originalVariant.solution}
                  onChange={(v) => updateSection("solution", v)}
                  textSize="sm"
                />
                <div className="border-t border-[#333333]" />
                <EditableSection
                  section="cta"
                  value={activeVariant.cta}
                  original={originalVariant.cta}
                  onChange={(v) => updateSection("cta", v)}
                  textSize="sm"
                />
              </>
            )}

            {!isLoading && !activeVariant && !error && (
              <p className="text-sm text-[#888888] py-8 text-center">
                Script could not be loaded.
              </p>
            )}
          </div>

          {activeVariant && !isLoading && (
            <p className="text-xs text-[#888888] mt-3">
              ~{wordCount} words · ~{secEstimate} sec
            </p>
          )}
        </div>
      </div>

      <div className="w-[40%] flex flex-col min-h-0 overflow-y-auto scrollbar-thin">
        <div className="bg-[#242424] border border-[#333333] rounded-xl p-5 mb-4">
          <p className="text-xs tracking-widest text-[#888888]">GENERATING FOR</p>
          <h3 className="text-base font-semibold text-[#EFEFEF] mt-2">{ideaTitle}</h3>
          <div className="flex gap-2 mt-3 flex-wrap">
            <span className="text-xs border border-[#333333] rounded-full px-2.5 py-0.5 text-[#888888]">
              {platform}
            </span>
            <span className="text-xs border border-[#333333] rounded-full px-2.5 py-0.5 text-[#888888]">
              {format}
            </span>
          </div>
        </div>

        <div className="bg-[#242424] border border-[#333333] rounded-xl p-5">
          <h4 className="text-sm font-medium text-[#EFEFEF] mb-4">Next steps</h4>
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!editedScripts || isLoading}
              className="w-full flex items-center gap-2 bg-[#2A2A2A] border border-[#333333] text-sm text-[#EFEFEF] rounded-lg py-2.5 px-4 hover:bg-[#333333] transition-colors disabled:opacity-50"
            >
              <Bookmark className="w-4 h-4 shrink-0" />
              <span>{savedFlash ? "Saved ✓" : "Save script"}</span>
            </button>
            <button
              type="button"
              onClick={onBrowseReferences}
              disabled={isLoading}
              className="w-full flex items-center gap-2 bg-[#2A2A2A] border border-[#333333] text-sm text-[#EFEFEF] rounded-lg py-2.5 px-4 hover:bg-[#333333] transition-colors disabled:opacity-50"
            >
              <PlayCircle className="w-4 h-4 shrink-0" />
              <span>Browse references</span>
            </button>
            <button
              type="button"
              onClick={onSkipToUpload}
              disabled={isLoading}
              className="w-full bg-[#10B981] text-white text-sm font-medium rounded-lg py-2.5 hover:bg-[#12cf90] transition-colors disabled:opacity-50"
            >
              Skip to upload →
            </button>
          </div>
          <p className="text-xs text-[#555555] mt-4">
            References help you understand the format before filming
          </p>
        </div>
      </div>
    </div>
  );
}
