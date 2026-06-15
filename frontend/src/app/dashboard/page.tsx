"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import "../globals.css";
import {
  Home,
  Film,
  Calendar as CalendarIcon,
  Bookmark,
  Settings,
  Search,
  Bell,
  CalendarRange,
  Edit2,
  Download,
  Trash2,
  X,
  Check,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { CreateFlow } from "@/components/create/CreateFlow";
import type { FlowStep } from "@/components/create/StepIndicator";
import {
  API_BASE,
  listReferences,
  resolveBackendUrl,
  getTwitterStatus,
  startTwitterConnect,
  disconnectTwitter,
  postToTwitter,
  type TwitterStatus,
} from "@/lib/api";
import type { TemplateOption } from "@/lib/types";

// X (Twitter) wordmark — the stylised "X".
function XLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

// ----------------------------------------------------
// MOCK DATA & CONFIG
// ----------------------------------------------------

interface IdeaCard {
  id: string;
  title: string;
  hook: string;
  vibe?: string;
  tags: string[];
  estimate: string;
  script?: ScriptVariant;
}

interface ScriptVariant {
  hook: string;
  problem: string[];
  solution: string[];
  cta: string;
}

const generateDynamicIdeas = (product: string, platform: string): IdeaCard[] => {
  const keywords = product.length > 25 ? product.substring(0, 25) + "..." : product;
  return [
    {
      id: "dynamic-1",
      title: `3 ошибки при продвижении: ${keywords}`,
      hook: `Большинство создателей думают, что продвигать ${keywords} просто. Вот почему они ошибаются.`,
      vibe: "dark and focused",
      tags: ["dark and focused", platform],
      estimate: "Высокий потенциал",
      script: {
        hook: `Большинство думают, что рассказывать про ${keywords} легко. Вот почему они ошибаются.`,
        problem: [
          "Вы начинаете объяснять сложные термины с первых секунд",
          "Аудитория скучает и сразу скроллит дальше",
          "Вы теряете до 80% удержания на первой секунде ролика"
        ],
        solution: [
          "Начните с сильного визуального хука или вопроса",
          "Объясняйте тему простыми словами как 5-летнему ребенку",
          "Сделайте призыв к действию в середине видео"
        ],
        cta: "Подпишись, чтобы не совершать эти ошибки!"
      }
    },
    {
      id: "dynamic-2",
      title: `Почему я почти провалил запуск ${keywords}`,
      hook: `Моя самая большая ошибка при работе с ${keywords}. Не повторяйте её.`,
      vibe: "late night energy",
      tags: ["late night energy", platform],
      estimate: "Трендовый формат",
      script: {
        hook: `Моя самая большая ошибка при работе с ${keywords}. Не повторяйте её.`,
        problem: [
          "Я потратил 3 месяца на идеальную подготовку",
          "Забыл спросить реальных пользователей, что им нужно",
          "В итоге запустился в пустую тишину без единой продажи"
        ],
        solution: [
          "Делайте CustDev и говорите с клиентами до запуска",
          "Создайте MVP за 3 дня и сразу тестируйте спрос",
          "Корректируйте подачу на основе реальной обратной связи"
        ],
        cta: "Подпишись, делюсь опытом фаундера без прикрас"
      }
    },
    {
      id: "dynamic-3",
      title: `Чек-лист на 5 минут: Идеальный старт в ${keywords}`,
      hook: `Если бы я начинал работать с ${keywords} с нуля, я бы сделал это.`,
      vibe: "grind aesthetic",
      tags: ["grind aesthetic", platform],
      estimate: "Вирусный хук",
      script: {
        hook: `Если бы я начинал работать с ${keywords} с нуля, я бы сделал это.`,
        problem: [
          "Новички тратят тысячи долларов на платные курсы",
          "Изучают устаревшие теории вместо реальной практики",
          "Бросают начатое из-за отсутствия быстрого результата"
        ],
        solution: [
          "Начните с бесплатных гайдов и open-source инструментов",
          "Найдите наставника или поддерживающее комьюнити",
          "Каждый день делайте одно маленькое практическое действие"
        ],
        cta: "Забирай чек-лист в описании моего профиля"
      }
    },
    {
      id: "dynamic-4",
      title: `Честное мнение: Почему ${keywords} изменит всё в 2026 году`,
      hook: `Непопулярное мнение: будущее контента и ${keywords} за этим решением.`,
      vibe: "raw founder life",
      tags: ["raw founder life", platform],
      estimate: "Горячая тема",
      script: {
        hook: `Непопулярное мнение: будущее контента и ${keywords} за этим решением.`,
        problem: [
          "Большинство продолжают использовать старые шаблоны",
          "Рынок меняется слишком быстро, а вы стоите на месте",
          "Скоро ваши методы перестанут приносить клиентов вообще"
        ],
        solution: [
          "Внедряйте новые ИИ-инструменты в ежедневную рутину",
          "Делайте фокус на искренность и живое общение",
          "Адаптируйте контент под короткие форматы немедленно"
        ],
        cta: "Напиши в комментариях, согласен ты или нет"
      }
    },
    {
      id: "dynamic-5",
      title: `Как за 1 минуту объяснить ${keywords}`,
      hook: `Тебе нужно всего 60 секунд, чтобы понять суть ${keywords}.`,
      vibe: "clean and clear",
      tags: ["clean and clear", platform],
      estimate: "Вирусный хук",
      script: {
        hook: `Тебе нужно всего 60 секунд, чтобы понять суть ${keywords}.`,
        problem: [
          "Люди думают, что разобраться слишком сложно и долго",
          "Поэтому откладывают и так и не пробуют",
          "А конкуренты уже используют это каждый день"
        ],
        solution: [
          "Покажи один понятный пример за 15 секунд",
          "Сравни «до» и «после» наглядно",
          "Дай простой первый шаг прямо в видео"
        ],
        cta: "Сохрани, чтобы попробовать сегодня"
      }
    },
    {
      id: "dynamic-6",
      title: `Главная ошибка новичков в ${keywords}`,
      hook: `Эту ошибку с ${keywords} совершают почти все. А ты?`,
      vibe: "bold reveal",
      tags: ["bold reveal", platform],
      estimate: "Трендовый формат",
      script: {
        hook: `Эту ошибку с ${keywords} совершают почти все. А ты?`,
        problem: [
          "Все копируют чужие шаблоны без понимания",
          "Результат получается серым и незаметным",
          "Время и силы уходят впустую"
        ],
        solution: [
          "Найди свой угол и говори от себя",
          "Тестируй маленькими итерациями каждый день",
          "Опирайся на реальные данные, а не на догадки"
        ],
        cta: "Подпишись, чтобы не повторять чужих ошибок"
      }
    }
  ];
};


const IDEA_CARDS: IdeaCard[] = [
  {
    id: "idea-1",
    title: "what discipline looks like",
    hook: "nobody sees this part",
    vibe: "dark and focused",
    tags: ["dark and focused", "TikTok"],
    estimate: "High potential"
  },
  {
    id: "idea-2",
    title: "building solo at 2am",
    hook: "just you and the screen",
    vibe: "late night energy",
    tags: ["late night energy", "TikTok"],
    estimate: "High potential"
  },
  {
    id: "idea-3",
    title: "the grind nobody posts",
    hook: "same desk. different day.",
    vibe: "grind aesthetic",
    tags: ["grind aesthetic", "Reels"],
    estimate: "Trending topic"
  },
  {
    id: "idea-4",
    title: "raw founder life",
    hook: "no team. no safety net.",
    vibe: "raw founder life",
    tags: ["raw founder life", "TikTok"],
    estimate: "Viral format"
  },
  {
    id: "idea-5",
    title: "before vs after",
    hook: "the part nobody shows",
    vibe: "clean and clear",
    tags: ["clean and clear", "Reels"],
    estimate: "Viral format"
  },
  {
    id: "idea-6",
    title: "watch this in 30s",
    hook: "stop scrolling, this is quick",
    vibe: "bold reveal",
    tags: ["bold reveal", "TikTok"],
    estimate: "Trending topic"
  }
];

const MOCK_CALENDAR_POSTS: Record<number, { platform: "TikTok" | "LinkedIn" | "Instagram"; title: string; time: string; status: "Scheduled" | "Published" }[]> = {
  3: [{ platform: "LinkedIn", title: "The cost of bad hiring in SaaS", time: "10:30 AM", status: "Published" }],
  5: [{ platform: "TikTok", title: "Day in the life of a solo founder", time: "04:15 PM", status: "Published" }],
  10: [{ platform: "Instagram", title: "How we hit $10k MRR in 30 days", time: "09:00 AM", status: "Scheduled" }],
  14: [{ platform: "TikTok", title: "Why I hate traditional project management", time: "11:30 AM", status: "Scheduled" }],
  18: [{ platform: "LinkedIn", title: "3 productivity hacks that actually work", time: "01:00 PM", status: "Scheduled" }],
  22: [{ platform: "Instagram", title: "The raw truth about SaaS valuations", time: "06:00 PM", status: "Scheduled" }]
};

const TRENDS_DATA = [
  { id: "t-1", source: "REDDIT", title: "Founders moving from Slack to Discord", time: "2h ago" },
  { id: "t-2", source: "GOOGLE TRENDS", title: "AI HR automation tools search spike", time: "3h ago" },
  { id: "t-3", source: "NEWS", title: "The rise of fraction-of-time executive hires", time: "5h ago" },
  { id: "t-4", source: "REDDIT", title: "Why micro-SaaS is still king in 2026", time: "8h ago" },
  { id: "t-5", source: "GOOGLE TRENDS", title: "Short-form video hook formulas", time: "12h ago" }
];

interface SavedVideo {
  id: string;
  title: string;
  output_url: string;
  platform: string;
  caption?: string;
  date: string;
  createdAt?: number;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"Create" | "Calendar" | "My Content" | "References" | "Settings">("Create");
  const [savedContent, setSavedContent] = useState<SavedVideo[]>([]);
  const [dnaInfo, setDnaInfo] = useState<{ product?: string; audience?: string; tone?: string; platform?: string }>({});
  const [sidebarActive, setSidebarActive] = useState<"Home" | "My Content" | "Calendar" | "References" | "Settings">("Home");
  const [references, setReferences] = useState<TemplateOption[]>([]);
  const [refsLoading, setRefsLoading] = useState(false);
  const [refsError, setRefsError] = useState<string | null>(null);

  // X (Twitter) connection state for the Settings tab + post-OAuth toast.
  const [xStatus, setXStatus] = useState<TwitterStatus | null>(null);
  const [xToast, setXToast] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // On load, surface the result of an OAuth round-trip (the backend redirects back
  // to /dashboard?x_connected=1 or ?x_error=...), then scrub it from the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("x_connected")) {
      setXToast({ kind: "ok", text: "X account connected." });
    } else if (params.has("x_error")) {
      setXToast({ kind: "error", text: `Couldn't connect X: ${params.get("x_error")}` });
    }
    if (params.has("x_connected") || params.has("x_error")) {
      params.delete("x_connected");
      params.delete("x_error");
      const qs = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
    getTwitterStatus().then(setXStatus).catch(() => setXStatus({ connected: false }));
  }, []);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!xToast) return;
    const t = setTimeout(() => setXToast(null), 6000);
    return () => clearTimeout(t);
  }, [xToast]);

  // Refresh the connection each time Settings opens, in case it changed elsewhere.
  useEffect(() => {
    if (activeTab !== "Settings") return;
    getTwitterStatus().then(setXStatus).catch(() => setXStatus({ connected: false }));
  }, [activeTab]);

  const handleDisconnectX = async () => {
    try {
      await disconnectTwitter();
    } catch {
      /* ignore — fall through to optimistic update */
    }
    setXStatus({ connected: false });
    setXToast({ kind: "ok", text: "X account disconnected." });
  };

  // Which saved video is currently being posted to X (for the My Content buttons).
  const [xPostingId, setXPostingId] = useState<string | null>(null);

  const handlePostSavedToX = async (item: SavedVideo) => {
    if (!xStatus?.connected) {
      // Not connected yet — kick off the OAuth flow instead of a dead click.
      startTwitterConnect().catch((e) =>
        setXToast({
          kind: "error",
          text: `Couldn't start X connect: ${e instanceof Error ? e.message : "try again"}`,
        })
      );
      return;
    }
    setXPostingId(item.id);
    try {
      const result = await postToTwitter({
        output_url: item.output_url,
        caption: item.caption || item.title,
      });
      setXToast({ kind: "ok", text: "Posted to X." });
      if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setXToast({
        kind: "error",
        text: e instanceof Error ? e.message : "Couldn't post to X. Try again.",
      });
    } finally {
      setXPostingId(null);
    }
  };

  useEffect(() => {
    if (activeTab !== "References" || references.length > 0 || refsLoading) return;
    setRefsLoading(true);
    setRefsError(null);
    listReferences()
      .then((d) => setReferences(d.templates))
      .catch(() =>
        setRefsError(
          `Couldn't reach the backend at ${API_BASE}. Start it with: uvicorn main:app --port 8000`
        )
      )
      .finally(() => setRefsLoading(false));
  }, [activeTab, references.length, refsLoading]);

  // Load the videos Clipr has rendered (persisted by the create flow on render done).
  // Re-read each time the tab opens so freshly-rendered videos show up.
  useEffect(() => {
    if (activeTab !== "My Content") return;
    try {
      setSavedContent(JSON.parse(localStorage.getItem("clipr_content") || "[]"));
    } catch {
      setSavedContent([]);
    }
  }, [activeTab]);

  // Load the saved brand DNA (from onboarding) for the Settings tab.
  useEffect(() => {
    if (activeTab !== "Settings") return;
    try {
      setDnaInfo(JSON.parse(localStorage.getItem("clipr_dna") || "{}"));
    } catch {
      setDnaInfo({});
    }
  }, [activeTab]);

  const deleteSavedVideo = (id: string) => {
    setSavedContent((prev) => {
      const next = prev.filter((v) => v.id !== id);
      try {
        localStorage.setItem("clipr_content", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Onboarding & DNA States
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(true);
  const [isLoadingOnboarding, setIsLoadingOnboarding] = useState<boolean>(true);
  const [ideas, setIdeas] = useState<IdeaCard[]>(IDEA_CARDS);

  // Create Tab States
  const [inputVal, setInputVal] = useState("I'm building an AI tool for HR automation and want to explain why onboarding matters...");
  const [selectedPlatform, setSelectedPlatform] = useState<"TikTok" | "LinkedIn" | "Reels">("TikTok");
  const [isGenerating, setIsGenerating] = useState(false);

  // Modal and details
  const [selectedIdea, setSelectedIdea] = useState<IdeaCard | null>(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<number | null>(10);
  const [, setShowCalendarPanel] = useState(true);
  const [ideasError, setIdeasError] = useState<string | null>(null);

  // Scheduling
  // Calendar/scheduling is shelved (Calendar tab is "coming soon"); the schedule
  // modal stays wired but the displayed values aren't read anywhere, so keep only
  // the setters to satisfy the no-unused-vars rule.
  const [, setCalendarPosts] = useState(MOCK_CALENDAR_POSTS);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [schedulePlatform, setSchedulePlatform] = useState<"TikTok" | "LinkedIn" | "Instagram">("TikTok");
  const [scheduleDay, setScheduleDay] = useState<number>(10);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [, setScheduleConfirmation] = useState<string | null>(null);
  // Lets the schedule modal jump the still-mounted create flow back to a step.
  const [flowJumpStep, setFlowJumpStep] = useState<FlowStep | null>(null);


  // Voice Edit profile
  const [isEditingVoice, setIsEditingVoice] = useState(false);
  const [voiceTone, setVoiceTone] = useState("Casual founder");
  const [voicePreview, setVoicePreview] = useState("Direct, no fluff, fast-paced, talking directly to operators.");
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(true);
  const [heroExitState, setHeroExitState] = useState<'visible' | 'exiting' | 'hidden'>('visible');
  const [modalIdea, setModalIdea] = useState<IdeaCard | null>(null);
  const [isPlatformOpen, setIsPlatformOpen] = useState(false);
  const [isFormatOpen, setIsFormatOpen] = useState(false);
  const [selectedPostType, setSelectedPostType] = useState<"Video" | "Text post">("Video");

  // Auto-expanding textarea ref
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputVal(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      const maxH = 100;
      if (ta.scrollHeight > maxH) {
        ta.style.height = maxH + 'px';
        ta.style.overflowY = 'auto';
      } else {
        ta.style.height = ta.scrollHeight + 'px';
        ta.style.overflowY = 'hidden';
      }
    }
  }, []);

  useEffect(() => {
    const savedDna = localStorage.getItem("clipr_dna");
    if (savedDna) {
      try {
        const dna = JSON.parse(savedDna);
        setVoiceTone(dna.tone === "casual" ? "Как с другом" : "Формальный эксперт");
        setVoicePreview(
          `Тема: ${dna.product.length > 60 ? dna.product.substring(0, 60) + "..." : dna.product}. Целевая аудитория: ${dna.audience}.`
        );

        let plat: "TikTok" | "LinkedIn" | "Reels" = "TikTok";
        if (dna.platform === "LinkedIn") plat = "LinkedIn";
        else if (dna.platform === "Instagram Reels" || dna.platform === "YouTube Shorts" || dna.platform === "Twitter / X") plat = "Reels";

        setSelectedPlatform(plat);
        setInputVal(`Напиши сценарий о преимуществах нашей темы: "${dna.product}" для целевой аудитории (${dna.audience}).`);
        setIdeas(generateDynamicIdeas(dna.product, dna.platform));
        setHasCompletedOnboarding(true);
      } catch (e) {
        console.error("Error parsing saved DNA", e);
        setHasCompletedOnboarding(true);
      }
    } else {
      setHasCompletedOnboarding(true);
    }
    setIsLoadingOnboarding(false);
  }, []);

  const handleOnboardingComplete = (data: {
    product: string;
    audience: string;
    tone: "formal" | "casual";
    samplePost: string;
    platform: "TikTok" | "Instagram Reels" | "LinkedIn" | "YouTube Shorts" | "Twitter / X";
  }) => {
    localStorage.setItem("clipr_dna", JSON.stringify(data));
    setVoiceTone(data.tone === "casual" ? "Как с другом" : "Формальный эксперт");
    setVoicePreview(
      `Тема: ${data.product.length > 60 ? data.product.substring(0, 60) + "..." : data.product}. Целевая аудитория: ${data.audience}.`
    );

    let plat: "TikTok" | "LinkedIn" | "Reels" = "TikTok";
    if (data.platform === "LinkedIn") plat = "LinkedIn";
    else if (data.platform === "Instagram Reels" || data.platform === "YouTube Shorts" || data.platform === "Twitter / X") plat = "Reels";

    setSelectedPlatform(plat);
    setInputVal(`Напиши сценарий о преимуществах нашей темы: "${data.product}" для целевой аудитории (${data.audience}).`);
    setIdeas(generateDynamicIdeas(data.product, data.platform));
    setHasCompletedOnboarding(true);
  };

  const handleResetDna = () => {
    localStorage.removeItem("clipr_dna");
    setHasCompletedOnboarding(false);
  };

  const handleSelectIdea = (idea: IdeaCard) => {
    setSelectedIdeaId(idea.id);
    setSelectedIdea(idea);
  };

  const handleExitCreateFlow = () => {
    setSelectedIdeaId(null);
    setSelectedIdea(null);
  };

  const normalizePlatform = (p: string): "TikTok" | "LinkedIn" | "Instagram" => {
    if (p === "LinkedIn") return "LinkedIn";
    if (p === "Reels" || p === "Instagram" || p === "Instagram Reels") return "Instagram";
    return "TikTok";
  };

  // "14:30" (24h input value) -> "2:30 PM" (calendar display)
  const formatTime = (t: string): string => {
    const [hStr, m] = (t || "09:00").split(":");
    let h = Number(hStr);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m ?? "00"} ${ampm}`;
  };

  const openScheduleModal = (draft?: { title?: string; platform?: string; day?: number }) => {
    setScheduleTitle(draft?.title ?? "");
    setSchedulePlatform(normalizePlatform(draft?.platform ?? selectedPlatform));
    setScheduleDay(draft?.day ?? selectedDate ?? 10);
    setScheduleTime("09:00");
    setScheduleOpen(true);
  };

  const confirmSchedule = () => {
    const day = scheduleDay;
    const displayTime = formatTime(scheduleTime);
    const post = {
      platform: schedulePlatform,
      title: scheduleTitle.trim() || "Untitled video",
      time: displayTime,
      status: "Scheduled" as const,
    };
    setCalendarPosts((prev) => ({ ...prev, [day]: [...(prev[day] ?? []), post] }));
    setScheduleOpen(false);
    setScheduleConfirmation(`Scheduled “${post.title}” to June ${day} at ${post.time}`);
    setActiveTab("Calendar");
    setSidebarActive("Calendar");
    setSelectedDate(day);
    setShowCalendarPanel(true);
  };

  const handleScheduleFromRender = (payload: {
    title: string;
    description: string;
    outputUrl: string;
    platform: string;
  }) => {
    // Keep the create flow mounted underneath the modal so its "back to
    // reference / subtitles" buttons can return without losing progress.
    openScheduleModal({
      title: payload.title,
      platform: payload.platform,
      day: selectedDate ?? 10,
    });
  };

  // From the schedule modal: close it and jump the still-mounted flow to a step.
  const jumpFlowToStep = (step: FlowStep) => {
    setScheduleOpen(false);
    setActiveTab("Create");
    setSidebarActive("Home");
    setFlowJumpStep(step);
  };

  const triggerGenerateIdeas = async () => {
    setIsGenerating(true);
    setSelectedIdeaId(null);
    setSelectedIdea(null);
    setIdeasError(null);
    setHeroExitState("exiting");

    // Exit animation duration is ~400ms, after which we hide the hero section and show the cards
    setTimeout(() => {
      setHeroExitState("hidden");
    }, 400);

    try {
      const savedDna = localStorage.getItem("clipr_dna");
      let dna = { product: "", audience: "", tone: "casual", samplePost: "", platform: "TikTok" };
      if (savedDna) {
        try { dna = JSON.parse(savedDna); } catch {}
      }

      const response = await fetch("/api/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: dna.product || "Clipr platform",
          audience: dna.audience || "content creators",
          tone: dna.tone || "casual",
          platform: selectedPlatform || dna.platform || "TikTok",
          prompt: inputVal
        })
      });

      if (!response.ok) {
        throw new Error("Failed to generate ideas from AI");
      }

      const aiIdeas: IdeaCard[] = await response.json();
      setIdeas(aiIdeas);
      setIsGenerating(false);
    } catch (err) {
      console.error("AI ideas generation failed, using dynamic fallback:", err);
      setIdeasError("AI не смог сгенерировать идеи. Показываем шаблонные варианты.");
      // Fallback to dynamic mock ideas
      const savedDna = localStorage.getItem("clipr_dna");
      if (savedDna) {
        try {
          const dna = JSON.parse(savedDna);
          setIdeas(generateDynamicIdeas(dna.product, dna.platform));
        } catch {
          setIdeas(IDEA_CARDS);
        }
      } else {
        setIdeas(IDEA_CARDS);
      }
      setIsGenerating(false);
    }
  };


  const getPlatformIcon = (platform: string, size = 14, monochrome = false) => {
    const s = `${size}px`;
    switch (platform) {
      case "LinkedIn":
        return (
          <svg style={{ width: s, height: s }} viewBox="0 0 24 24" fill="none" className="shrink-0">
            <rect width="24" height="24" rx="4" fill={monochrome ? "#6B7C85" : "#0A66C2"} />
            <path d="M7.5 9.5V17H5V9.5H7.5ZM6.25 8.5C5.56 8.5 5 7.94 5 7.25C5 6.56 5.56 6 6.25 6C6.94 6 7.5 6.56 7.5 7.25C7.5 7.94 6.94 8.5 6.25 8.5ZM19 17H16.5V13.25C16.5 12.19 15.56 11.5 14.75 11.5C13.94 11.5 13.25 12.19 13.25 13V17H10.75V9.5H13.25V10.69C13.69 10.06 14.56 9.5 15.5 9.5C17.16 9.5 19 10.56 19 13.25V17Z" fill="white" />
          </svg>
        );
      case "Instagram":
      case "Reels":
      case "Instagram Reels":
        return (
          <svg style={{ width: s, height: s }} viewBox="0 0 24 24" fill="none" className="shrink-0">
            {monochrome ? (
              <rect width="24" height="24" rx="6" fill="#6B7C85" />
            ) : (
              <defs>
                <linearGradient id="ig-grad" x1="0" y1="24" x2="24" y2="0">
                  <stop offset="0%" stopColor="#FFDC80" />
                  <stop offset="25%" stopColor="#F77737" />
                  <stop offset="50%" stopColor="#E1306C" />
                  <stop offset="75%" stopColor="#C13584" />
                  <stop offset="100%" stopColor="#833AB4" />
                </linearGradient>
              </defs>
            )}
            {!monochrome && <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />}
            {monochrome && <rect width="24" height="24" rx="6" fill="#6B7C85" />}
            <rect x="4" y="4" width="16" height="16" rx="4.5" stroke="white" strokeWidth="2" fill="none" />
            <circle cx="12" cy="12" r="3.5" stroke="white" strokeWidth="2" fill="none" />
            <circle cx="17.5" cy="6.5" r="1.25" fill="white" />
          </svg>
        );
      case "TikTok":
      default:
        return (
          <svg style={{ width: s, height: s }} viewBox="0 0 24 24" fill="none" className="shrink-0">
            <rect width="24" height="24" rx="4" fill={monochrome ? "#6B7C85" : "#010101"} />
            <path d="M16.5 4.5C16.5 4.5 16.5 8.5 20 8.5V11C20 11 17.5 11.2 16.5 9.5V15.5C16.5 18.5 14.5 20.5 11.5 20.5C8.5 20.5 6 18.5 6 15.5C6 12.5 8.5 10.5 11 10.5V13.5C9.5 13.5 9 14.5 9 15.5C9 16.5 9.5 17.5 11.5 17.5C13.5 17.5 13.5 16 13.5 15.5V4.5H16.5Z" fill="white" />
            <path d="M16.5 4.5C16.5 4.5 16.5 8.5 20 8.5V11C20 11 17.5 11.2 16.5 9.5V15.5" stroke={monochrome ? "#6B7C85" : "#25F4EE"} strokeWidth="0.7" fill="none" />
            <path d="M13.5 15.5V4.5H16.5" stroke={monochrome ? "#6B7C85" : "#FE2C55"} strokeWidth="0.7" fill="none" />
          </svg>
        );
    }
  };

  const getTrendSourceIcon = (source: string, size = 14) => {
    const s = `${size}px`;
    if (source === "REDDIT") {
      return (
        <svg style={{ width: s, height: s }} viewBox="0 0 24 24" fill="none" className="shrink-0">
          <circle cx="12" cy="12" r="12" fill="#FF4500" />
          <ellipse cx="12" cy="14" rx="6" ry="4" fill="white" />
          <circle cx="9.5" cy="13.5" r="1" fill="#FF4500" />
          <circle cx="14.5" cy="13.5" r="1" fill="#FF4500" />
          <circle cx="12" cy="6.5" r="2.5" fill="white" />
          <path d="M14 5L17 3.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="17.5" cy="3.5" r="1.2" fill="#FF4500" stroke="white" strokeWidth="0.5" />
          <path d="M10 16.5C10.5 17.3 11.2 17.5 12 17.5C12.8 17.5 13.5 17.3 14 16.5" stroke="#FF4500" strokeWidth="0.8" strokeLinecap="round" fill="none" />
        </svg>
      );
    }
    if (source.includes("GOOGLE")) {
      return (
        <svg style={{ width: s, height: s }} viewBox="0 0 24 24" className="shrink-0">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
      );
    }
    // NEWS
    return (
      <svg style={{ width: s, height: s }} viewBox="0 0 24 24" fill="none" className="shrink-0">
        <rect width="24" height="24" rx="4" fill="#EF4444" />
        <path d="M5 7h10v2H5V7zm0 3h10v1.5H5V10zm0 2.5h7v1.5H5v-1.5zm0 2.5h10v1.5H5V15zm12-8v10h-1.5V8.5H17V7z" fill="white" />
      </svg>
    );
  };

  // Shared nav handler — used by both the desktop sidebar and the mobile bottom bar.
  const handleNav = (
    name: "Home" | "My Content" | "Calendar" | "References" | "Settings"
  ) => {
    setSidebarActive(name);
    if (name === "Home") {
      // Fresh start: back to the AI chat / idea generation
      setActiveTab("Create");
      setSelectedIdeaId(null);
      setSelectedIdea(null);
      setHeroExitState("visible");
      setIsGenerating(false);
    } else {
      setActiveTab(name);
    }
  };

  if (isLoadingOnboarding) {
    return (
      <div className="h-screen bg-[#070B0D] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasCompletedOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="relative h-screen bg-[#070B0D] text-[#EFEFEF] flex flex-col md:flex-row font-sans overflow-hidden antialiased text-[14px] leading-[1.6]">

      {/* ----------------------------------------------------
          LEFT SIDEBAR (220px, bg #0D1517, border-r #152226)
         ---------------------------------------------------- */}
      <aside className="hidden md:flex flex-col w-[220px] shrink-0 border-r border-[#152226] bg-[#0B1012] h-full p-5 justify-between relative z-10">
        <div className="space-y-8">

          {/* Logo */}
          <div
            onClick={() => window.location.href = '/'}
            className="flex items-center space-x-2 cursor-pointer hover:opacity-85 transition-opacity"
          >
            <Image
              src="/Clipr-logo.png"
              alt="Clipr"
              width={24}
              height={24}
              className="w-6 h-6 rounded-[6px] shadow-[0_0_12px_rgba(16,185,129,0.3)]"
            />
            <span className="text-lg font-bold tracking-tight text-[#EFEFEF] flex items-center leading-none">
              Clipr<span className="text-[#10B981] font-mono">.</span>
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {[
              { name: "Home", icon: <Home className="w-4 h-4" /> },
              { name: "My Content", icon: <Film className="w-4 h-4" /> },
              { name: "Calendar", icon: <CalendarIcon className="w-4 h-4" /> },
              { name: "References", icon: <Bookmark className="w-4 h-4" /> },
              { name: "Settings", icon: <Settings className="w-4 h-4" /> },
            ].map((link) => {
              const isActive = sidebarActive === link.name;
              return (
                <button
                  key={link.name}
                  onClick={() => handleNav(link.name as "Home" | "My Content" | "Calendar" | "References" | "Settings")}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-[10px] text-[14px] font-normal transition-all duration-200 border ${isActive
                    ? "glowing-active-nav text-[#EFEFEF] border-transparent"
                    : "border-transparent text-[#6B7C85] hover:text-[#EFEFEF] hover:bg-[#11191B]"
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className={isActive ? "text-[#10B981]" : "text-[#6B7C85]"}>{link.icon}</span>
                    <span>{link.name}</span>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card */}
        <div className="pt-4 border-t border-[#152226] space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-full bg-[#152226] flex items-center justify-center text-xs font-semibold text-[#EFEFEF]">
              A
            </div>
            <div>
              <span className="text-sm font-semibold text-[#EFEFEF] block leading-tight">Aidar</span>
              <span className="text-xs text-[#6B7C85] block mt-0.5">
                Pro · 7 days left
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* ----------------------------------------------------
          CENTER WORKSPACE (bg #070B0D)
         ---------------------------------------------------- */}
      <main className="flex-1 flex flex-col h-full relative z-10 bg-[#070B0D] overflow-hidden">

        {/* TOP NAVBAR */}
        <header className="h-16 md:h-12 border-b border-[#152226] bg-[#070B0D] px-4 md:px-6 flex items-center justify-between sticky top-0 z-20">
          {/* ----- MOBILE: logo mark + current section title (the sidebar is hidden) ----- */}
          <div className="md:hidden flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => handleNav("Home")}
              aria-label="Home"
              className="shrink-0 active:scale-95 transition-transform"
            >
              <Image
                src="/Clipr-logo.png"
                alt="Clipr"
                width={28}
                height={28}
                className="w-[28px] h-[28px] rounded-[7px] shadow-[0_0_12px_rgba(16,185,129,0.3)]"
              />
            </button>
            <span className="text-base font-semibold tracking-tight text-[#EFEFEF] truncate">
              {sidebarActive === "Home" ? (
                <>Clipr<span className="text-[#10B981] font-mono">.</span></>
              ) : (
                sidebarActive
              )}
            </span>
          </div>
          {/* Desktop placeholder (tabs removed) */}
          <div className="hidden md:flex items-center h-full space-x-6" />

          {/* ----- Right side ----- */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Desktop-only controls (kept off phones so the bar isn't a squished PC toolbar) */}
            <button className="hidden md:inline-flex text-[#6B7C85] hover:text-[#EFEFEF] transition-colors">
              <Search className="w-3.5 h-3.5" />
            </button>
            <button className="hidden md:inline-flex text-[#6B7C85] hover:text-[#EFEFEF] transition-colors relative">
              <Bell className="w-3.5 h-3.5" />
              <span className="absolute top-0 right-0 w-1 h-1 bg-[#10B981] rounded-full" />
            </button>
            <button
              onClick={handleResetDna}
              className="hidden md:inline-block text-[10px] text-[#6B7C85] hover:text-white border border-dashed border-[#152226] hover:border-[#10B981]/40 px-2 py-1 rounded transition-all"
              title="Restart onboarding (dev)"
            >
              ↻ Onboarding
            </button>
            <div className="hidden md:flex items-center space-x-2 text-xs text-[#6B7C85] hover:text-[#EFEFEF] cursor-pointer transition-colors">
              <span className="flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                </span>
                Connect accounts
              </span>
              <div className="flex items-center space-x-1 pl-1.5 border-l border-[#152226]">
                {getPlatformIcon("TikTok", 10)}
                {getPlatformIcon("LinkedIn", 10)}
              </div>
            </div>

            {/* MOBILE: profile avatar -> Settings */}
            <button
              onClick={() => handleNav("Settings")}
              aria-label="Settings"
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-full bg-[#152226] text-[13px] font-semibold text-[#EFEFEF] border border-[#1E2A2E] active:scale-95 transition-transform"
            >
              A
            </button>
          </div>
        </header>

        {/* WORKSPACE CONTENT */}
        <div className={`flex-1 w-full ${activeTab === "Create" ? "overflow-hidden" : "overflow-y-auto"}`}>
          <div className={`w-full mx-auto ${activeTab === "Create" ? "h-full max-w-5xl px-4 sm:px-6 py-4 pb-20 md:pb-4 flex flex-col justify-between" : "p-4 sm:p-6 md:p-8 pb-24 md:pb-8 max-w-4xl space-y-6"}`}>

            <AnimatePresence mode="wait">

              {/* ----------------------------------------------------
                TAB 1: CREATE
               ---------------------------------------------------- */}
              {activeTab === "Create" && (
                <motion.div
                  key="create-tab"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col h-full gap-4 min-h-0 overflow-hidden justify-center md:justify-start"
                >
                  {/* Modern Startup-themed Header & Input Workspace Card */}
                  {heroExitState !== 'hidden' && (
                    <div 
                      className={`transition-all duration-[400ms] ease-out flex flex-col items-center w-full shrink-0 ${
                        heroExitState === 'exiting' 
                          ? 'opacity-0 scale-95 pointer-events-none' 
                          : 'opacity-100 scale-100'
                      }`}
                    >
                      <div className="flex flex-col items-center text-center space-y-1.5 pb-2 pt-2 sm:pt-10 md:pt-24 select-none">
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#EFEFEF]">
                          What&apos;s your next viral hook<span className="text-[#10B981]">?</span>
                        </h1>
                        <p className="text-[10px] text-[#6B7C85] tracking-[0.5em] uppercase font-mono font-bold">
                          Clipr AI Content Engine
                        </p>
                      </div>

                      <div className="glowing-textarea-card rounded-[14px] p-4 relative max-w-3xl w-full mx-auto shrink-0 mt-8">
                        <div className="absolute inset-0 glow-bg-radial pointer-events-none z-0 rounded-[14px]" />
                        <div className="relative z-10 space-y-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-mono tracking-wider text-[#6B7C85] font-bold block">
                              WHAT&apos;S YOUR NEXT VIDEO ABOUT?
                            </label>
                            <textarea
                              ref={textareaRef}
                              value={inputVal}
                              onChange={handleTextareaChange}
                              className="w-full bg-transparent text-[#EFEFEF] border-0 outline-none p-0 text-sm font-normal resize-none placeholder:text-[#6B7C85] focus:ring-0 scrollbar-thin"
                              placeholder="Explain why something matters in your industry..."
                              style={{ overflowY: 'hidden' }}
                            />
                          </div>

                          <div className="flex flex-wrap justify-between items-center gap-y-2.5 pt-2 border-t border-[#152226]">
                            <div className="flex items-center gap-2.5 sm:gap-4">
                              {/* Platform Dropdown */}
                              <div className="relative">
                                <button
                                  onClick={() => {
                                    setIsPlatformOpen(!isPlatformOpen);
                                    setIsFormatOpen(false);
                                  }}
                                  className="flex items-center space-x-2 px-3 py-1.5 rounded-full text-[11px] font-semibold border bg-[#070B0D] border-[#152226] hover:border-[#10B981]/30 text-[#EFEFEF] transition-all"
                                >
                                  {getPlatformIcon(selectedPlatform, 10, true)}
                                  <span>Platform: {selectedPlatform}</span>
                                  <svg className={`w-3 h-3 text-[#6B7C85] transition-transform ${isPlatformOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                {isPlatformOpen && (
                                  <div className="absolute left-0 top-full mt-2 w-44 rounded-xl bg-[#0D1416] border border-[#152226] shadow-2xl z-30 p-1 divide-y divide-[#152226]/30">
                                    {(["TikTok", "LinkedIn", "Reels"] as const).map((plat) => (
                                      <button
                                        key={plat}
                                        onClick={() => {
                                          setSelectedPlatform(plat);
                                          setIsPlatformOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-[#11191B] hover:text-[#10B981] transition-all flex items-center space-x-2 ${selectedPlatform === plat ? "text-[#10B981] bg-[#11191B]/50 font-bold" : "text-[#6B7C85]"
                                          }`}
                                      >
                                        <span style={{ opacity: 0.65 }}>{getPlatformIcon(plat, 12, true)}</span>
                                        <span>{plat}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="w-[1px] h-3 bg-[#152226]" />

                              {/* Format Dropdown */}
                              <div className="relative">
                                <button
                                  onClick={() => {
                                    setIsFormatOpen(!isFormatOpen);
                                    setIsPlatformOpen(false);
                                  }}
                                  className="flex items-center space-x-2 px-3 py-1.5 rounded-full text-[11px] font-semibold border bg-[#070B0D] border-[#152226] hover:border-[#10B981]/30 text-[#EFEFEF] transition-all"
                                >
                                  <span>Format: {selectedPostType === "Video" ? "Video Post" : "Text Post"}</span>
                                  <svg className={`w-3 h-3 text-[#6B7C85] transition-transform ${isFormatOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                {isFormatOpen && (
                                  <div className="absolute left-0 top-full mt-2 w-52 rounded-xl bg-[#0D1416] border border-[#152226] shadow-2xl z-30 p-1 space-y-0.5">
                                    <button
                                      onClick={() => {
                                        setSelectedPostType("Video");
                                        setIsFormatOpen(false);
                                      }}
                                      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs hover:bg-[#11191B] hover:text-[#10B981] transition-all flex items-center justify-between ${selectedPostType === "Video" ? "text-[#10B981] bg-[#11191B]/50 font-bold" : "text-[#6B7C85]"
                                        }`}
                                    >
                                      <span>Video post</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        alert("Text post format requires premium Clipr subscription.");
                                        setIsFormatOpen(false);
                                      }}
                                      className="w-full text-left px-3 py-2.5 rounded-lg text-xs hover:bg-[#11191B] text-[#6B7C85] transition-all flex items-center justify-between opacity-80 cursor-not-allowed"
                                    >
                                      <span>Text post</span>
                                      <svg className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
                                        <path d="M3 20h18a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1z" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Generate button */}
                            <button
                              className="bg-[#10B981] hover:bg-[#12cf90] text-[#070B0D] hover:scale-[1.02] active:scale-[0.98] transition-all text-xs font-bold rounded-full px-4 py-1.5 flex items-center justify-center space-x-1.5 shadow-md"
                              onClick={triggerGenerateIdeas}
                              disabled={isGenerating}
                            >
                              <span>{isGenerating ? "Creating..." : "Create"}</span>
                              {!isGenerating && <span className="text-xs font-bold">→</span>}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ideas Feed (responsive grid, up to 3 cols) — fits all 6 ideas without scrolling, hidden once an idea is selected */}
                  {heroExitState === 'hidden' && !selectedIdeaId && (
                    <div className="w-full flex-1 flex flex-col items-center justify-center min-h-0 overflow-y-auto px-4 py-6 scrollbar-thin">
                      {ideasError && (
                        <div className="text-[11px] mb-4 text-amber-400 bg-amber-950/20 border border-amber-500/20 px-3 py-1.5 rounded-lg max-w-[1080px] w-full text-center">
                          {ideasError}
                        </div>
                      )}
                      <div className="w-full max-w-[1080px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {isGenerating ? (
                          // Render 6 skeleton cards
                          [1, 2, 3, 4, 5, 6].map((n) => (
                            <div
                              key={n}
                              className="flex h-full min-h-[160px] flex-col rounded-2xl p-5 border border-[#152226] bg-[#0D1416] animate-pulse"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="h-5 w-20 bg-white/5 rounded-full" />
                                <div className="h-5 w-24 bg-[rgba(16,185,129,0.12)] rounded-full" />
                              </div>
                              <div className="h-5 w-2/3 bg-white/10 rounded mt-4" />
                              <div className="h-4 w-5/6 bg-white/5 rounded mt-3" />
                              <div className="h-3 w-16 bg-white/5 rounded mt-auto" />
                            </div>
                          ))
                        ) : (
                          // Render actual ideas (up to 6)
                          ideas.slice(0, 6).map((idea, idx) => (
                            <div
                              key={idea.id}
                              onClick={() => setModalIdea(idea)}
                              className="group flex h-full flex-col rounded-2xl p-5 bg-[#0D1416] border border-[#152226] cursor-pointer hover:border-[#10B981]/50 hover:bg-[#0F181A] transition-all duration-300 opacity-0 translate-y-[24px] animate-card-slide-up shadow-[0_0_24px_rgba(16,185,129,0.06)]"
                              style={{ animationDelay: `${idx * 80}ms` }}
                            >
                              {/* Card Header Row */}
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] uppercase tracking-wider font-medium border border-[#152226] bg-[#11191B] rounded-full px-2.5 py-1 text-[#6B7C85] truncate min-w-0">
                                  {idea.vibe || idea.tags[0] || "dark and focused"}
                                </span>
                                <span className="text-[9px] uppercase font-bold tracking-wider text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/25 rounded-full px-2 py-1 shrink-0">
                                  {idea.estimate || "High potential"}
                                </span>
                              </div>

                              {/* Card Title */}
                              <h3 className="text-[17px] font-bold text-white mt-3 leading-snug line-clamp-2">
                                {idea.title}
                              </h3>

                              {/* Hook phrase */}
                              <p className="text-[13px] text-[var(--text-secondary)] mt-2 leading-relaxed line-clamp-2 italic">
                                &ldquo;{idea.hook}&rdquo;
                              </p>

                              {/* Footer CTA */}
                              <div className="mt-auto pt-4 flex items-center gap-1 text-[12px] font-semibold text-[#6B7C85] group-hover:text-[#10B981] transition-colors">
                                <span>View idea</span>
                                <span className="transition-transform group-hover:translate-x-0.5">→</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                      {selectedIdeaId && selectedIdea && (
                        <div className="flex-1 min-h-0 overflow-hidden -mx-4 sm:-mx-6 -mb-4 flex flex-col">
                          <CreateFlow
                            idea={{
                              id: selectedIdea.id,
                              title: selectedIdea.title,
                              hook: selectedIdea.hook,
                              vibe: selectedIdea.vibe || selectedIdea.tags[0] || "dark and focused",
                              platform: selectedIdea.tags[1] || selectedPlatform,
                              estimate: selectedIdea.estimate,
                            }}
                            defaultPlatform={selectedPlatform}
                            onBack={handleExitCreateFlow}
                            onSchedulePost={handleScheduleFromRender}
                            jumpToStep={flowJumpStep}
                            onJumpHandled={() => setFlowJumpStep(null)}
                          />
                        </div>
                      )}
                </motion.div>
              )}

              {/* ----------------------------------------------------
                TAB 2: CALENDAR
               ---------------------------------------------------- */}
              {activeTab === "Calendar" && (
                <motion.div
                  key="calendar-tab"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-[#152226] pb-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold text-[#EFEFEF]">Content Calendar</h2>
                      <p className="text-xs text-[#6B7C85]">Plan, schedule &amp; auto-post your content.</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#0D1416] border border-[#152226] p-12 sm:p-16 text-center flex flex-col items-center gap-4 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 50% 0%, #10B981, transparent 60%)" }} />
                    <div className="w-14 h-14 rounded-2xl bg-[#070B0D] border border-[#152226] flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.12)] relative">
                      <CalendarRange className="w-6 h-6 text-[#10B981]" />
                    </div>
                    <span className="relative text-[10px] uppercase tracking-[0.2em] font-mono text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/25 px-3 py-1 rounded-full">Coming soon</span>
                    <h3 className="relative text-xl font-semibold text-[#EFEFEF]">Schedule &amp; auto-post</h3>
                    <p className="relative text-sm text-[#6B7C85] max-w-sm leading-relaxed">Plan your week and let Clipr post your videos to TikTok, Reels &amp; LinkedIn automatically — right from your calendar. We&apos;re putting the finishing touches on it.</p>
                    <div className="relative flex flex-wrap items-center justify-center gap-2 pt-2">
                      {(["TikTok", "Instagram", "LinkedIn"] as const).map((plat) => (
                        <span key={plat} className="inline-flex items-center gap-1.5 text-[11px] text-[#6B7C85] border border-[#152226] bg-[#070B0D] px-2.5 py-1 rounded-full">
                          {getPlatformIcon(plat, 12)}<span>{plat}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ----------------------------------------------------
                TAB 3: MY CONTENT
               ---------------------------------------------------- */}
              {activeTab === "My Content" && (
                <motion.div
                  key="content-tab"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-[#152226] pb-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold text-[#EFEFEF]">My Content</h2>
                      <p className="text-xs text-[#6B7C85]">Every video Clipr has made for you.</p>
                    </div>
                    <span className="text-xs text-[#6B7C85] font-mono">
                      {savedContent.length} video{savedContent.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {savedContent.length === 0 ? (
                    /* Empty state */
                    <div className="rounded-xl bg-[#0D1416] border border-dashed border-[#152226] p-12 text-center flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#070B0D] border border-[#152226] flex items-center justify-center">
                        <Film className="w-5 h-5 text-[#6B7C85]" />
                      </div>
                      <p className="text-sm text-[#EFEFEF] font-medium">No videos yet</p>
                      <p className="text-xs text-[#6B7C85] max-w-xs">
                        Videos you render show up here automatically. Make your first one from the Home tab.
                      </p>
                      <button
                        onClick={() => {
                          setSidebarActive("Home");
                          setActiveTab("Create");
                          setSelectedIdeaId(null);
                          setSelectedIdea(null);
                          setHeroExitState("visible");
                        }}
                        className="mt-2 bg-[#10B981] hover:bg-[#0D9E6E] text-[#070B0D] text-xs font-semibold rounded-lg px-4 py-2 transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                      >
                        Create a video
                      </button>
                    </div>
                  ) : (
                    /* Grid of rendered videos */
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {savedContent.map((item) => (
                        <div
                          key={item.id}
                          className="group rounded-xl bg-[#0D1416] hover:bg-[#10191B] border border-[#152226] overflow-hidden flex flex-col transition-all duration-150"
                        >
                          {/* Real video (play/fullscreen inline) */}
                          <div className="relative aspect-[9/16] bg-[#070B0D]">
                            <video
                              src={resolveBackendUrl(item.output_url)}
                              className="w-full h-full object-cover"
                              controls
                              playsInline
                              preload="metadata"
                            />
                            <span className="absolute top-2 left-2 z-10 pointer-events-none text-[9px] text-[#EFEFEF] border border-[#152226] bg-[#0D1416]/90 px-1.5 py-0.5 rounded flex items-center space-x-1">
                              {getPlatformIcon(item.platform, 8)}
                              <span>{item.platform}</span>
                            </span>
                          </div>

                          {/* Info */}
                          <div className="p-3 flex flex-col gap-2">
                            <h4 className="text-xs font-semibold text-[#EFEFEF] line-clamp-2 leading-relaxed">
                              {item.title}
                            </h4>
                            <div className="flex justify-between items-center pt-2 border-t border-[#152226]">
                              <span className="text-[10px] text-[#6B7C85] font-mono">{item.date}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handlePostSavedToX(item)}
                                  disabled={xPostingId === item.id}
                                  title={xStatus?.connected ? "Post to X" : "Connect X to post"}
                                  className="p-1 rounded text-[#6B7C85] hover:text-[#10B981] transition-colors disabled:opacity-50"
                                >
                                  {xPostingId === item.id ? (
                                    <span className="block w-3.5 h-3.5 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <XLogo className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <a
                                  href={resolveBackendUrl(item.output_url)}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Download"
                                  className="p-1 rounded text-[#6B7C85] hover:text-[#10B981] transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  onClick={() => deleteSavedVideo(item.id)}
                                  title="Delete"
                                  className="p-1 rounded text-[#6B7C85] hover:text-[#EF8B8B] transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ----------------------------------------------------
                TAB 4: REFERENCES
               ---------------------------------------------------- */}
              {activeTab === "References" && (
                <motion.div
                  key="references-tab"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-[#152226] pb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-[#EFEFEF]">References</h2>
                      <p className="text-xs text-[#6B7C85] mt-0.5">
                        The clips your video styles are learned from
                      </p>
                    </div>
                    <span className="text-xs text-[#6B7C85] font-mono">
                      Total: {references.length}
                    </span>
                  </div>

                  {refsLoading ? (
                    <div className="flex items-center justify-center py-16 text-[#6B7C85] text-sm">
                      Loading references…
                    </div>
                  ) : refsError ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Film className="w-8 h-8 text-[#3A1E1E]" />
                      <p className="text-sm text-[#EF8B8B] mt-3">Couldn&apos;t load references.</p>
                      <p className="text-xs text-[#6B7C85] mt-1 max-w-md">{refsError}</p>
                    </div>
                  ) : references.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Bookmark className="w-8 h-8 text-[#1E343A]" />
                      <p className="text-sm text-[#6B7C85] mt-3">No references yet.</p>
                      <p className="text-xs text-[#6B7C85] mt-1">
                        Drop videos in backend/reference_videos and run the template extractor.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {references.map((ref) => (
                        <div
                          key={ref.id}
                          className="rounded-xl bg-[#0D1416] border border-[#152226] overflow-hidden hover:border-[#1E343A] transition-colors"
                        >
                          <div className="relative aspect-[9/16] bg-[#070B0D]">
                            {ref.preview_url ? (
                              <video
                                src={resolveBackendUrl(ref.preview_url)}
                                className={`w-full h-full object-cover ${ref.wip ? "opacity-40 grayscale" : ""}`}
                                muted
                                loop
                                autoPlay
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Film className="w-6 h-6 text-[#1E343A]" />
                              </div>
                            )}
                            {ref.wip && (
                              <div className="absolute inset-0 flex items-center justify-center bg-[#070B0D]/45">
                                <span className="px-2.5 py-1 rounded-full bg-[#1C1C1C]/90 border border-[#3A4A50] text-[10px] font-semibold uppercase tracking-wider text-[#EFEFEF]">
                                  In development
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-[11px] text-[#EFEFEF] line-clamp-2 leading-snug">
                              {(ref.label || "Reference").replace(/^Ref:\s*/, "")}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              <span className="text-[9px] uppercase tracking-wider font-semibold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/25 px-1.5 py-0.5 rounded-full">
                                {(ref.color_grade || "").replace(/_/g, " ")}
                              </span>
                              {ref.measured?.bpm != null && (
                                <span className="text-[9px] text-[#6B7C85] bg-[#070B0D] border border-[#152226] px-1.5 py-0.5 rounded-full font-mono">
                                  {Math.round(ref.measured.bpm)} bpm
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ----------------------------------------------------
                TAB 5: SETTINGS
               ---------------------------------------------------- */}
              {activeTab === "Settings" && (
                <motion.div
                  key="settings-tab"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6 max-w-3xl"
                >
                  <div className="space-y-1 border-b border-[#152226] pb-4">
                    <h2 className="text-base font-semibold text-[#EFEFEF]">Settings</h2>
                    <p className="text-xs text-[#6B7C85]">Manage your account, brand voice and connections.</p>
                  </div>

                  {/* Account */}
                  <section className="rounded-xl bg-[#0D1416] border border-[#152226] p-5 space-y-4">
                    <h3 className="text-[10px] uppercase font-mono tracking-widest text-[#6B7C85] font-semibold">Account</h3>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-[#152226] flex items-center justify-center text-sm font-semibold text-[#EFEFEF]">A</div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#EFEFEF]">Aidar</p>
                        <p className="text-xs text-[#6B7C85] truncate">aidar@clipr.ai</p>
                      </div>
                      <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/25 px-2.5 py-1 rounded-full">Pro · 7 days left</span>
                    </div>
                    <button className="text-xs text-[#EFEFEF] bg-[#11191B] border border-[#152226] rounded-lg px-3 py-2 hover:bg-[#152226] transition-colors">Manage plan</button>
                  </section>

                  {/* Brand DNA */}
                  <section className="rounded-xl bg-[#0D1416] border border-[#152226] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] uppercase font-mono tracking-widest text-[#6B7C85] font-semibold">Brand DNA</h3>
                      <button onClick={handleResetDna} className="text-[11px] text-[#10B981] hover:text-[#12cf90] hover:underline flex items-center gap-1"><Edit2 className="w-3 h-3" />Edit</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: "Product / niche", value: dnaInfo.product },
                        { label: "Audience", value: dnaInfo.audience },
                        { label: "Tone of voice", value: dnaInfo.tone },
                        { label: "Default platform", value: dnaInfo.platform },
                      ].map((row) => (
                        <div key={row.label} className="rounded-lg bg-[#070B0D] border border-[#152226] px-3 py-2.5">
                          <p className="text-[9px] uppercase tracking-wider font-mono text-[#6B7C85]">{row.label}</p>
                          <p className="text-xs text-[#EFEFEF] mt-1 truncate">{row.value || "—"}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Connected accounts */}
                  <section className="rounded-xl bg-[#0D1416] border border-[#152226] p-5 space-y-4">
                    <h3 className="text-[10px] uppercase font-mono tracking-widest text-[#6B7C85] font-semibold">Connected accounts</h3>
                    <div className="space-y-2">
                      {/* X (Twitter) — the live one: real OAuth connect + auto-post */}
                      <div className="flex items-center justify-between rounded-lg bg-[#070B0D] border border-[#152226] px-3 py-2.5">
                        <span className="flex items-center gap-2 text-xs text-[#EFEFEF]">
                          <XLogo className="w-3.5 h-3.5 text-[#EFEFEF]" />
                          <span>X (Twitter)</span>
                          {xStatus?.connected && xStatus.username && (
                            <span className="text-[#6B7C85]">@{xStatus.username}</span>
                          )}
                        </span>
                        {xStatus?.connected ? (
                          <div className="flex items-center gap-2.5">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#10B981]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                              Connected
                            </span>
                            <button
                              onClick={handleDisconnectX}
                              className="text-[11px] text-[#6B7C85] hover:text-[#EF8B8B] border border-[#152226] hover:border-[#EF8B8B]/40 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              Disconnect
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              startTwitterConnect().catch((e) =>
                                setXToast({
                                  kind: "error",
                                  text: `Couldn't start X connect: ${
                                    e instanceof Error ? e.message : "try again"
                                  }`,
                                })
                              )
                            }
                            className="text-[11px] font-semibold text-[#070B0D] bg-[#10B981] hover:bg-[#12cf90] px-3 py-1.5 rounded-lg transition-colors shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                          >
                            Connect
                          </button>
                        )}
                      </div>
                      {(["TikTok", "Instagram", "LinkedIn"] as const).map((plat) => (
                        <div key={plat} className="flex items-center justify-between rounded-lg bg-[#070B0D] border border-[#152226] px-3 py-2.5">
                          <span className="flex items-center gap-2 text-xs text-[#EFEFEF]">{getPlatformIcon(plat, 14)}<span>{plat}</span></span>
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-[#6B7C85] border border-[#152226] px-2.5 py-1 rounded-lg cursor-not-allowed">
                            Connect
                            <span className="text-[8px] uppercase tracking-wider text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/25 px-1 rounded-full">soon</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Preferences */}
                  <section className="rounded-xl bg-[#0D1416] border border-[#152226] p-5 space-y-4">
                    <h3 className="text-[10px] uppercase font-mono tracking-widest text-[#6B7C85] font-semibold">Preferences</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#EFEFEF]">Theme</span>
                      <span className="flex items-center gap-2 text-xs text-[#6B7C85]"><span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />Dark</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#EFEFEF]">Default platform</span>
                      <div className="flex items-center gap-1.5">
                        {(["TikTok", "LinkedIn", "Reels"] as const).map((plat) => (
                          <button key={plat} onClick={() => setSelectedPlatform(plat)} className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${selectedPlatform === plat ? "border-[#10B981] text-[#10B981] bg-[#10B981]/10" : "border-[#152226] text-[#6B7C85] hover:text-[#EFEFEF]"}`}>{plat}</button>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* Danger zone */}
                  <section className="rounded-xl bg-[#0D1416] border border-[#3A1A1A] p-5 space-y-3">
                    <h3 className="text-[10px] uppercase font-mono tracking-widest text-[#EF8B8B] font-semibold">Danger zone</h3>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs text-[#EFEFEF]">Reset onboarding</p>
                        <p className="text-[11px] text-[#6B7C85] mt-0.5">Clears your brand DNA and restarts the setup flow.</p>
                      </div>
                      <button onClick={handleResetDna} className="shrink-0 text-xs text-[#EF8B8B] border border-[#3A1A1A] hover:bg-[#EF8B8B]/10 rounded-lg px-3 py-2 transition-colors">Reset</button>
                    </div>
                  </section>
                </motion.div>
              )}

            </AnimatePresence>

          </div>
        </div>

      </main>

      {/* ----------------------------------------------------
          RIGHT SIDEBAR: TRENDS (280px, bg #0B1012, border-l #152226)
         ---------------------------------------------------- */}
      <aside className={`hidden lg:flex flex-col shrink-0 border-[#152226] bg-[#0B1012] p-5 justify-between relative z-10 transition-all duration-300 h-full overflow-y-auto ${rightSidebarCollapsed ? "w-0 p-0 border-l-0 opacity-0 overflow-hidden" : "w-[280px] border-l"
        }`}>

        {/* Trend feeds */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#152226] pb-3">
            <div className="flex items-center space-x-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
              </span>
              <h3 className="text-xs font-semibold text-[#EFEFEF]">Trending now</h3>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[9px] text-[#6B7C85] uppercase font-mono tracking-wider">LIVE</span>
              <button
                onClick={() => setRightSidebarCollapsed(true)}
                className="p-1 rounded text-[#6B7C85] hover:text-[#EFEFEF] hover:bg-[#152226] transition-colors"
                title="Hide trends"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="divide-y divide-[#152226]">
            {TRENDS_DATA.map((trend) => {
              let sourceColor = "text-[#6B7C85]";
              if (trend.source === "REDDIT") sourceColor = "text-[#FF4500]";
              else if (trend.source.includes("GOOGLE")) sourceColor = "text-[#4285F4]";
              else if (trend.source === "NEWS") sourceColor = "text-[#EF4444]";

              return (
                <div
                  key={trend.id}
                  className="py-4 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-mono tracking-widest font-bold ${sourceColor} flex items-center space-x-1.5`}>
                      {getTrendSourceIcon(trend.source, 12)}
                      <span>{trend.source}</span>
                    </span>
                    <span className="text-[9px] text-[#6B7C85] font-mono">{trend.time}</span>
                  </div>

                  <h4 className="text-xs font-semibold text-[#EFEFEF] leading-normal line-clamp-2">
                    {trend.title}
                  </h4>

                  <button
                    onClick={() => {
                      setInputVal(`Write a direct, short-form ${selectedPlatform === "LinkedIn" ? "LinkedIn post" : "TikTok script"} addressing the sudden trend: "${trend.title}". Keep it punchy!`);
                      setActiveTab("Create");
                    }}
                    className="text-[10px] font-semibold text-[#10B981] hover:text-[#12cf90] transition-colors flex items-center space-x-1"
                  >
                    <span>Write my take</span>
                    <span>→</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Voice Customizer */}
        <div className="border-t border-[#152226] pt-4 space-y-3 relative z-10 bg-[#0B1012]">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-mono tracking-wide text-[#6B7C85] font-semibold">
              YOUR VOICE SETTINGS
            </span>
            <button
              onClick={() => setIsEditingVoice(!isEditingVoice)}
              className="text-[#6B7C85] hover:text-[#EFEFEF] transition-colors p-1"
            >
              <Edit2 className="w-3 h-3 text-[#10B981]" />
            </button>
          </div>

          {isEditingVoice ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] text-[#6B7C85] font-mono block">Tone</label>
                <input
                  type="text"
                  value={voiceTone}
                  onChange={(e) => setVoiceTone(e.target.value)}
                  className="w-full bg-[#070B0D] border border-[#152226] rounded px-2 py-1.5 text-xs text-[#EFEFEF] outline-none focus:border-[#10B981]/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-[#6B7C85] font-mono block">Preview</label>
                <textarea
                  value={voicePreview}
                  onChange={(e) => setVoicePreview(e.target.value)}
                  className="w-full bg-[#070B0D] border border-[#152226] rounded p-2 text-xs text-[#EFEFEF] outline-none resize-none h-16 focus:border-[#10B981]/50"
                />
              </div>
              <button
                onClick={() => setIsEditingVoice(false)}
                className="w-full py-1.5 text-[10px] font-bold bg-[#10B981] hover:bg-[#12cf90] text-[#070B0D] rounded transition-colors"
              >
                Save settings
              </button>
              <button
                onClick={() => {
                  handleResetDna();
                  setIsEditingVoice(false);
                }}
                className="w-full py-1.5 text-[10px] font-semibold border border-red-500/20 hover:border-red-500/60 hover:bg-red-950/20 text-red-400/90 rounded transition-all mt-1"
              >
                Сбросить ДНК
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] text-[#6B7C85]">Tone:</span>
                <span className="text-[10px] text-[#EFEFEF] font-semibold">{voiceTone}</span>
              </div>
              <p className="text-[10px] text-[#6B7C85] leading-relaxed italic">
                &ldquo;{voicePreview}&rdquo;
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* ----------------------------------------------------
          MOBILE BOTTOM NAV (md:hidden) — replaces the hidden sidebar on phones
         ---------------------------------------------------- */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t border-[#152226] bg-[#0B1012]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        {[
          { name: "Home", label: "Home", icon: <Home className="w-5 h-5" /> },
          { name: "My Content", label: "Content", icon: <Film className="w-5 h-5" /> },
          { name: "Calendar", label: "Calendar", icon: <CalendarIcon className="w-5 h-5" /> },
          { name: "References", label: "Refs", icon: <Bookmark className="w-5 h-5" /> },
          { name: "Settings", label: "Settings", icon: <Settings className="w-5 h-5" /> },
        ].map((link) => {
          const isActive = sidebarActive === link.name;
          return (
            <button
              key={link.name}
              onClick={() =>
                handleNav(link.name as "Home" | "My Content" | "Calendar" | "References" | "Settings")
              }
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                isActive ? "text-[#10B981]" : "text-[#6B7C85] hover:text-[#EFEFEF]"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              )}
              {link.icon}
              <span>{link.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modal Expansion */}
      <AnimatePresence>
        {modalIdea && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalIdea(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-[8px]"
              transition={{ duration: 0.35 }}
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="relative w-full max-w-[560px] rounded-[20px] p-6 sm:p-[32px] border shadow-2xl z-10 overflow-hidden"
              style={{
                background: 'rgba(13, 20, 22, 0.96)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                boxShadow: '0 0 32px rgba(16, 185, 129, 0.12), inset 0 1px 0 rgba(255,255,255,0.04)'
              }}
            >
              {/* Close Button */}
              <button
                onClick={() => setModalIdea(null)}
                className="absolute top-6 right-6 text-white hover:opacity-80 transition-opacity"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}
              >
                ✕
              </button>

              {/* Title */}
              <h2 className="text-[22px] font-bold text-white pr-8 leading-snug">
                {modalIdea.title}
              </h2>

              {/* Full Description */}
              <p className="text-[15px] text-[var(--text-secondary)] mt-4 leading-[1.6]">
                {modalIdea.hook}
              </p>

              {/* Divider */}
              <div 
                className="my-6" 
                style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}
              />

              {/* Bottom Row */}
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-mono tracking-widest text-[var(--text-muted)] font-semibold">
                  POTENTIAL ANALYSIS
                </span>
                <button
                  onClick={() => {
                    handleSelectIdea(modalIdea);
                    setModalIdea(null);
                  }}
                  className="text-[#10B981] font-semibold text-[15px] flex items-center gap-1 hover:opacity-85 transition-opacity"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Create storyboard <span className="ml-1">→</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Schedule Modal */}
      <AnimatePresence>
        {scheduleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setScheduleOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-[8px]"
              transition={{ duration: 0.25 }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative w-full max-w-[440px] rounded-2xl bg-[#0D1416] border border-[#152226] p-6 z-10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-[#EFEFEF]">Schedule post</h2>
                  <p className="text-xs text-[#6B7C85] mt-0.5">Pick a day and time on your calendar</p>
                </div>
                <button
                  onClick={() => setScheduleOpen(false)}
                  className="text-[#6B7C85] hover:text-[#EFEFEF] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedIdea && (
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-[#6B7C85] mr-1">
                    Go back to edit
                  </span>
                  {([
                    { label: "Subtitles", step: 2 },
                    { label: "Clips & music", step: 3 },
                    { label: "Reference", step: 4 },
                  ] as { label: string; step: FlowStep }[]).map((b) => (
                    <button
                      key={b.step}
                      type="button"
                      onClick={() => jumpFlowToStep(b.step)}
                      className="inline-flex items-center gap-1 rounded-full border border-[#152226] bg-[#070B0D] px-3 py-1.5 text-xs text-[#6B7C85] hover:text-[#10B981] hover:border-[#10B981]/40 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      {b.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#6B7C85] font-bold">
                    Title
                  </label>
                  <input
                    value={scheduleTitle}
                    onChange={(e) => setScheduleTitle(e.target.value)}
                    placeholder="Video title"
                    className="w-full bg-[#070B0D] border border-[#152226] rounded-lg px-3 py-2.5 text-sm text-[#EFEFEF] outline-none focus:border-[#10B981] transition-colors placeholder:text-[#6B7C85]"
                  />
                </div>

                {/* Platform */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#6B7C85] font-bold">
                    Platform
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["TikTok", "Instagram", "LinkedIn"] as const).map((plat) => {
                      const active = schedulePlatform === plat;
                      return (
                        <button
                          key={plat}
                          onClick={() => setSchedulePlatform(plat)}
                          className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                            active
                              ? "border-[#10B981] bg-[#10B981]/10 text-[#EFEFEF]"
                              : "border-[#152226] bg-[#070B0D] text-[#6B7C85] hover:border-[#1E343A]"
                          }`}
                        >
                          {getPlatformIcon(plat, 14)}
                          <span>{plat}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date + Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-mono tracking-wider text-[#6B7C85] font-bold">
                      Date
                    </label>
                    <input
                      type="date"
                      min="2026-06-01"
                      max="2026-06-30"
                      value={`2026-06-${String(scheduleDay).padStart(2, "0")}`}
                      onChange={(e) => {
                        const d = Number(e.target.value.split("-")[2]);
                        if (d >= 1 && d <= 30) setScheduleDay(d);
                      }}
                      className="w-full bg-[#070B0D] border border-[#152226] rounded-lg px-3 py-2.5 text-sm text-[#EFEFEF] outline-none focus:border-[#10B981] transition-colors [color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-mono tracking-wider text-[#6B7C85] font-bold">
                      Time
                    </label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full bg-[#070B0D] border border-[#152226] rounded-lg px-3 py-2.5 text-sm text-[#EFEFEF] outline-none focus:border-[#10B981] transition-colors [color-scheme:dark]"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-[#6B7C85]">
                  Will post on{" "}
                  <span className="text-[#EFEFEF] font-medium">June {scheduleDay}, 2026</span> at{" "}
                  <span className="text-[#EFEFEF] font-medium">{formatTime(scheduleTime)}</span>
                </p>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setScheduleOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-[#152226] text-[#6B7C85] text-sm font-medium hover:text-[#EFEFEF] hover:border-[#1E343A] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSchedule}
                  className="flex-1 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#0D9E6E] text-[#070B0D] text-sm font-bold transition-all flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                >
                  <Check className="w-4 h-4" />
                  Add to calendar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* X connect / disconnect toast (post-OAuth round-trip) */}
      <AnimatePresence>
        {xToast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-[60] max-w-[calc(100vw-2rem)] sm:max-w-sm"
          >
            <div
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md ${
                xToast.kind === "ok"
                  ? "bg-[#0D1416]/95 border-[#10B981]/40"
                  : "bg-[#1A1012]/95 border-[#EF8B8B]/40"
              }`}
            >
              <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  xToast.kind === "ok" ? "bg-[#10B981]/15" : "bg-[#EF8B8B]/15"
                }`}
              >
                {xToast.kind === "ok" ? (
                  <Check className="h-3 w-3 text-[#10B981]" />
                ) : (
                  <X className="h-3 w-3 text-[#EF8B8B]" />
                )}
              </div>
              <p className="text-xs leading-relaxed text-[#EFEFEF]">{xToast.text}</p>
              <button
                onClick={() => setXToast(null)}
                className="ml-1 shrink-0 text-[#6B7C85] hover:text-[#EFEFEF] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
