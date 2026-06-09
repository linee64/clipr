"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { ChevronLeft } from "lucide-react";
import {
  generateVisualScript,
  getRenderStatus,
  startBrollRender,
  uploadAudio,
  uploadClip,
} from "@/lib/api";
import type { RenderStatus, Scene, UploadedClipSlot, VisualScriptResponse } from "@/lib/types";
import { StepIndicator, type FlowStep } from "./StepIndicator";
import { StoryboardStep } from "./StoryboardStep";
import { UploadBySlotStep } from "./UploadBySlotStep";
import { RenderStep } from "./RenderStep";

export interface CreateFlowIdea {
  id: string;
  title: string;
  hook: string;
  vibe: string;
  platform: string;
  estimate?: string;
}

interface CreateFlowProps {
  idea: CreateFlowIdea;
  defaultPlatform: "TikTok" | "LinkedIn" | "Reels";
  onBack: () => void;
  onSchedulePost: (payload: {
    title: string;
    description: string;
    outputUrl: string;
    platform: string;
  }) => void;
}

function fallbackVisualScript(idea: CreateFlowIdea): VisualScriptResponse {
  const isRu = /[А-Яа-яЁё]/.test(`${idea.title} ${idea.hook}`);
  if (isRu) {
    return {
      title: idea.title,
      platform: idea.platform,
      music_vibe: "dark ambient",
      color_grade: "dark_cinematic",
      caption: `${idea.title}\n\n${idea.hook}\n\n#контент #идея #${(idea.platform || "tiktok").toLowerCase().replace(/\s/g, "")} #тренды #продвижение`,
      scenes: [
        {
          order: 1,
          phrase: idea.hook.toLowerCase(),
          film_suggestion: "крупный план рук с продуктом, мягкий свет от окна",
          duration_seconds: 4,
          role: "hook",
        },
        {
          order: 2,
          phrase: "вот с чего всё началось",
          film_suggestion: "средний план: человек открывает ноутбук в тёмной комнате",
          duration_seconds: 3,
          role: "body",
        },
        {
          order: 3,
          phrase: "никто не верил что выйдет",
          film_suggestion: "съёмка через плечо: экран с кодом поздно ночью",
          duration_seconds: 3,
          role: "body",
        },
        {
          order: 4,
          phrase: "но ты продолжал каждый день",
          film_suggestion: "таймлапс рабочего стола, чашки кофе копятся рядом",
          duration_seconds: 3,
          role: "body",
        },
        {
          order: 5,
          phrase: "сначала было только тихо",
          film_suggestion: "крупный план лица в холодном свете монитора",
          duration_seconds: 3,
          role: "body",
        },
        {
          order: 6,
          phrase: "а потом пошли первые результаты",
          film_suggestion: "съёмка экрана телефона: уведомления и растущие графики",
          duration_seconds: 3,
          role: "body",
        },
        {
          order: 7,
          phrase: "и вот к чему это привело",
          film_suggestion: "широкий план: человек встаёт из-за стола, потягивается",
          duration_seconds: 3,
          role: "body",
        },
        {
          order: 8,
          phrase: "просто не останавливайся.",
          film_suggestion: "финальный кадр продукта на столе, контровой свет",
          duration_seconds: 4,
          role: "punch",
        },
      ],
    };
  }
  return {
    title: idea.title,
    platform: idea.platform,
    music_vibe: "dark ambient",
    color_grade: "dark_cinematic",
    caption: `${idea.title}\n\n${idea.hook}\n\n#content #idea #${(idea.platform || "tiktok").toLowerCase().replace(/\s/g, "")} #trending #howto`,
    scenes: [
      {
        order: 1,
        phrase: idea.hook.toLowerCase(),
        film_suggestion: "close-up of hands holding the product, soft window light",
        duration_seconds: 4,
        role: "hook",
      },
      {
        order: 2,
        phrase: "this is where it all started",
        film_suggestion: "medium shot: someone opens a laptop in a dark room",
        duration_seconds: 3,
        role: "body",
      },
      {
        order: 3,
        phrase: "nobody thought it would work",
        film_suggestion: "over-the-shoulder: code on the screen late at night",
        duration_seconds: 3,
        role: "body",
      },
      {
        order: 4,
        phrase: "but you showed up every day",
        film_suggestion: "timelapse of a desk, coffee cups piling up nearby",
        duration_seconds: 3,
        role: "body",
      },
      {
        order: 5,
        phrase: "at first it was just quiet",
        film_suggestion: "close-up of a face lit by the cold monitor glow",
        duration_seconds: 3,
        role: "body",
      },
      {
        order: 6,
        phrase: "then the first results came in",
        film_suggestion: "screen recording: notifications and charts climbing",
        duration_seconds: 3,
        role: "body",
      },
      {
        order: 7,
        phrase: "and here is where it led",
        film_suggestion: "wide shot: someone stands up from the desk, stretches",
        duration_seconds: 3,
        role: "body",
      },
      {
        order: 8,
        phrase: "just keep going.",
        film_suggestion: "final hero shot of the product on a desk, rim light",
        duration_seconds: 4,
        role: "punch",
      },
    ],
  };
}

