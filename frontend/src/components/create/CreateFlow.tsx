"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { ChevronLeft } from "lucide-react";
import {
  generateScript,
  getRenderStatus,
  startRender,
  uploadAudio,
  uploadClip,
} from "@/lib/api";
import type {
  RenderStatus,
  ScriptResponse,
  ScriptVariantKey,
  UploadedClip,
} from "@/lib/types";
import { StepIndicator, type FlowStep } from "./StepIndicator";
import { ScriptStep } from "./ScriptStep";
import { ReferencesStep } from "./ReferencesStep";
import { UploadRenderStep } from "./UploadRenderStep";
import { buildScriptSummary, type ScriptSection } from "./scriptUtils";

export interface CreateFlowIdea {
  id: string;
  title: string;
  hook: string;
  tags: string[];
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

function probeVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    video.src = url;
  });
}

export function CreateFlow({
  idea,
  defaultPlatform,
  onBack,
  onSchedulePost,
}: CreateFlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>(1);
  const [referencesSkipped, setReferencesSkipped] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ScriptVariantKey>("aggressive");
  const [scriptData, setScriptData] = useState<ScriptResponse | null>(null);
  const [editedScripts, setEditedScripts] = useState<ScriptResponse | null>(null);
  const [isLoadingScript, setIsLoadingScript] = useState(true);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [scriptSaved, setScriptSaved] = useState(false);

  const [uploadedClips, setUploadedClips] = useState<UploadedClip[]>([]);
  const [audioFile, setAudioFile] = useState<{
    file: File;
    audio_file_id?: string;
  } | null>(null);
  const [audioVolume, setAudioVolume] = useState(30);
  const [addSubtitles, setAddSubtitles] = useState(true);
  const [outputPlatform, setOutputPlatform] = useState<
    "TikTok" | "LinkedIn" | "Reels"
  >(defaultPlatform);

  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isStartingRender, setIsStartingRender] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const platform = idea.tags[1] || defaultPlatform;
  const format = idea.tags[0] || "Video";

  const fetchScript = useCallback(async () => {
    setIsLoadingScript(true);
    setScriptError(null);

    const saved = localStorage.getItem(`clipr_script_${idea.title}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ScriptResponse;
        setScriptData(parsed);
        setEditedScripts(parsed);
        setScriptSaved(true);
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

      const data = await generateScript({
        idea_title: idea.title,
        hook_preview: idea.hook,
        platform,
        tone,
        niche,
      });
      setScriptData(data);
      setEditedScripts(JSON.parse(JSON.stringify(data)));
    } catch (err) {
      setScriptError(
        err instanceof Error ? err.message : "Failed to generate script"
      );
      const fallback: ScriptResponse = {
        aggressive: {
          hook: idea.hook,
          problem: "Most creators struggle with the same mistake.",
          solution: "Here is a simple framework to fix it fast.",
          cta: "Follow for more tips.",
        },
        storytelling: {
          hook: idea.hook,
          problem: "I learned this the hard way.",
          solution: "These three steps changed everything.",
          cta: "Save this for later.",
        },
        educational: {
          hook: idea.hook,
          problem: "Here is what most people get wrong.",
          solution: "Do this instead for better results.",
          cta: "Comment if you want part two.",
        },
      };
      setScriptData(fallback);
      setEditedScripts(JSON.parse(JSON.stringify(fallback)));
    } finally {
      setIsLoadingScript(false);
    }
  }, [idea.title, idea.hook, platform]);

  useEffect(() => {
    fetchScript();
  }, [fetchScript]);

  useEffect(() => {
    if (!renderJobId) return;

    const poll = async () => {
      try {
        const status = await getRenderStatus(renderJobId);
        setRenderStatus(status);
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

  const handleScriptEdit = (
    variant: ScriptVariantKey,
    section: ScriptSection,
    value: string
  ) => {
    setEditedScripts((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [variant]: { ...prev[variant], [section]: value },
      };
    });
  };

  const goToReferences = () => {
    setReferencesSkipped(false);
    setCurrentStep(2);
  };

  const skipReferences = () => {
    setReferencesSkipped(true);
    setCurrentStep(3);
  };

  const goToUpload = () => {
    setCurrentStep(3);
  };

  const handleAddClips = async (files: FileList) => {
    const startOrder = uploadedClips.length;
    const newClips: UploadedClip[] = await Promise.all(
      Array.from(files).map(async (file, i) => {
        const duration = await probeVideoDuration(file);
        return {
          id: uuidv4(),
          file,
          order: startOrder + i,
          trim_start: 0,
          trim_end: 0,
          mute: false,
          duration: duration > 0 ? duration : undefined,
        };
      })
    );
    setUploadedClips((prev) => [...prev, ...newClips]);
  };

  const handleStartRender = async () => {
    if (uploadedClips.length === 0) return;
    setIsStartingRender(true);
    setRenderError(null);
    setRenderStatus(null);

    try {
      const clipsWithIds = await Promise.all(
        uploadedClips.map(async (clip) => {
          if (clip.clip_id) return clip;
          const { clip_id } = await uploadClip(clip.file);
          return { ...clip, clip_id };
        })
      );
      setUploadedClips(clipsWithIds);

      let audioId = "";
      if (audioFile) {
        if (audioFile.audio_file_id) {
          audioId = audioFile.audio_file_id;
        } else {
          const { audio_file_id } = await uploadAudio(audioFile.file);
          audioId = audio_file_id;
          setAudioFile({ ...audioFile, audio_file_id });
        }
      }

      const variant = editedScripts?.[selectedVariant];
      const scriptSummary = variant
        ? buildScriptSummary(variant)
        : idea.hook;

      const jobId = uuidv4();
      await startRender({
        job_id: jobId,
        clips: clipsWithIds.map((c, i) => ({
          clip_id: c.clip_id!,
          order: i,
          trim_start: c.trim_start,
          trim_end: c.trim_end,
          mute: !!c.mute,
        })),
        audio_file_id: audioId,
        audio_volume: audioVolume / 100,
        add_subtitles: addSubtitles,
        platform: outputPlatform,
        script_summary: scriptSummary,
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

  const handleRetryRender = () => {
    setRenderJobId(null);
    setRenderStatus(null);
    setRenderError(null);
  };

  const hookPreview =
    editedScripts?.[selectedVariant]?.hook ?? idea.hook;

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

      <StepIndicator
        currentStep={currentStep}
        referencesSkipped={referencesSkipped}
        onSkipReferences={skipReferences}
      />

      {currentStep === 1 && (
        <ScriptStep
          ideaTitle={idea.title}
          ideaHook={idea.hook}
          platform={platform}
          format={format}
          scriptData={scriptData}
          isLoading={isLoadingScript}
          error={scriptError}
          selectedVariant={selectedVariant}
          onVariantChange={setSelectedVariant}
          editedScripts={editedScripts}
          onScriptEdit={handleScriptEdit}
          onBrowseReferences={goToReferences}
          onSkipToUpload={skipReferences}
          onScriptSaved={() => setScriptSaved(true)}
        />
      )}

      {currentStep === 2 && (
        <ReferencesStep onSkip={skipReferences} onContinue={goToUpload} />
      )}

      {currentStep === 3 && (
        <UploadRenderStep
          ideaTitle={idea.title}
          platform={platform}
          format={format}
          hookPreview={hookPreview}
          scriptSaved={scriptSaved}
          uploadedClips={uploadedClips}
          onClipsChange={setUploadedClips}
          onClipUpdate={(id, patch) =>
            setUploadedClips((prev) =>
              prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
            )
          }
          onClipRemove={(id) =>
            setUploadedClips((prev) =>
              prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i }))
            )
          }
          onAddClips={handleAddClips}
          audioFile={audioFile}
          audioVolume={audioVolume}
          onAudioVolumeChange={setAudioVolume}
          onAudioSelect={(file) => setAudioFile({ file })}
          onAudioRemove={() => setAudioFile(null)}
          addSubtitles={addSubtitles}
          onAddSubtitlesChange={setAddSubtitles}
          outputPlatform={outputPlatform}
          onOutputPlatformChange={setOutputPlatform}
          isRendering={isRendering}
          isStartingRender={isStartingRender}
          renderStatus={renderStatus}
          renderError={renderError}
          onStartRender={handleStartRender}
          onRetryRender={handleRetryRender}
          onSchedulePost={() => {
            if (!renderStatus?.output_url) return;
            onSchedulePost({
              title: idea.title,
              description: renderStatus.description || idea.title,
              outputUrl: renderStatus.output_url,
              platform: outputPlatform,
            });
          }}
        />
      )}
    </div>
  );
}
