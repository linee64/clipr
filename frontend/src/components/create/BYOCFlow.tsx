"use client";

import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { ChevronLeft, Upload, FileText, Check, AlertCircle } from "lucide-react";
import {
  fetchTracks,
  uploadBYOCClip,
  startBYOCCreate,
  getRenderStatus,
} from "@/lib/api";
import type {
  RenderStatus,
  TemplateOption,
  TemplateTrack,
} from "@/lib/types";
import { TemplatePickStep } from "./TemplatePickStep";
import { RenderStep } from "./RenderStep";

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

export function BYOCFlow({
  onBack,
  onSchedulePost,
  isPro,
  onRequireUpgrade,
  videosLeft,
  videosLimit,
  videosUnlimited = false,
  onUsageRefresh,
}: BYOCFlowProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [userId] = useState(() => localStorage.getItem("clipr_email") || "anonymous");
  const [sessionId] = useState(() => uuidv4());

  // Step 1: Upload Clips
  const [clips, setClips] = useState<{ file: File; previewUrl: string; clipId?: string; progress?: number; error?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Script & Subtitles
  const [script, setScript] = useState("");
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [srtContent, setSrtContent] = useState<string | null>(null);
  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const srtInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Style Template
  const [, setTracks] = useState<TemplateTrack[]>([]);
  const [chosenTemplateId, setChosenTemplateId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateOption | null>(null);
  const [platform, setPlatform] = useState<"TikTok" | "LinkedIn" | "Reels">("TikTok");

  // Step 4: Render
  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isStartingRender, setIsStartingRender] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchTracks().then(setTracks).catch(() => {});
  }, []);

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
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
        if (status.status === "error") {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err) {
        failures += 1;
        if (failures >= 5) {
          setRenderError(err instanceof Error ? err.message : "Poll failed");
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [renderJobId, onUsageRefresh]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropClips = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (filesList: File[]) => {
    const videoFiles = filesList.filter((f) =>
      /\.(mp4|mov|webm)$/i.test(f.name)
    );
    if (!videoFiles.length) return;

    const newClips = videoFiles.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
    }));

    setClips((prev) => [...prev, ...newClips]);
  };

  const removeClip = (index: number) => {
    URL.revokeObjectURL(clips[index].previewUrl);
    setClips((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadAllClips = async () => {
    const updatedClips = [...clips];
    for (let i = 0; i < updatedClips.length; i++) {
      if (updatedClips[i].clipId) continue; // Already uploaded
      
      try {
        updatedClips[i] = { ...updatedClips[i], progress: 10 };
        setClips([...updatedClips]);

        const result = await uploadBYOCClip(userId, sessionId, updatedClips[i].file);
        updatedClips[i] = {
          ...updatedClips[i],
          clipId: result.clip_id,
          progress: 100,
        };
        setClips([...updatedClips]);
      } catch (err) {
        updatedClips[i] = {
          ...updatedClips[i],
          progress: undefined,
          error: err instanceof Error ? err.message : "Upload failed",
        };
        setClips([...updatedClips]);
        return false;
      }
    }
    return true;
  };

  const handleContinueToScript = async () => {
    if (!clips.length) return;
    const success = await uploadAllClips();
    if (success) {
      setCurrentStep(2);
    }
  };

  const handleSrtSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSrtFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSrtContent(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const triggerRender = async () => {
    if (!chosenTemplateId) return;
    setIsStartingRender(true);
    setRenderError(null);
    setRenderStatus(null);
    setCurrentStep(4);

    try {
      const clipIds = clips.map((c) => c.clipId).filter((id): id is string => !!id);
      const jobId = uuidv4();

      await startBYOCCreate({
        job_id: jobId,
        clip_ids: clipIds,
        script: script,
        subtitles_file: srtContent,
        burn_subtitles: burnSubtitles,
        template_id: chosenTemplateId,
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

  return (
    <div className="flex flex-col h-full bg-[#070B0D] text-[#EFEFEF]">
      {/* Top navigation header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#152226] shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-[#6B7C85] hover:text-[#EFEFEF] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Назад в Dashboard
        </button>
        <span className="text-xs text-[#6B7C85]">
          Шаг {currentStep} из 4
        </span>
      </div>

      {/* Step Indicators */}
      <div className="px-8 py-4 border-b border-[#152226]/50 bg-zinc-950/20 flex justify-center">
        <div className="flex items-center space-x-4 text-xs font-semibold uppercase tracking-wider text-[#6B7C85]">
          <span className={currentStep === 1 ? "text-[#10B981]" : clips.length ? "text-[#A3B3BC]" : ""}>1. Загрузка клипов</span>
          <span className="text-[#152226]">/</span>
          <span className={currentStep === 2 ? "text-[#10B981]" : script || srtContent ? "text-[#A3B3BC]" : ""}>2. Сценарий</span>
          <span className="text-[#152226]">/</span>
          <span className={currentStep === 3 ? "text-[#10B981]" : chosenTemplateId ? "text-[#A3B3BC]" : ""}>3. Стиль</span>
          <span className="text-[#152226]">/</span>
          <span className={currentStep === 4 ? "text-[#10B981]" : ""}>4. Рендеринг</span>
        </div>
      </div>

      {/* Main Form content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-4xl mx-auto w-full">
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Загрузите ваши видеоматериалы</h2>
              <p className="text-xs text-[#6B7C85] mt-1">Загрузите несколько клипов, которые будут смонтированы в одно видео.</p>
            </div>

            <div
              onDragOver={handleDragOver}
              onDrop={handleDropClips}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#152226] hover:border-[#10B981]/50 rounded-2xl p-10 text-center cursor-pointer bg-[#0D1416]/50 transition-all flex flex-col items-center justify-center gap-3"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
              />
              <Upload className="w-10 h-10 text-[#6B7C85] group-hover:text-[#10B981]" />
              <span className="text-sm font-semibold">Перетащите файлы сюда или кликните для выбора</span>
              <span className="text-xs text-[#6B7C85]">Поддерживаются форматы .mp4, .mov, .webm</span>
            </div>

            {clips.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#EFEFEF]">Загруженные файлы ({clips.length})</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {clips.map((clip, idx) => (
                    <div key={idx} className="relative aspect-[9/16] rounded-xl bg-[#070B0D] overflow-hidden border border-[#152226]">
                      <video
                        src={clip.previewUrl}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                      <button
                        onClick={() => removeClip(idx)}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-black/90 p-1.5 rounded-full text-[#6B7C85] hover:text-[#EF8B8B] transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      
                      {clip.progress !== undefined && clip.progress < 100 && (
                        <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center p-3 text-center">
                          <div className="w-full bg-[#152226] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#10B981] h-full" style={{ width: `${clip.progress}%` }} />
                          </div>
                          <span className="text-[10px] text-[#6B7C85] mt-1.5">Загрузка...</span>
                        </div>
                      )}
                      {clip.clipId && (
                        <div className="absolute bottom-2 left-2 bg-[#10B981]/90 text-[#070B0D] text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" /> Готово
                        </div>
                      )}
                      {clip.error && (
                        <div className="absolute inset-0 bg-[#3A1E1E]/90 flex flex-col items-center justify-center p-3 text-center">
                          <AlertCircle className="w-5 h-5 text-[#EF8B8B] mb-1" />
                          <span className="text-[9px] text-[#EF8B8B]">{clip.error}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-[#152226]">
              <button
                disabled={clips.length === 0}
                onClick={handleContinueToScript}
                className="bg-[#10B981] hover:bg-[#12cf90] text-[#070B0D] font-bold text-sm px-6 py-2.5 rounded-full disabled:opacity-50 transition-all"
              >
                Продолжить →
              </button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Добавьте сценарий и субтитры</h2>
              <p className="text-xs text-[#6B7C85] mt-1">Введите текст сценария или загрузите готовые субтитры для наложения на видео.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs uppercase font-mono tracking-wider text-[#6B7C85] font-bold block">
                  Текст сценария
                </label>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={6}
                  placeholder="Вставьте сюда ваш сценарий. Каждая строчка сценария будет наложена на соответствующий видео-фрагмент..."
                  className="w-full bg-[#0D1416]/50 text-[#EFEFEF] border border-[#152226] focus:border-[#10B981]/50 rounded-xl p-4 text-sm outline-none placeholder:text-[#3A4A50] focus:ring-0"
                />
              </div>

              <div className="border-t border-[#152226] pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold block">Выжигать субтитры на видео</span>
                    <span className="text-xs text-[#6B7C85]">Наложит текст стильно поверх видео-фрагментов.</span>
                  </div>
                  <button
                    onClick={() => setBurnSubtitles((v) => !v)}
                    className={`relative w-10 h-6 rounded-full transition-colors ${burnSubtitles ? "bg-[#10B981]" : "bg-[#152226]"}`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${burnSubtitles ? "translate-x-4" : ""}`} />
                  </button>
                </div>

                <div className="bg-[#0D1416]/30 border border-[#152226] rounded-xl p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-sm font-semibold block flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#6B7C85]" />
                      Использовать файл субтитров (.srt)
                    </span>
                    <span className="text-xs text-[#6B7C85]">Заменит обычный текст точным таймингом из .srt файла.</span>
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
                      <span className="text-xs text-[#10B981] font-mono">{srtFile.name}</span>
                      <button
                        onClick={() => { setSrtFile(null); setSrtContent(null); }}
                        className="text-[#6B7C85] hover:text-[#EF8B8B]"
                      >
                        Удалить
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => srtInputRef.current?.click()}
                      className="text-xs font-semibold text-[#070B0D] bg-[#EFEFEF] hover:bg-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Выбрать .srt
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-[#152226]">
              <button
                onClick={() => setCurrentStep(1)}
                className="text-xs text-[#6B7C85] hover:text-[#EFEFEF] transition-colors"
              >
                ← Назад к клипам
              </button>
              <button
                disabled={!script.trim() && !srtContent}
                onClick={() => setCurrentStep(3)}
                className="bg-[#10B981] hover:bg-[#12cf90] text-[#070B0D] font-bold text-sm px-6 py-2.5 rounded-full disabled:opacity-50 transition-all"
              >
                Продолжить →
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Выберите эталонный стиль</h2>
              <p className="text-xs text-[#6B7C85] mt-1">Определите параметры анимации, переходов и цветокоррекции на основе стилей.</p>
            </div>

            <div className="flex items-center gap-4 bg-[#0D1416]/40 p-4 border border-[#152226] rounded-xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7C85]">Платформа:</span>
              <div className="flex gap-2">
                {(["TikTok", "LinkedIn", "Reels"] as const).map((plat) => (
                  <button
                    key={plat}
                    onClick={() => setPlatform(plat)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${platform === plat ? "border-[#10B981] text-[#10B981] bg-[#10B981]/5" : "border-[#152226] text-[#6B7C85] hover:text-[#EFEFEF]"}`}
                  >
                    {plat}
                  </button>
                ))}
              </div>
            </div>

            <TemplatePickStep
              platform={platform}
              selectedTemplateId={chosenTemplateId}
              isPro={isPro}
              onRequireUpgrade={onRequireUpgrade}
              hasVoiceover={false}
              onConfigureVoiceover={() => {}}
              onSelect={(id, template) => {
                setChosenTemplateId(id || null);
                setSelectedTemplate(template || null);
              }}
              onRender={triggerRender}
              onBack={() => setCurrentStep(2)}
              isStartingRender={isStartingRender}
              videosLeft={videosLeft}
              videosLimit={videosLimit}
              videosUnlimited={videosUnlimited}
              hasMusic={true}
              musicLabel={selectedTemplate?.recommended_track || "Шаблонная аудиодорожка"}
              musicIsCustom={false}
              onChangeMusic={() => {}}
            />
          </div>
        )}

        {currentStep === 4 && (
          <RenderStep
            renderStatus={renderStatus}
            renderError={renderError}
            isRendering={!!renderJobId && renderStatus?.status !== "done" && renderStatus?.status !== "error"}
            videoTitle="Ваш BYOC видеоролик"
            platform={platform}
            caption={script}
            onRetry={() => {
              setRenderJobId(null);
              setRenderStatus(null);
              setRenderError(null);
              setCurrentStep(3);
            }}
            onJumpTo={(step) => {
              if (step === 2) setCurrentStep(2);
              if (step === 3) setCurrentStep(3);
            }}
            onSchedulePost={() => {
              if (!renderStatus?.output_url) return;
              onSchedulePost({
                title: "BYOC Video",
                description: script,
                outputUrl: renderStatus.output_url,
                platform: platform,
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