export function CreateFlow({
  idea,
  defaultPlatform,
  onBack,
  onSchedulePost,
}: CreateFlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>(2);
  const [visualScript, setVisualScript] = useState<VisualScriptResponse | null>(null);
  const [isLoadingScript, setIsLoadingScript] = useState(true);
  const [scriptError, setScriptError] = useState<string | null>(null);

  const [uploadedClips, setUploadedClips] = useState<Record<number, UploadedClipSlot>>({});
  const [audioFile, setAudioFile] = useState<{
    file: File;
    audio_file_id?: string;
  } | null>(null);
  const [selectedMusicVibe, setSelectedMusicVibe] = useState("dark ambient");

  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isStartingRender, setIsStartingRender] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const outputPlatform = idea.platform || defaultPlatform;

  const fetchStoryboard = useCallback(async () => {
    setIsLoadingScript(true);
    setScriptError(null);

    const saved = localStorage.getItem(`clipr_storyboard_v2_${idea.title}`);
    if (saved) {
      try {
        const cached = JSON.parse(saved) as VisualScriptResponse;
        setVisualScript(cached);
        setSelectedMusicVibe(cached.music_vibe?.split("|")[0]?.trim() || "dark ambient");
        setIsLoadingScript(false);
        return;
      } catch {
        /* fetch from API */
      }
    }

    try {
      const savedDna = localStorage.getItem("clipr_dna");
      let tone = "Casual founder";
      let niche = "content creators";
      if (savedDna) {
        try {
          const dna = JSON.parse(savedDna);
          tone = dna.tone === "casual" ? "Casual founder" : "Formal expert";
          niche = dna.audience || niche;
        } catch {
          /* defaults */
        }
      }

      const data = await generateVisualScript({
        idea_title: idea.title,
        hook_phrase: idea.hook,
        platform: outputPlatform,
        tone,
        niche,
      });
      setVisualScript(data);
      localStorage.setItem(`clipr_storyboard_v2_${idea.title}`, JSON.stringify(data));
      setSelectedMusicVibe(data.music_vibe.split("|")[0]?.trim() || "dark ambient");
    } catch (err) {
      setScriptError(
        err instanceof Error ? err.message : "Failed to generate storyboard"
      );
      const fallback = fallbackVisualScript(idea);
      setVisualScript(fallback);
    } finally {
      setIsLoadingScript(false);
    }
  }, [idea, outputPlatform]);

  useEffect(() => {
    fetchStoryboard();
  }, [fetchStoryboard]);

  useEffect(() => {
    if (!renderJobId) return;

    const poll = async () => {
      try {
        const status = await getRenderStatus(renderJobId);
        setRenderStatus(status);
        if (status.status === "done") {
          setCurrentStep(5);
        }
        if (status.status === "done" || status.status === "error") {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err) {
        setRenderError(err instanceof Error ? err.message : "Poll failed");
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
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
  }, [renderJobId]);

  const handlePhraseEdit = (order: number, phrase: string) => {
    setVisualScript((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        scenes: prev.scenes.map((s) => (s.order === order ? { ...s, phrase } : s)),
      };
      localStorage.setItem(`clipr_storyboard_v2_${idea.title}`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleClipUpload = (sceneOrder: number, file: File) => {
    setUploadedClips((prev) => ({
      ...prev,
      [sceneOrder]: { file, previewUrl: URL.createObjectURL(file) },
    }));
  };

  const handleStartRender = async () => {
    if (!visualScript) return;
    const scenes = [...visualScript.scenes].sort((a, b) => a.order - b.order);
    if (Object.keys(uploadedClips).length !== scenes.length || !audioFile) return;

    setIsStartingRender(true);
    setRenderError(null);
    setRenderStatus(null);
    setCurrentStep(4);

    try {
      const clipIds: string[] = [];
      for (const scene of scenes) {
        const slot = uploadedClips[scene.order];
        if (slot.clip_id) {
          clipIds.push(slot.clip_id);
        } else {
          const { clip_id } = await uploadClip(slot.file);
          clipIds.push(clip_id);
          setUploadedClips((prev) => ({
            ...prev,
            [scene.order]: { ...prev[scene.order], clip_id },
          }));
        }
      }

      let audioId = audioFile.audio_file_id;
      if (!audioId) {
        const { audio_file_id } = await uploadAudio(audioFile.file);
        audioId = audio_file_id;
        setAudioFile({ ...audioFile, audio_file_id });
      }

      const jobId = uuidv4();
      await startBrollRender({
        job_id: jobId,
        scenes: scenes as Scene[],
        clip_ids: clipIds,
        audio_file_id: audioId,
        audio_volume: 0.6,
        color_grade: visualScript.color_grade.split("|")[0]?.trim() || "dark_cinematic",
        platform: outputPlatform,
        template_id: visualScript.template_id ?? "",
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
      setCurrentStep(3);
    } finally {
      setIsStartingRender(false);
    }
  };

  const handleRetryRender = () => {
    setRenderJobId(null);
    setRenderStatus(null);
    setRenderError(null);
    setCurrentStep(3);
  };

  const isRendering =
    !!renderJobId &&
    renderStatus?.status !== "done" &&
    renderStatus?.status !== "error" &&
    !renderError;

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#070B0D]">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-[#152226] shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-[#6B7C85] hover:text-[#EFEFEF] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to ideas
        </button>
      </div>

      <StepIndicator currentStep={currentStep} />

      {currentStep === 2 && (
        <StoryboardStep
          visualScript={visualScript}
          isLoading={isLoadingScript}
          error={scriptError}
          onPhraseEdit={handlePhraseEdit}
          onRegenerate={() => {
            localStorage.removeItem(`clipr_storyboard_v2_${idea.title}`);
            fetchStoryboard();
          }}
          onContinue={() => setCurrentStep(3)}
        />
      )}

      {currentStep === 3 && visualScript && (
        <UploadBySlotStep
          visualScript={visualScript}
          uploadedClips={uploadedClips}
          audioFile={audioFile}
          selectedMusicVibe={selectedMusicVibe}
          onClipUpload={handleClipUpload}
          onClipReplace={handleClipUpload}
          onAudioSelect={(file) => setAudioFile({ file })}
          onMusicVibeSelect={setSelectedMusicVibe}
          onStartRender={handleStartRender}
          isStartingRender={isStartingRender}
        />
      )}

      {(currentStep === 4 || currentStep === 5) && (
        <RenderStep
          renderStatus={renderStatus}
          renderError={renderError}
          isRendering={isRendering}
          videoTitle={idea.title}
          platform={outputPlatform}
          caption={visualScript?.caption}
          onRetry={handleRetryRender}
          onSchedulePost={() => {
            if (!renderStatus?.output_url) return;
            onSchedulePost({
              title: idea.title,
              description: idea.title,
              outputUrl: renderStatus.output_url,
              platform: outputPlatform,
            });
          }}
        />
      )}
    </div>
  );
}
