"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { ChevronLeft } from "lucide-react";
import {
  fetchTracks,
  generateVisualScript,
  getRenderStatus,
  importPexelsClip,
  isUpgradeError,
  startBrollRender,
  uploadAudio,
  uploadClip,
} from "@/lib/api";
import type {
  AudioSelection,
  PexelsVideo,
  RenderStatus,
  Scene,
  TemplateTrack,
  UploadedClipSlot,
  VisualScriptResponse,
  VoiceoverSettings,
} from "@/lib/types";
import { StepIndicator, type FlowStep } from "./StepIndicator";
import { StoryboardStep } from "./StoryboardStep";
import { UploadBySlotStep } from "./UploadBySlotStep";
import { TemplatePickStep } from "./TemplatePickStep";
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
  /** External request to jump the flow to a given step (e.g. from the schedule
   * modal's "back to reference / subtitles" buttons). Consumed once, then cleared. */
  jumpToStep?: FlowStep | null;
  onJumpHandled?: () => void;
  /** Whether the user has an active Pro subscription (gates free-tier limits). */
  isPro: boolean;
  /** Open the upgrade modal when a free-tier limit / Pro-only feature is hit. */
  onRequireUpgrade: () => void;
  /** Server-side free-tier allowances remaining (Infinity for Pro). */
  regenLeft: number;
  voiceoverLeft: number;
  /** Re-fetch the server usage counts after a metered action. */
  onUsageRefresh: () => void;
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
  jumpToStep,
  onJumpHandled,
  isPro,
  onRequireUpgrade,
  regenLeft,
  voiceoverLeft,
  onUsageRefresh,
}: CreateFlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>(2);
  const [visualScript, setVisualScript] = useState<VisualScriptResponse | null>(null);
  const [isLoadingScript, setIsLoadingScript] = useState(true);
  const [scriptError, setScriptError] = useState<string | null>(null);

  const [uploadedClips, setUploadedClips] = useState<Record<number, UploadedClipSlot>>({});
  const [audioFile, setAudioFile] = useState<AudioSelection | null>(null);
  // true once the user actively picks/uploads their own track — their choice then
  // wins over a reference's recommended track.
  const [audioUserPicked, setAudioUserPicked] = useState(false);
  const [tracks, setTracks] = useState<TemplateTrack[]>([]);
  const [selectedMusicVibe, setSelectedMusicVibe] = useState("dark ambient");
  const [chosenTemplateId, setChosenTemplateId] = useState<string | null>(null);
  // AI voiceover (off by default — opt-in in the upload step).
  const [voiceover, setVoiceover] = useState<VoiceoverSettings>({
    enabled: false,
    voiceId: "",
    speed: 1.0,
  });

  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isStartingRender, setIsStartingRender] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedContentRef = useRef<string | null>(null);

  const outputPlatform = idea.platform || defaultPlatform;

  useEffect(() => {
    let active = true;
    fetchTracks()
      .then((data) => {
        if (active) setTracks(data);
      })
      .catch(() => {
        /* template tracks are optional — fall back to upload-only */
      });
    return () => {
      active = false;
    };
  }, []);

  const fetchStoryboard = useCallback(async (regenerate = false) => {
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
        regenerate,
      });
      setVisualScript(data);
      localStorage.setItem(`clipr_storyboard_v2_${idea.title}`, JSON.stringify(data));
      setSelectedMusicVibe(data.music_vibe.split("|")[0]?.trim() || "dark ambient");
      if (regenerate) onUsageRefresh(); // server counted this regen — refresh "left"
    } catch (err) {
      // Free-tier regen limit hit on the server → prompt upgrade, keep the current
      // storyboard (don't replace it with a fallback).
      if (regenerate && isUpgradeError(err)) {
        onRequireUpgrade();
        setIsLoadingScript(false);
        return;
      }
      setScriptError(
        err instanceof Error ? err.message : "Failed to generate storyboard"
      );
      const fallback = fallbackVisualScript(idea);
      setVisualScript(fallback);
    } finally {
      setIsLoadingScript(false);
    }
  }, [idea, outputPlatform, onUsageRefresh, onRequireUpgrade]);

  useEffect(() => {
    fetchStoryboard();
  }, [fetchStoryboard]);

  // Consume an external "jump back to step N" request (from the schedule modal).
  useEffect(() => {
    if (jumpToStep != null) {
      setCurrentStep(jumpToStep);
      onJumpHandled?.();
    }
  }, [jumpToStep, onJumpHandled]);

  useEffect(() => {
    if (!renderJobId) return;

    const poll = async () => {
      try {
        const status = await getRenderStatus(renderJobId);
        setRenderStatus(status);
        if (status.status === "done") {
          setCurrentStep(6);
          // Persist the finished video so it shows up in "My Content".
          if (status.output_url && savedContentRef.current !== status.output_url) {
            savedContentRef.current = status.output_url;
            try {
              const key = "clipr_content";
              const list = JSON.parse(localStorage.getItem(key) || "[]");
              list.unshift({
                id: renderJobId,
                title: idea.title,
                output_url: status.output_url,
                platform: outputPlatform,
                caption: visualScript?.caption ?? "",
                date: new Date().toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
                createdAt: Date.now(),
              });
              localStorage.setItem(key, JSON.stringify(list.slice(0, 200)));
            } catch {
              /* localStorage unavailable — skip persisting */
            }
          }
        }
        if (status.status === "done" || status.status === "error") {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          // Re-fetch the free-tier counts once the render finishes: the server may have
          // REFUNDED the reserved voiceover credit asynchronously (music-only fallback or
          // a failed render), and the one refresh at start time only saw the reservation.
          if (!isPro) onUsageRefresh();
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
    // idea/outputPlatform/visualScript are read only inside the done branch when
    // saving to My Content; re-subscribing on their change would restart polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const previewUrl = URL.createObjectURL(file);
    setUploadedClips((prev) => {
      // Replacing a slot? Revoke the previous object URL so blob: URLs don't leak.
      const old = prev[sceneOrder]?.previewUrl;
      if (old && old.startsWith("blob:") && old !== previewUrl) URL.revokeObjectURL(old);
      return {
        ...prev,
        [sceneOrder]: { file, previewUrl, name: file.name, source: "file" },
      };
    });
  };

  // Import a picked Pexels stock video server-side, then slot the returned clip_id
  // into the scene exactly like an uploaded file (no File object, just a clip_id +
  // remote thumbnail). Throws on failure so the modal can surface the error.
  const handlePexelsSelect = async (sceneOrder: number, video: PexelsVideo) => {
    const { clip_id } = await importPexelsClip(video.id);
    setUploadedClips((prev) => {
      // video.image is a remote URL (no revoke needed), but the slot we're replacing
      // may hold an uploaded file's blob: URL — revoke that so it doesn't leak.
      const old = prev[sceneOrder]?.previewUrl;
      if (old && old.startsWith("blob:")) URL.revokeObjectURL(old);
      return {
        ...prev,
        [sceneOrder]: {
          clip_id,
          previewUrl: video.image,
          // Neutral label — a chosen clip shouldn't reveal it came from a stock
          // library (no provider name, no creator credit) in the slot UI.
          name: "Clip",
          source: "pexels",
        },
      };
    });
  };

  const handleStartRender = async () => {
    if (!visualScript) return;
    // AI voiceover is limited on the free tier — gate before doing any work so a
    // free user who's out of uses gets the upgrade prompt instead of a render.
    const useVoiceover = voiceover.enabled && !!voiceover.voiceId;
    if (useVoiceover && voiceoverLeft <= 0) {
      onRequireUpgrade();
      return;
    }
    const scenes = [...visualScript.scenes].sort((a, b) => a.order - b.order);
    // Music is optional: prefer the user's pick / reference-matched track, else fall
    // back to the first built-in track so the render always has audio.
    const audio: AudioSelection | null =
      audioFile ??
      (tracks[0]
        ? { audio_file_id: tracks[0].id, name: tracks[0].name, url: tracks[0].url, isTemplate: true }
        : null);
    if (Object.keys(uploadedClips).length !== scenes.length || !audio) return;

    setIsStartingRender(true);
    setRenderError(null);
    setRenderStatus(null);
    setCurrentStep(5);

    try {
      // Upload every clip in parallel (Promise.all preserves scene order). The
      // backend storage I/O is non-blocking, so these overlap instead of waiting
      // one-by-one — the slowest single upload, not their sum, is the wait now.
      const clipIds: string[] = await Promise.all(
        scenes.map(async (scene) => {
          const slot = uploadedClips[scene.order];
          // Already a clip_id (Pexels import, or a previously-uploaded file) — reuse it.
          if (slot.clip_id) return slot.clip_id;
          if (!slot.file) throw new Error(`Scene ${scene.order} has no clip`);
          const { clip_id } = await uploadClip(slot.file);
          setUploadedClips((prev) => ({
            ...prev,
            [scene.order]: { ...prev[scene.order], clip_id },
          }));
          return clip_id;
        })
      );

      let audioId = audio.audio_file_id;
      if (!audioId && audio.file) {
        const { audio_file_id } = await uploadAudio(audio.file);
        audioId = audio_file_id;
        setAudioFile({ ...audio, audio_file_id });
      }

      if (!audioId) throw new Error("No background music selected");

      const jobId = uuidv4();
      await startBrollRender({
        job_id: jobId,
        scenes: scenes as Scene[],
        clip_ids: clipIds,
        audio_file_id: audioId,
        audio_volume: 0.6,
        color_grade: visualScript.color_grade.split("|")[0]?.trim() || "dark_cinematic",
        platform: outputPlatform,
        template_id: chosenTemplateId || visualScript.template_id || "",
        // user-picked track segment (trimmer); omitted -> template/auto behaviour
        ...(audio.start != null ? { music_start: audio.start } : {}),
        // AI voiceover — only sent when enabled AND a voice is chosen, so the backend
        // never gets add_voiceover with an empty voice_id.
        ...(voiceover.enabled && voiceover.voiceId
          ? {
              add_voiceover: true,
              voice_id: voiceover.voiceId,
              vo_speed: voiceover.speed,
            }
          : {}),
      });

      // The server counted this AI-voiceover render — refresh remaining "left".
      if (useVoiceover && !isPro) onUsageRefresh();

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
      // A Pro-only voice/style or an exhausted free allowance the client didn't
      // catch (e.g. stale counts) → prompt upgrade rather than a raw error.
      if (isUpgradeError(err)) {
        onRequireUpgrade();
        onUsageRefresh();
        setCurrentStep(4);
      } else {
        // Surface the failure on the render screen (RenderStep shows renderError + a
        // Retry) instead of silently bouncing back to the template picker with no feedback.
        setRenderError(err instanceof Error ? err.message : "Render failed to start");
        setCurrentStep(5);
      }
    } finally {
      setIsStartingRender(false);
    }
  };

  const handleRetryRender = () => {
    setRenderJobId(null);
    setRenderStatus(null);
    setRenderError(null);
    setCurrentStep(4);
  };

  const isRendering =
    !!renderJobId &&
    renderStatus?.status !== "done" &&
    renderStatus?.status !== "error" &&
    !renderError;

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin bg-[#070B0D]">
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-[#152226] shrink-0">
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
            // Free tier: cap storyboard regenerations; over the limit → upgrade.
            // The server is the real gate (counts + 429); this avoids a wasted call.
            if (regenLeft <= 0) {
              onRequireUpgrade();
              return;
            }
            localStorage.removeItem(`clipr_storyboard_v2_${idea.title}`);
            fetchStoryboard(true);
          }}
          regenLeft={regenLeft}
          onContinue={() => setCurrentStep(3)}
          onBack={onBack}
        />
      )}

      {currentStep === 3 && visualScript && (
        <UploadBySlotStep
          visualScript={visualScript}
          uploadedClips={uploadedClips}
          audioFile={audioFile}
          tracks={tracks}
          selectedMusicVibe={selectedMusicVibe}
          onClipUpload={handleClipUpload}
          onClipReplace={handleClipUpload}
          onPexelsSelect={handlePexelsSelect}
          onAudioSelect={(file) => {
            setAudioFile({ file, name: file.name });
            setAudioUserPicked(true);
          }}
          onTrackSelect={(track) => {
            // Toggle: clicking the already-selected track deselects it.
            if (audioFile?.isTemplate && audioFile.audio_file_id === track.id) {
              setAudioFile(null);
              setAudioUserPicked(false);
              return;
            }
            setAudioFile({
              audio_file_id: track.id,
              name: track.name,
              url: track.url,
              isTemplate: true,
            });
            setAudioUserPicked(true);
          }}
          onMusicVibeSelect={setSelectedMusicVibe}
          onContinue={() => setCurrentStep(4)}
          onBack={() => setCurrentStep(2)}
          onTrimChange={(start) =>
            setAudioFile((prev) => (prev ? { ...prev, start } : prev))
          }
          voiceover={voiceover}
          onVoiceoverChange={setVoiceover}
          isPro={isPro}
          onRequireUpgrade={onRequireUpgrade}
          voiceoverLeft={voiceoverLeft}
        />
      )}

      {currentStep === 4 && (
        <TemplatePickStep
          platform={outputPlatform}
          selectedTemplateId={chosenTemplateId}
          isPro={isPro}
          onRequireUpgrade={onRequireUpgrade}
          onSelect={(id, recommendedTrack, musicManual) => {
            setChosenTemplateId(id || null);
            if (!id) return;
            // Styles flagged music_manual never auto-pick a track — the user must
            // choose one (library or upload). Clear any auto-filled track (keep the
            // user's own pick) so they're prompted to choose.
            if (musicManual) {
              if (!audioUserPicked) setAudioFile(null);
              return;
            }
            // Otherwise auto-fill the reference's recommended track UNLESS the user
            // already picked their own music. If the track list hasn't loaded it yet,
            // still pin the recommended id directly so the render uses the RIGHT track
            // (the backend seeds it) instead of falling back to a different track.
            if (!audioUserPicked && recommendedTrack) {
              const rec = tracks.find((t) => t.id === recommendedTrack);
              setAudioFile(
                rec
                  ? { audio_file_id: rec.id, name: rec.name, url: rec.url, isTemplate: true }
                  : { audio_file_id: recommendedTrack, name: recommendedTrack, isTemplate: true }
              );
            }
          }}
          onRender={handleStartRender}
          onBack={() => setCurrentStep(3)}
          isStartingRender={isStartingRender}
          hasMusic={!!audioFile}
          musicLabel={audioFile?.name}
          musicIsCustom={audioUserPicked}
          onChangeMusic={() => setCurrentStep(3)}
        />
      )}

      {(currentStep === 5 || currentStep === 6) && (
        <RenderStep
          renderStatus={renderStatus}
          renderError={renderError}
          isRendering={isRendering}
          videoTitle={idea.title}
          platform={outputPlatform}
          caption={visualScript?.caption}
          onRetry={handleRetryRender}
          onJumpTo={(step) => setCurrentStep(step)}
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
