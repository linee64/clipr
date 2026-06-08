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
  return {
    title: idea.title,
    platform: idea.platform,
    music_vibe: "dark ambient",
    color_grade: "dark_cinematic",
    scenes: [
      {
        order: 1,
        phrase: idea.hook.toLowerCase(),
        film_suggestion: "hands on keyboard",
        duration_seconds: 3,
        role: "hook",
      },
      {
        order: 2,
        phrase: "nobody sees this part",
        film_suggestion: "screen glow in dark",
        duration_seconds: 3,
        role: "body",
      },
      {
        order: 3,
        phrase: "just you and the work",
        film_suggestion: "coffee cup on desk",
        duration_seconds: 3,
        role: "body",
      },
      {
        order: 4,
        phrase: "worth it.",
        film_suggestion: "city lights through window",
        duration_seconds: 2,
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

    const saved = localStorage.getItem(`clipr_storyboard_${idea.title}`);
    if (saved) {
      try {
        setVisualScript(JSON.parse(saved) as VisualScriptResponse);
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
      localStorage.setItem(`clipr_storyboard_${idea.title}`, JSON.stringify(data));
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
      localStorage.setItem(`clipr_storyboard_${idea.title}`, JSON.stringify(updated));
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
          className="flex items-center gap-1 text-xs text-[#888888] hover:text-[#EFEFEF] transition-colors"
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
            localStorage.removeItem(`clipr_storyboard_${idea.title}`);
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
