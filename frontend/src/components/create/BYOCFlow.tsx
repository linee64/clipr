"use client";

import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  ChevronLeft,
  Upload,
  FileText,
  Check,
  AlertCircle,
  Sparkles,
  Loader2,
  Film,
  Link2,

  X,
  Type,
} from "lucide-react";
import {
  uploadBYOCClip,
  startBYOCCreate,
  getRenderStatus,
  analyzeReferenceVideo,
  importPexelsClip,
  generateBYOCScript,
  transcribeMusicFromRef,
} from "@/lib/api";
import type { RenderStatus, PexelsVideo } from "@/lib/types";
import { RenderStep } from "./RenderStep";
import { PexelsSearchModal } from "./PexelsSearchModal";
import { motion } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Props & Types                                                      */
/* ------------------------------------------------------------------ */

interface BYOCFlowProps {
  onBack: () => void;
  onSchedulePost: (payload: {
    title: string;
    description: string;
    outputUrl: string;
    platform: string;
  }) => void;
  isPro: boolean;
  onRequireUpgrade: () => void;
  videosLeft: number;
  videosLimit: number;
  videosUnlimited?: boolean;
  onUsageRefresh: () => void;
}

interface ClipSlot {
  clipId?: string;
  previewUrl?: string;
  name?: string;
  progress?: number;
  error?: string;
  source?: "upload" | "pexels";
}

const DEFAULT_SHOTS = [
  "aesthetic desk workspace",
  "close-up hands typing keyboard",
  "phone screen dim light",
  "person coding focus mode",
  "coffee cup steam cinematic",
  "wide shot evening office",
  "writing notes in journal",
  "reaction face smile nod",
  "screen recording code editor",
  "cinematic blurred background",
];

const MAX_SLOTS = 6;

/* ------------------------------------------------------------------ */
/*  Step Indicator (BYOC-specific, 4 steps)                            */
/* ------------------------------------------------------------------ */

type BYOCStep = 1 | 2 | 3 | 4;
const BYOC_STEPS = [
  { num: 1, label: "Референс" },
  { num: 2, label: "Клипы" },
  { num: 3, label: "Сценарий" },
  { num: 4, label: "Рендер" },
] as const;

const MONO =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

function BYOCStepIndicator({ currentStep }: { currentStep: BYOCStep }) {
  const progress = (currentStep - 1) / (BYOC_STEPS.length - 1);

  return (
    <div className="shrink-0 border-b border-[#152226]/80 bg-zinc-950/45 backdrop-blur-md px-3 sm:px-8 py-4 sm:py-5 shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
      <div className="relative mx-auto max-w-xl">
        {/* Rail */}
        <div
          className="pointer-events-none absolute inset-x-[12.5%] top-0 flex h-7 items-center"
          aria-hidden
        >
          <div className="relative h-[2px] w-full bg-[#152226]">
            <motion.div
              className="absolute inset-y-0 left-0 bg-[#10B981]"
              style={{ boxShadow: "0 0 14px rgba(16,185,129,0.65)" }}
              initial={false}
              animate={{ width: `${progress * 100}%` }}
              transition={{ type: "spring", stiffness: 180, damping: 28 }}
            />
          </div>
        </div>

        {/* Dots */}
        <div className="relative grid grid-cols-4">
          {BYOC_STEPS.map((step) => {
            const state =
              step.num === currentStep
                ? "active"
                : step.num < currentStep
                  ? "completed"
                  : "inactive";
            return (
              <div key={step.num} className="flex min-w-0 flex-col items-center group">
                <div className="flex h-7 items-center justify-center">
                  {state === "completed" ? (
                    <div
                      className="relative z-10 flex items-center justify-center rounded-full bg-[#10B981] text-[#070B0D] shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                      style={{ width: 22, height: 22 }}
                    >
                      <Check className="h-3 w-3" strokeWidth={3.5} />
                    </div>
                  ) : state === "active" ? (
                    <div className="relative z-10 flex h-8 w-8 items-center justify-center">
                      <motion.span
                        aria-hidden
                        className="absolute inset-0 rounded-full"
                        style={{
                          border: "2.5px solid #10B981",
                          boxShadow: "0 0 16px rgba(16,185,129,0.35)",
                        }}
                        initial={false}
                        animate={{ scale: [0.85, 1.1, 0.85], opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <span
                        className="relative h-3 w-3 rounded-full bg-[#10B981]"
                        style={{ boxShadow: "0 0 14px rgba(0,229,160,0.7)" }}
                      />
                    </div>
                  ) : (
                    <div className="relative z-10 flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[#070B0D] border-2 border-[#152226] group-hover:border-[#53656F]/50 transition-colors duration-200">
                      <span
                        className="text-[9px] font-bold leading-none"
                        style={{ fontFamily: MONO, color: "#53656F" }}
                      >
                        {step.num}
                      </span>
                    </div>
                  )}
                </div>
                <span
                  className="mt-2 sm:mt-3 block max-w-full truncate px-0.5 sm:px-1 text-[9px] sm:text-[10px] uppercase font-bold tracking-[0.04em] sm:tracking-[0.15em] transition-all duration-300"
                  style={{
                    fontFamily: MONO,
                    color:
                      state === "active"
                        ? "#10B981"
                        : state === "completed"
                          ? "#A3B3BC"
                          : "#53656F",
                    textShadow: state === "active" ? "0 0 8px rgba(16,185,129,0.25)" : "none",
                  }}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function BYOCFlow({
  onBack,
  onSchedulePost,
  onUsageRefresh,
}: BYOCFlowProps) {
  const [currentStep, setCurrentStep] = useState<BYOCStep>(1);
  const [userId] = useState(() => localStorage.getItem("clipr_email") || "anonymous");
  const [sessionId] = useState(() => uuidv4());

  /* -- Step 1: Reference Video -- */
  const [refUrl, setRefUrl] = useState("");
  const [, setRefFile] = useState<File | null>(null);
  const [isAnalyzingRef, setIsAnalyzingRef] = useState(false);
  const [analyzedRefTemplate, setAnalyzedRefTemplate] = useState<{
    id: string;
    label: string;
    recommended_track: string;
    audio_url: string;
    scene_count: number;
    ref_subtitles?: string[];
    avg_words_per_line?: number;
    subtitle_pattern?: {
      type: "single" | "two_field";
      static_line: string | null;
      static_position: "top" | "bottom" | null;
      dynamic_samples: string[];
    };
    scene_contexts?: string[];
    exact_timings?: number[];
  } | null>(null);
  const [refAnalysisError, setRefAnalysisError] = useState<string | null>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);

  /* -- Step 2: Upload Clips -- */
  const [uploadedClips, setUploadedClips] = useState<Record<number, ClipSlot>>({});
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [pexelsScene, setPexelsScene] = useState<number | null>(null);
  const [isUploadingSlot, setIsUploadingSlot] = useState<Record<number, boolean>>({});

  /* -- Step 3: Script & Subtitles -- */
  const [scriptContext, setScriptContext] = useState("");
  const [editedStaticLine, setEditedStaticLine] = useState<string | undefined>(undefined);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [script, setScript] = useState("");
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [srtContent, setSrtContent] = useState<string | null>(null);
  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const srtInputRef = useRef<HTMLInputElement>(null);
  const [platform, setPlatform] = useState<"TikTok" | "LinkedIn" | "Reels">("TikTok");
  const [scriptGenError, setScriptGenError] = useState<string | null>(null);
  const [isTranscribingMusic, setIsTranscribingMusic] = useState(false);

  /* -- Step 4: Render -- */
  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isStartingRender, setIsStartingRender] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* -- Render polling -- */
  useEffect(() => {
    if (!renderJobId) return;

    let failures = 0;
    const poll = async () => {
      try {
        const status = await getRenderStatus(renderJobId);
        failures = 0;
        setRenderStatus(status);
        if (status.status === "done") {
          onUsageRefresh();
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        }
        if (status.status === "error") {
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        }
      } catch {
        failures += 1;
        if (failures >= 5) {
          setRenderError("Polling failed");
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        }
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 3000);

    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [renderJobId, onUsageRefresh]);

  /* ---------------------------------------------------------------- */
  /*  Handlers                                                         */
  /* ---------------------------------------------------------------- */

  const handleAnalyzeReference = async (file?: File) => {
    setIsAnalyzingRef(true);
    setRefAnalysisError(null);
    setAnalyzedRefTemplate(null);
    try {
      const email = localStorage.getItem("clipr_email") || "anonymous";
      const result = await analyzeReferenceVideo(email, file, refUrl || undefined);
      setAnalyzedRefTemplate(result.template);
      setUploadedClips({});
    } catch (err) {
      setRefAnalysisError(err instanceof Error ? err.message : "Не удалось проанализировать референс");
    } finally {
      setIsAnalyzingRef(false);
    }
  };

  const handleTranscribeMusic = async () => {
    if (!analyzedRefTemplate?.audio_url) return;
    setIsTranscribingMusic(true);
    try {
      const result = await transcribeMusicFromRef(analyzedRefTemplate.audio_url);
      if (result.script) setScript(result.script);
    } catch (err) {
      setScriptGenError(err instanceof Error ? err.message : "Ошибка транскрибации");
    } finally {
      setIsTranscribingMusic(false);
    }
  };

  const handleSlotFile = async (slotIdx: number, file: File) => {
    setIsUploadingSlot((prev) => ({ ...prev, [slotIdx]: true }));
    setUploadedClips((prev) => ({
      ...prev,
      [slotIdx]: { progress: 10, name: file.name },
    }));
    try {
      const result = await uploadBYOCClip(userId, sessionId, file);
      setUploadedClips((prev) => ({
        ...prev,
        [slotIdx]: { clipId: result.clip_id, previewUrl: result.url, name: file.name, progress: 100, source: "upload" },
      }));
    } catch (err) {
      setUploadedClips((prev) => ({
        ...prev,
        [slotIdx]: { progress: undefined, error: err instanceof Error ? err.message : "Upload failed", name: file.name },
      }));
    } finally {
      setIsUploadingSlot((prev) => ({ ...prev, [slotIdx]: false }));
    }
  };

  const handlePexelsImport = async (slotIdx: number, video: PexelsVideo) => {
    setIsUploadingSlot((prev) => ({ ...prev, [slotIdx]: true }));
    setUploadedClips((prev) => ({
      ...prev,
      [slotIdx]: { progress: 20, name: "Импорт из Pexels..." },
    }));
    try {
      const result = await importPexelsClip(video.id);
      setUploadedClips((prev) => ({
        ...prev,
        [slotIdx]: { clipId: result.clip_id, previewUrl: result.url, name: `Pexels #${video.id}`, progress: 100, source: "pexels" },
      }));
    } catch (err) {
      setUploadedClips((prev) => ({
        ...prev,
        [slotIdx]: { progress: undefined, error: err instanceof Error ? err.message : "Import failed", name: "Ошибка" },
      }));
    } finally {
      setIsUploadingSlot((prev) => ({ ...prev, [slotIdx]: false }));
      setPexelsScene(null);
    }
  };

  const removeSlotClip = (slotIdx: number) => {
    setUploadedClips((prev) => {
      const copy = { ...prev };
      delete copy[slotIdx];
      return copy;
    });
  };

  const slotCount = Math.min(analyzedRefTemplate?.scene_count || 5, MAX_SLOTS);

  const checkAllSlotsUploaded = () => {
    if (!analyzedRefTemplate) return false;
    for (let i = 1; i <= slotCount; i++) {
      if (!uploadedClips[i]?.clipId) return false;
    }
    return true;
  };

  const handleGenerateScript = async () => {
    if (!scriptContext || !analyzedRefTemplate) return;
    setIsGeneratingScript(true);
    setScriptGenError(null);
    try {
      const payload: Parameters<typeof generateBYOCScript>[0] = {
        context: scriptContext,
        scene_count: analyzedRefTemplate.scene_count,
        ref_subtitles: analyzedRefTemplate.ref_subtitles,
        avg_words_per_line: analyzedRefTemplate.avg_words_per_line,
        subtitle_pattern: analyzedRefTemplate.subtitle_pattern ? {
          type: analyzedRefTemplate.subtitle_pattern.type,
          static_line: analyzedRefTemplate.subtitle_pattern.static_line,
          static_position: analyzedRefTemplate.subtitle_pattern.static_position,
          dynamic_samples: analyzedRefTemplate.subtitle_pattern.dynamic_samples,
        } : undefined,
        scene_contexts: analyzedRefTemplate.scene_contexts,
      };

      // If user edited the static line, override it for the generator
      if (
        analyzedRefTemplate.subtitle_pattern?.type === "two_field" &&
        editedStaticLine !== undefined
      ) {
        payload.subtitle_pattern = {
          ...analyzedRefTemplate.subtitle_pattern,
          static_line: editedStaticLine,
        };
      }

      const res = await generateBYOCScript(payload);
      
      // If two_field, format the JSON to display nicely in the textarea
      if (res.script.startsWith("{") && res.script.includes('"pattern_type"')) {
        try {
          const parsed = JSON.parse(res.script);
          if (parsed.pattern_type === "two_field" && parsed.lines) {
            // Keep the raw JSON in state so it passes to the renderer,
            // but for UI we might want to just show it raw for now since the renderer
            // parses it from the scene phrase.
            setScript(res.script);
            return;
          }
        } catch {
          // fallback
        }
      }
      setScript(res.script);
      setScript(res.script);
    } catch (err) {
      setScriptGenError(err instanceof Error ? err.message : "Ошибка генерации");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleSrtSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSrtFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) setSrtContent(event.target.result as string);
      };
      reader.readAsText(file);
    }
  };

  const triggerRender = async () => {
    if (!analyzedRefTemplate) return;
    setIsStartingRender(true);
    setRenderError(null);
    setRenderStatus(null);
    setCurrentStep(4);

    try {
      // Collect only the unique clip_ids we actually uploaded (max 6)
      const clipIds: string[] = [];
      for (let i = 1; i <= slotCount; i++) {
        const cid = uploadedClips[i]?.clipId;
        if (cid) clipIds.push(cid);
      }
      const jobId = uuidv4();

      await startBYOCCreate({
        job_id: jobId,
        clip_ids: clipIds,
        script: script,
        subtitles_file: srtContent,
        burn_subtitles: burnSubtitles,
        template_id: analyzedRefTemplate.id,
        platform: platform,
      });

      setRenderJobId(jobId);
      setRenderStatus({
        job_id: jobId,
        status: "pending",
        progress: 0,
        output_url: "",
        description: "",
        error: "",
      });
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : "Render failed to start");
    } finally {
      setIsStartingRender(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  const filledCount = Object.values(uploadedClips).filter((c) => c.clipId).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin bg-[#070B0D] text-[#EFEFEF]">
      {/* Pexels Modal */}
      {pexelsScene !== null && (
        <PexelsSearchModal
          initialQuery={
            (analyzedRefTemplate?.scene_contexts && analyzedRefTemplate.scene_contexts[pexelsScene - 1]) ||
            DEFAULT_SHOTS[(pexelsScene - 1) % DEFAULT_SHOTS.length]
          }
          subtitle={
            (analyzedRefTemplate?.ref_subtitles && analyzedRefTemplate.ref_subtitles[pexelsScene - 1]) ||
            ""
          }
          onImport={(video) => handlePexelsImport(pexelsScene, video)}
          onClose={() => setPexelsScene(null)}
        />
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#152226] shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-[#6B7C85] hover:text-[#EFEFEF] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Назад в Dashboard
        </button>
        <span className="text-[10px] uppercase font-mono tracking-widest text-[#53656F]">
          My Clips
        </span>
      </div>

      {/* Step Indicator */}
      <BYOCStepIndicator currentStep={currentStep} />

      {/* ============================================================= */}
      {/*  STEP 1 — Reference                                            */}
      {/* ============================================================= */}
      {currentStep === 1 && (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-3xl mx-auto w-full">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Загрузите ваш референс</h2>
              <p className="text-xs text-[#6B7C85] mt-1">
                Вставьте ссылку на Reels / TikTok или загрузите видеофайл. Clipr извлечёт музыку, темп и переходы.
              </p>
            </div>

            <div className="bg-[#0D1416]/60 p-5 border border-[#152226] rounded-2xl space-y-4">
              {/* URL input + buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#53656F]" />
                  <input
                    type="text"
                    placeholder="https://www.instagram.com/reel/..."
                    value={refUrl}
                    onChange={(e) => setRefUrl(e.target.value)}
                    className="w-full bg-[#070B0D] text-[#EFEFEF] border border-[#152226] focus:border-[#10B981]/50 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none placeholder:text-[#3A4A50] transition-colors"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={isAnalyzingRef || !refUrl.trim()}
                    onClick={() => handleAnalyzeReference()}
                    className="bg-[#10B981] hover:bg-[#12cf90] text-[#070B0D] font-bold text-xs px-5 py-2.5 rounded-xl disabled:opacity-50 transition-all flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {isAnalyzingRef && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Анализировать
                  </button>

                  <input
                    type="file"
                    ref={refFileInputRef}
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setRefFile(file); handleAnalyzeReference(file); }
                    }}
                  />
                  <button
                    type="button"
                    disabled={isAnalyzingRef}
                    onClick={() => refFileInputRef.current?.click()}
                    className="bg-[#152226] hover:bg-[#1f3137] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Файл
                  </button>
                </div>
              </div>

              {/* Loading */}
              {isAnalyzingRef && (
                <div className="text-xs text-[#10B981] flex items-center gap-2 animate-pulse pt-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Анализируем референс… Извлечение музыки, нарезка кадров, распознавание стилей.
                </div>
              )}

              {/* Error */}
              {refAnalysisError && (
                <div className="text-xs text-[#EF8B8B] flex items-center gap-1.5 bg-[#EF8B8B]/5 border border-[#EF8B8B]/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{refAnalysisError}</span>
                </div>
              )}

              {/* Success */}
              {analyzedRefTemplate && (
                <div className="bg-[#10B981]/5 border border-[#10B981]/20 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Check className="w-4 h-4 text-[#10B981] stroke-[3]" />
                    <span className="font-bold text-white">Референс импортирован!</span>
                  </div>
                  <p className="text-[11px] text-[#6B7C85] ml-6">
                    Обнаружено <strong className="text-[#A3B3BC]">{analyzedRefTemplate.scene_count}</strong> переходов • Музыка извлечена • Стиль определён
                  </p>
                  
                  {/* Pattern Display */}
                  {analyzedRefTemplate.subtitle_pattern?.type === "two_field" && (
                    <div className="ml-6 bg-[#070B0D]/50 border border-[#152226] p-3 rounded-lg mt-2">
                      <div className="text-[10px] uppercase font-bold text-[#53656F] mb-1.5 flex items-center gap-1.5">
                        <Type className="w-3 h-3" />
                        Паттерн субтитров
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-start gap-2">
                          <span className="text-[#6B7C85] w-20 shrink-0">Динамика:</span>
                          <span className="text-[#10B981] font-medium break-words">
                            {analyzedRefTemplate.subtitle_pattern.dynamic_samples.slice(0, 5).join(", ")}
                            {analyzedRefTemplate.subtitle_pattern.dynamic_samples.length > 5 && "..."}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-[#6B7C85] w-20 shrink-0">Статика:</span>
                          <span className="text-white font-medium bg-[#152226] px-1.5 py-0.5 rounded">
                            {analyzedRefTemplate.subtitle_pattern.static_line}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Scene Contexts from Gemini Vision */}
                  {analyzedRefTemplate.scene_contexts && analyzedRefTemplate.scene_contexts.filter(Boolean).length > 0 && (
                    <div className="ml-6 bg-[#070B0D]/50 border border-[#152226] p-3 rounded-lg mt-2">
                      <div className="text-[10px] uppercase font-bold text-[#53656F] mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-[#A78BFA]" />
                        <span className="text-[#A78BFA]">AI анализ сцен</span>
                      </div>
                      <div className="space-y-1.5">
                        {analyzedRefTemplate.scene_contexts.map((ctx, i) => (
                          ctx ? (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <span className="shrink-0 w-5 h-5 rounded-full bg-[#152226] text-[#53656F] text-[9px] font-bold flex items-center justify-center mt-0.5">
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="text-[#EFEFEF] leading-relaxed">{ctx}</span>
                                {analyzedRefTemplate.exact_timings?.[i] && (
                                  <span className="ml-2 text-[#53656F] font-mono text-[10px]">
                                    {analyzedRefTemplate.exact_timings[i].toFixed(1)}с
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : null
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Continue */}
            <div className="flex justify-end pt-2">
              <button
                disabled={!analyzedRefTemplate}
                onClick={() => setCurrentStep(2)}
                className="bg-[#10B981] hover:bg-[#12cf90] text-[#070B0D] font-bold text-sm px-6 py-2.5 rounded-full disabled:opacity-50 transition-all"
              >
                Продолжить →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/*  STEP 2 — Upload Clips                                         */}
      {/* ============================================================= */}
      {currentStep === 2 && (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-3xl mx-auto w-full">
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Загрузите ваши клипы</h2>
              <p className="text-xs text-[#6B7C85] mt-1">
                Референс содержит <strong className="text-[#A3B3BC]">{analyzedRefTemplate?.scene_count ?? 0}</strong> переходов.
                Загрузите <strong className="text-white">{slotCount}</strong> основных клипов — они зациклятся автоматически.
              </p>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-[#152226] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#10B981] transition-all duration-500 rounded-full"
                  style={{ width: `${(filledCount / slotCount) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-[#6B7C85]">{filledCount}/{slotCount}</span>
            </div>

            {/* Slot list */}
            <div className="space-y-3">
              {Array.from({ length: slotCount }).map((_, idx) => {
                const slotIdx = idx + 1;
                const uploaded = uploadedClips[slotIdx];
                const inputId = `slot-input-${slotIdx}`;
                const suggestedQuery = (analyzedRefTemplate?.scene_contexts && analyzedRefTemplate.scene_contexts[idx]) || DEFAULT_SHOTS[idx % DEFAULT_SHOTS.length];
                const refSubtitle = (analyzedRefTemplate?.ref_subtitles && analyzedRefTemplate.ref_subtitles[idx]) || "";

                return (
                  <div
                    key={slotIdx}
                    className={`bg-[#0D1416]/60 border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      uploaded?.clipId
                        ? "border-[#10B981]/20"
                        : "border-[#152226]"
                    }`}
                  >
                    {/* Left side: number + suggestion */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                          uploaded?.clipId
                            ? "bg-[#10B981] text-[#070B0D]"
                            : "bg-[#152226] text-[#6B7C85]"
                        }`}
                      >
                        {uploaded?.clipId ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : slotIdx}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white break-words">{suggestedQuery}</p>
                        {refSubtitle && (
                          <p className="text-xs text-[#10B981] font-semibold break-words mt-1">
                            Субтитры: "{refSubtitle}"
                          </p>
                        )}
                        {uploaded?.clipId && (
                          <p className="text-[10px] text-[#6B7C85] truncate mt-0.5">{uploaded.name}</p>
                        )}
                        {uploaded?.error && (
                          <p className="text-[10px] text-[#EF8B8B] truncate mt-0.5">{uploaded.error}</p>
                        )}
                      </div>
                    </div>

                    {/* Right side: actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        ref={(el) => { fileInputRefs.current[slotIdx] = el; }}
                        id={inputId}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleSlotFile(slotIdx, f);
                          e.target.value = "";
                        }}
                      />

                      {uploaded?.clipId ? (
                        <button
                          type="button"
                          onClick={() => removeSlotClip(slotIdx)}
                          className="text-[10px] text-[#6B7C85] hover:text-[#EF8B8B] transition-colors flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          Удалить
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={isUploadingSlot[slotIdx]}
                            onClick={() => fileInputRefs.current[slotIdx]?.click()}
                            className="bg-[#152226] hover:bg-[#1e2f33] text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                          >
                            {isUploadingSlot[slotIdx] ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Upload className="w-3 h-3" />
                            )}
                            Файл
                          </button>
                          <button
                            type="button"
                            disabled={isUploadingSlot[slotIdx]}
                            onClick={() => setPexelsScene(slotIdx)}
                            className="bg-[#10B981]/10 border border-[#10B981]/20 hover:bg-[#10B981]/20 text-[#10B981] font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                          >
                            <Film className="w-3 h-3" />
                            Pexels
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-3 border-t border-[#152226]">
              <button
                onClick={() => setCurrentStep(1)}
                className="text-xs text-[#6B7C85] hover:text-[#EFEFEF] transition-colors"
              >
                ← Назад
              </button>
              <button
                disabled={!checkAllSlotsUploaded()}
                onClick={() => setCurrentStep(3)}
                className="bg-[#10B981] hover:bg-[#12cf90] text-[#070B0D] font-bold text-sm px-6 py-2.5 rounded-full disabled:opacity-50 transition-all"
              >
                Продолжить →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/*  STEP 3 — Script & Subtitles                                    */}
      {/* ============================================================= */}
      {currentStep === 3 && (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-3xl mx-auto w-full">
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Субтитры и сценарий</h2>
              <p className="text-xs text-[#6B7C85] mt-1">
                Опишите контекст — ИИ сгенерирует субтитры. Или вставьте свой текст вручную.
              </p>
            </div>

            {/* Platform selector */}
            <div className="flex items-center gap-3 bg-[#0D1416]/40 p-3 border border-[#152226] rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#53656F]">Платформа</span>
              <div className="flex gap-1.5">
                {(["TikTok", "LinkedIn", "Reels"] as const).map((plat) => (
                  <button
                    key={plat}
                    onClick={() => setPlatform(plat)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                      platform === plat
                        ? "border-[#10B981] text-[#10B981] bg-[#10B981]/5"
                        : "border-[#152226] text-[#6B7C85] hover:text-[#EFEFEF] hover:border-[#53656F]/50"
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Generator */}
            <div className="bg-[#10B981]/[0.03] border border-[#10B981]/15 p-4 rounded-xl space-y-4">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#10B981]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#10B981]">Авто-генерация (ИИ)</span>
              </div>

              {/* Transcribe from music button */}
              {analyzedRefTemplate?.audio_url && (
                <div className="flex items-center justify-between bg-[#8B5CF6]/[0.06] border border-[#8B5CF6]/20 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎵</span>
                    <div>
                      <span className="text-xs font-semibold text-[#A78BFA] block">Субтитры из музыки</span>
                      <span className="text-[10px] text-[#6B7C85]">Whisper распознает слова из трека референса</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isTranscribingMusic}
                    onClick={handleTranscribeMusic}
                    className="bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 text-[#A78BFA] font-bold text-[11px] px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 border border-[#8B5CF6]/30"
                  >
                    {isTranscribingMusic ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>▶</span>}
                    {isTranscribingMusic ? "Распознаём..." : "Транскрибировать"}
                  </button>
                </div>
              )}


              {analyzedRefTemplate?.subtitle_pattern?.type === "two_field" && (
                <div className="space-y-2 pb-3 border-b border-[#10B981]/10">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#53656F] font-bold block">
                    Статичная строка (одинаковая во всех кадрах)
                  </label>
                  <input
                    type="text"
                    value={editedStaticLine !== undefined ? editedStaticLine : (analyzedRefTemplate.subtitle_pattern.static_line || "")}
                    onChange={(e) => setEditedStaticLine(e.target.value)}
                    className="w-full bg-[#152226]/50 text-white border border-[#152226] focus:border-[#10B981]/50 rounded-lg px-3 py-2 text-xs outline-none transition-colors"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-mono tracking-wider text-[#53656F] font-bold block">
                  {analyzedRefTemplate?.subtitle_pattern?.type === "two_field" ? "О чем должны быть динамичные слова?" : "О чем видео?"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={scriptContext}
                    onChange={(e) => setScriptContext(e.target.value)}
                    placeholder="Например: мотивация для разработчиков, вставай и кодь"
                    className="flex-1 bg-[#070B0D]/80 text-[#EFEFEF] border border-[#152226] focus:border-[#10B981]/50 rounded-lg px-3 py-2 text-xs outline-none placeholder:text-[#3A4A50] transition-colors"
                    onKeyDown={(e) => { if (e.key === "Enter") handleGenerateScript(); }}
                  />
                  <button
                    type="button"
                    disabled={isGeneratingScript || !scriptContext}
                    onClick={handleGenerateScript}
                    className="bg-[#10B981] hover:bg-[#12cf90] text-[#070B0D] font-bold text-xs px-4 py-2 rounded-lg disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0"
                  >
                    {isGeneratingScript ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Сгенерировать
                  </button>
                </div>
              </div>
              {scriptGenError && (
                <p className="text-[11px] text-[#EF8B8B]">{scriptGenError}</p>
              )}
            </div>

            {/* Manual script textarea / Two-field visualizer */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-mono tracking-wider text-[#53656F] font-bold block">
                Текст субтитров
              </label>
              
              {(() => {
                const isTwoFieldJSON = script.startsWith("{") && script.includes('"pattern_type"');
                
                if (isTwoFieldJSON) {
                  try {
                    const parsed = JSON.parse(script);
                    if (parsed.pattern_type === "two_field" && parsed.lines) {
                      return (
                        <div className="space-y-2">
                          {parsed.lines.map((line: Record<string, string>, idx: number) => (
                            <div key={idx} className="flex gap-2 items-center bg-[#0D1416]/50 border border-[#152226] p-2 rounded-lg">
                              <span className="w-5 text-[10px] text-[#53656F] font-mono text-center">{idx + 1}</span>
                              <input
                                type="text"
                                value={line.dynamic}
                                onChange={(e) => {
                                  const newLines = [...parsed.lines];
                                  newLines[idx].dynamic = e.target.value;
                                  setScript(JSON.stringify({ ...parsed, lines: newLines }));
                                }}
                                className="flex-1 bg-transparent border-none text-sm text-[#10B981] font-semibold outline-none focus:ring-0 p-0"
                              />
                              <span className="text-sm text-[#EFEFEF] bg-[#152226] px-2 py-0.5 rounded">
                                {line.static}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                  } catch {}
                }

                // Fallback to plain text area
                return (
                  <textarea
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    rows={6}
                    placeholder="Каждая строчка = один кадр в видео..."
                    className="w-full bg-[#0D1416]/50 text-[#EFEFEF] border border-[#152226] focus:border-[#10B981]/50 rounded-xl p-4 text-sm outline-none placeholder:text-[#3A4A50] focus:ring-0 transition-colors resize-none"
                  />
                );
              })()}

              {script && !script.startsWith("{") && (
                <p className="text-[10px] text-[#53656F] text-right">
                  {script.split("\n").filter((l) => l.trim()).length} строк
                </p>
              )}
            </div>

            {/* Subtitles toggle + SRT */}
            <div className="border-t border-[#152226] pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold block text-white">Вшить субтитры в видео</span>
                  <span className="text-[11px] text-[#6B7C85]">Стильно наложит текст поверх видео.</span>
                </div>
                <button
                  onClick={() => setBurnSubtitles((v) => !v)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${burnSubtitles ? "bg-[#10B981]" : "bg-[#152226]"}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${burnSubtitles ? "translate-x-4" : ""}`} />
                </button>
              </div>

              <div className="bg-[#0D1416]/40 border border-[#152226] rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#53656F]" />
                  <div>
                    <span className="text-xs font-semibold text-white block">SRT файл</span>
                    <span className="text-[10px] text-[#6B7C85]">Заменит текст точным таймингом.</span>
                  </div>
                </div>
                <input
                  type="file"
                  ref={srtInputRef}
                  onChange={handleSrtSelect}
                  accept=".srt"
                  className="hidden"
                />
                {srtFile ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#10B981] font-mono">{srtFile.name}</span>
                    <button
                      onClick={() => { setSrtFile(null); setSrtContent(null); }}
                      className="text-[#6B7C85] hover:text-[#EF8B8B]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => srtInputRef.current?.click()}
                    className="text-[11px] font-semibold text-[#070B0D] bg-[#A3B3BC] hover:bg-white px-3 py-1 rounded-lg transition-colors"
                  >
                    Выбрать
                  </button>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-3 border-t border-[#152226]">
              <button
                onClick={() => setCurrentStep(2)}
                className="text-xs text-[#6B7C85] hover:text-[#EFEFEF] transition-colors"
              >
                ← Назад
              </button>
              <button
                disabled={(!script.trim() && !srtContent) || isStartingRender}
                onClick={triggerRender}
                className="bg-[#10B981] hover:bg-[#12cf90] text-[#070B0D] font-bold text-sm px-6 py-2.5 rounded-full disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {isStartingRender && <Loader2 className="w-4 h-4 animate-spin" />}
                Запустить рендер 🎬
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/*  STEP 4 — Render                                               */}
      {/* ============================================================= */}
      {currentStep === 4 && (
        <RenderStep
          renderStatus={renderStatus}
          renderError={renderError}
          isRendering={!!renderJobId && renderStatus?.status !== "done" && renderStatus?.status !== "error"}
          videoTitle="Кастомный ролик по референсу"
          platform={platform}
          onRetry={() => {
            setRenderJobId(null);
            setRenderStatus(null);
            setRenderError(null);
            setCurrentStep(3);
          }}
          onJumpTo={(step) => {
            if (step === 1) setCurrentStep(1);
            if (step === 2) setCurrentStep(2);
            if (step === 3) setCurrentStep(3);
          }}
          onSchedulePost={() => {
            if (!renderStatus?.output_url) return;
            onSchedulePost({
              title: "Custom Reference Video",
              description: script,
              outputUrl: renderStatus.output_url,
              platform: platform,
            });
          }}
        />
      )}
    </div>
  );
}
