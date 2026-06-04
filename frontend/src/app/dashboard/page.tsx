"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "../globals.css";
import {
  Scissors,
  Home,
  Film,
  Calendar as CalendarIcon,
  Bookmark,
  Settings,
  Search,
  Bell,
  Play,
  CalendarRange,
  Edit2,
  MoreVertical,
  X,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { OnboardingFlow } from "@/components/OnboardingFlow";

// ----------------------------------------------------
// MOCK DATA & CONFIG
// ----------------------------------------------------

interface IdeaCard {
  id: string;
  title: string;
  hook: string;
  tags: string[];
  estimate: string;
  script?: ScriptVariant;
}

const SCRIPT_LOADING_MESSAGES = [
  "generating...",
  "thinking...",
  "structuring hook...",
  "writing problem & solution...",
  "finalizing script...",
];
const SCRIPT_LOADING_MIN_MS = 3500;
const SCRIPT_LOADING_MESSAGE_MS = 850;

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
      tags: ["Советы", platform],
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
      tags: ["История", platform],
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
      tags: ["Списки", platform],
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
      tags: ["Мнение", platform],
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
    }
  ];
};


const IDEA_CARDS: IdeaCard[] = [
  {
    id: "idea-1",
    title: "3 mistakes that kill employee onboarding",
    hook: "Most founders think onboarding takes a week. Here's why they're wrong...",
    tags: ["Tutorial", "LinkedIn"],
    estimate: "High potential"
  },
  {
    id: "idea-2",
    title: "Why I almost lost my first hire",
    hook: "Day 3. My best engineer sends me a message at 11pm...",
    tags: ["Story", "TikTok"],
    estimate: "High potential"
  },
  {
    id: "idea-3",
    title: "The 5-minute onboarding checklist",
    hook: "Save this. Your future self will thank you...",
    tags: ["List", "Reels"],
    estimate: "Trending topic"
  },
  {
    id: "idea-4",
    title: "Hot take: Slack is destroying your culture",
    hook: "Unpopular opinion incoming. Ready?",
    tags: ["Hot Take", "TikTok"],
    estimate: "Viral format"
  }
];

const DEFAULT_SCRIPT: ScriptVariant = {
  hook: "Most founders think onboarding takes a week. Here's why they're wrong.",
  problem: [
    "You hand them a PDF docs link and say 'read this'",
    "They spend their first 3 days isolated and confused",
    "They start regretting their choice before writing code"
  ],
  solution: [
    "Automate credentials setup on Day -5",
    "Ship a quick 'win' task on Day 1 for raw confidence",
    "Assign an onboarding buddy that isn't their manager"
  ],
  cta: "Follow for more founder lessons"
};

const getIdeaScript = (idea: IdeaCard): ScriptVariant => idea.script ?? DEFAULT_SCRIPT;

const REFERENCE_CARDS = [
  { views: "2.3M views", title: "Why onboarding buddy programs fail", hashtags: "#startups #founder", platform: "LinkedIn" },
  { views: "890K views", title: "How we ship code on Day 1", hashtags: "#software #onboarding", platform: "TikTok" },
  { views: "1.2M views", title: "HR automation mistakes founders make", hashtags: "#saas #business", platform: "Reels" }
];

const MOCK_CALENDAR_POSTS: Record<number, { platform: "TikTok" | "LinkedIn" | "Instagram"; title: string; time: string; status: "Scheduled" | "Published" }[]> = {
  3: [{ platform: "LinkedIn", title: "The cost of bad hiring in SaaS", time: "10:30 AM", status: "Published" }],
  5: [{ platform: "TikTok", title: "Day in the life of a solo founder", time: "04:15 PM", status: "Published" }],
  10: [{ platform: "Instagram", title: "How we hit $10k MRR in 30 days", time: "09:00 AM", status: "Scheduled" }],
  14: [{ platform: "TikTok", title: "Why I hate traditional project management", time: "11:30 AM", status: "Scheduled" }],
  18: [{ platform: "LinkedIn", title: "3 productivity hacks that actually work", time: "01:00 PM", status: "Scheduled" }],
  22: [{ platform: "Instagram", title: "The raw truth about SaaS valuations", time: "06:00 PM", status: "Scheduled" }]
};

const UPCOMING_POSTS_LIST = [
  { id: "up-1", title: "How we hit $10k MRR in 30 days", platform: "Instagram", time: "June 10th · 09:00 AM", status: "Scheduled" },
  { id: "up-2", title: "Why I hate traditional project management", platform: "TikTok", time: "June 14th · 11:30 AM", status: "Scheduled" },
  { id: "up-3", title: "3 productivity hacks that work", platform: "LinkedIn", time: "June 18th · 01:00 PM", status: "Scheduled" }
];

const MOCK_CONTENT_ITEMS = [
  { id: "c-1", title: "3 mistakes that kill employee onboarding", platform: "LinkedIn", status: "PUBLISHED", date: "May 28, 2026" },
  { id: "c-2", title: "Why I almost lost my first hire", platform: "TikTok", status: "PUBLISHED", date: "May 25, 2026" },
  { id: "c-3", title: "The 5-minute onboarding checklist", platform: "Reels", status: "SCHEDULED", date: "June 10, 2026" },
  { id: "c-4", title: "Slack is destroying your productivity", platform: "TikTok", status: "DRAFT", date: "Saved 2 hrs ago" },
  { id: "c-5", title: "The SaaS playbook for 2026", platform: "LinkedIn", status: "DRAFT", date: "Saved 1 day ago" },
  { id: "c-6", title: "Why we built Clipr in a week", platform: "Reels", status: "PUBLISHED", date: "May 20, 2026" }
];

const TRENDS_DATA = [
  { id: "t-1", source: "REDDIT", title: "Founders moving from Slack to Discord", time: "2h ago" },
  { id: "t-2", source: "GOOGLE TRENDS", title: "AI HR automation tools search spike", time: "3h ago" },
  { id: "t-3", source: "NEWS", title: "The rise of fraction-of-time executive hires", time: "5h ago" },
  { id: "t-4", source: "REDDIT", title: "Why micro-SaaS is still king in 2026", time: "8h ago" },
  { id: "t-5", source: "GOOGLE TRENDS", title: "Short-form video hook formulas", time: "12h ago" }
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"Create" | "Calendar" | "My Content">("Create");
  const [sidebarActive, setSidebarActive] = useState<"Home" | "My Content" | "Calendar" | "References" | "Settings">("Home");

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
  const [revisionCount, setRevisionCount] = useState<number>(0);
  const [revisionComment, setRevisionComment] = useState<string>("");
  const [isRevisingScript, setIsRevisingScript] = useState<boolean>(false);
  const [scriptVersions, setScriptVersions] = useState<ScriptVariant[]>([]);
  const [activeVersionIndex, setActiveVersionIndex] = useState(0);
  const [loaderExiting, setLoaderExiting] = useState(false);
  const [scriptReveal, setScriptReveal] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState<number | null>(10);
  const [showCalendarPanel, setShowCalendarPanel] = useState(true);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [ideasError, setIdeasError] = useState<string | null>(null);

  // Filters
  const [contentFilter, setContentFilter] = useState<"All" | "Drafts" | "Scheduled" | "Published">("All");

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
  const scriptGenStartRef = useRef<number>(0);

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

  useEffect(() => {
    if (!isGeneratingScript) return;
    setLoadingMessageIndex(0);
    const interval = setInterval(() => {
      setLoadingMessageIndex(prev => (prev + 1) % SCRIPT_LOADING_MESSAGES.length);
    }, SCRIPT_LOADING_MESSAGE_MS);
    return () => clearInterval(interval);
  }, [isGeneratingScript]);

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

  const handleSelectIdea = async (idea: IdeaCard) => {
    setSelectedIdeaId(idea.id);
    setSelectedIdea(idea);
    setRevisionCount(0);
    setRevisionComment("");
    setLoaderExiting(false);
    setScriptReveal(false);
    setActiveVersionIndex(0);

    if (idea.script) {
      setScriptVersions([idea.script]);
      setScriptReveal(true);
      return;
    }

    setIsGeneratingScript(true);
    scriptGenStartRef.current = Date.now();
    setScriptError(null);
    setScriptVersions([]);

    try {
      const savedDna = localStorage.getItem("clipr_dna");
      let dna = { product: "", audience: "", tone: "casual", samplePost: "", platform: "TikTok" };
      if (savedDna) {
        try {
          dna = JSON.parse(savedDna);
        } catch {}
      }

      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: dna.product || "Clipr platform",
          audience: dna.audience || "content creators",
          tone: dna.tone || "casual",
          samplePost: dna.samplePost || "",
          platform: idea.tags[1] || dna.platform || "TikTok",
          ideaTitle: idea.title,
          ideaHook: idea.hook
        })
      });

      if (!response.ok) {
        throw new Error("Failed to generate script from Gemini API");
      }

      const data = await response.json();

      const script = data as ScriptVariant;

      setIdeas(prev => prev.map(item => {
        if (item.id === idea.id) {
          return { ...item, script };
        }
        return item;
      }));

      setSelectedIdea(prev => prev ? { ...prev, script } : null);
      setScriptVersions([script]);
      setActiveVersionIndex(0);
    } catch (err) {
      console.error("Gemini script generation failed:", err);
      setScriptError("AI Script generation failed. Showing default template as fallback.");
      const fallback = getIdeaScript(idea);
      setScriptVersions([fallback]);
      setActiveVersionIndex(0);
    } finally {
      const elapsed = Date.now() - scriptGenStartRef.current;
      const remaining = Math.max(0, SCRIPT_LOADING_MIN_MS - elapsed);

      setTimeout(() => {
        setIsGeneratingScript(false);
        setLoaderExiting(true);
        setTimeout(() => {
          setLoaderExiting(false);
          setScriptReveal(true);
        }, 300);
      }, remaining);
    }
  };

  const handleRevisionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (revisionCount >= 3 || !revisionComment.trim() || !selectedIdea) return;

    setIsRevisingScript(true);
    const comment = revisionComment;
    setRevisionComment("");

    setTimeout(() => {
      const currentScript = scriptVersions[activeVersionIndex] ?? getIdeaScript(selectedIdea);

      const updatedScript: ScriptVariant = {
        ...currentScript,
        hook: `✨ [Версия ${revisionCount + 2}] ` + currentScript.hook,
        problem: currentScript.problem.map((p, idx) => idx === 0 ? `${p} (Изменено: ${comment.substring(0, 30)})` : p),
        solution: currentScript.solution.map((s, idx) => idx === 1 ? `${s} (Скорректировано)` : s),
        cta: currentScript.cta
      };

      const newVersions = [...scriptVersions, updatedScript].slice(0, 4);

      setIdeas(prev => prev.map(item => {
        if (item.id === selectedIdea.id) {
          return { ...item, script: updatedScript };
        }
        return item;
      }));

      setSelectedIdea(prev => prev ? { ...prev, script: updatedScript } : null);
      setScriptVersions(newVersions);
      setActiveVersionIndex(newVersions.length - 1);
      setScriptReveal(true);
      setRevisionCount(prev => prev + 1);
      setIsRevisingScript(false);
    }, 1000);
  };

  const triggerGenerateIdeas = async () => {
    setIsGenerating(true);
    setSelectedIdeaId(null);
    setSelectedIdea(null);
    setRevisionCount(0);
    setRevisionComment("");
    setScriptVersions([]);
    setActiveVersionIndex(0);
    setLoaderExiting(false);
    setScriptReveal(false);
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
            <div className="w-6 h-6 rounded-[6px] bg-[#10B981] flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              <Scissors className="w-3.5 h-3.5 text-[#070B0D] rotate-90" />
            </div>
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
                  onClick={() => {
                    setSidebarActive(link.name as "Home" | "My Content" | "Calendar" | "References" | "Settings");
                    if (link.name === "Home") setActiveTab("Create");
                    else if (link.name === "Calendar" || link.name === "My Content") {
                      setActiveTab(link.name as "Create" | "Calendar" | "My Content");
                    }
                  }}
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
        <header className="h-12 border-b border-[#152226] bg-[#070B0D] px-6 flex items-center justify-between sticky top-0 z-20">
          {/* Tabs removed */}
          <div className="flex items-center h-full space-x-6">
          </div>

          {/* Right Header */}
          <div className="flex items-center space-x-4">
            <button className="text-[#6B7C85] hover:text-[#EFEFEF] transition-colors">
              <Search className="w-3.5 h-3.5" />
            </button>
            <button className="text-[#6B7C85] hover:text-[#EFEFEF] transition-colors relative">
              <Bell className="w-3.5 h-3.5" />
              <span className="absolute top-0 right-0 w-1 h-1 bg-[#10B981] rounded-full" />
            </button>

            <button
              onClick={handleResetDna}
              className="text-[10px] text-[#6B7C85] hover:text-white border border-dashed border-[#152226] hover:border-[#10B981]/40 px-2 py-1 rounded transition-all"
              title="Restart onboarding (dev)"
            >
              ↻ Onboarding
            </button>

            {/* Trends sidebar is hidden for now */}

            <div className="flex items-center space-x-2 text-xs text-[#6B7C85] hover:text-[#EFEFEF] cursor-pointer transition-colors">
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
          </div>
        </header>

        {/* WORKSPACE CONTENT */}
        <div className={`flex-1 w-full ${activeTab === "Create" ? "overflow-hidden" : "overflow-y-auto"}`}>
          <div className={`w-full mx-auto ${activeTab === "Create" ? "h-full max-w-5xl px-6 py-4 flex flex-col justify-between" : "p-6 md:p-8 max-w-4xl space-y-6"}`}>

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
                  className="flex flex-col h-full gap-4 min-h-0 overflow-hidden"
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
                      <div className="flex flex-col items-center text-center space-y-1.5 pb-2 pt-24 select-none">
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#EFEFEF]">
                          What&apos;s your next viral hook<span className="text-[#00E5A0]">?</span>
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

                          <div className="flex justify-between items-center pt-2 border-t border-[#152226]">
                            <div className="flex items-center space-x-4">
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
                              className="bg-[#00E5A0] hover:bg-[#12cf90] text-[#070B0D] hover:scale-[1.02] active:scale-[0.98] transition-all text-xs font-bold rounded-full px-4 py-1.5 flex items-center justify-center space-x-1.5 shadow-md"
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

                  {/* Ideas Feed (Vertical list) — hidden once an idea is selected */}
                  {heroExitState === 'hidden' && !selectedIdeaId && (
                    <div className="w-full flex-1 flex flex-col items-center justify-start min-h-0 overflow-y-auto px-4 py-6 scrollbar-thin">
                      {ideasError && (
                        <div className="text-[11px] mb-3 text-amber-400 bg-amber-950/20 border border-amber-500/20 px-3 py-1.5 rounded-lg max-w-[680px] w-full text-center">
                          {ideasError}
                        </div>
                      )}
                      <div className="w-full max-w-[680px] flex flex-col gap-[16px]">
                        {isGenerating ? (
                          // Render 4 skeleton cards
                          [1, 2, 3, 4].map((n) => (
                            <div
                              key={n}
                              className="w-full rounded-[20px] p-[24px_28px] border bg-[var(--card-bg)] backdrop-blur-[16px] animate-pulse"
                              style={{
                                border: '1px solid var(--card-border)',
                                boxShadow: '0 0 24px rgba(0, 229, 160, 0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
                                minHeight: '140px'
                              }}
                            >
                              <div className="flex justify-between items-start">
                                <div className="h-4 w-12 bg-white/5 rounded" />
                                <div className="h-3 w-28 bg-[rgba(0,229,160,0.15)] rounded" />
                              </div>
                              <div className="h-6 w-2/3 bg-white/10 rounded mt-4" />
                              <div className="h-4 w-5/6 bg-white/5 rounded mt-3" />
                            </div>
                          ))
                        ) : (
                          // Render actual 4 cards
                          ideas.slice(0, 4).map((idea, idx) => (
                            <div
                              key={idea.id}
                              onClick={() => setModalIdea(idea)}
                              className="w-full rounded-[20px] p-[24px_28px] border bg-[var(--card-bg)] backdrop-blur-[16px] cursor-pointer hover:border-[rgba(0,229,160,0.5)] transition-all duration-300 group opacity-0 translate-y-[24px] animate-card-slide-up"
                              style={{
                                border: '1px solid var(--card-border)',
                                boxShadow: '0 0 24px rgba(0, 229, 160, 0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
                                animationDelay: `${idx * 80}ms`
                              }}
                            >
                              {/* Card Header Row */}
                              <div className="flex justify-between items-start">
                                <div>{/* Removed tags */}</div>
                                <span className="text-[12px] uppercase font-semibold tracking-wider text-[rgba(0,229,160,0.6)]">
                                  {idea.estimate || "High potential"}
                                </span>
                              </div>

                              {/* Card Title */}
                              <h3 className="text-[20px] font-bold text-white mt-2 leading-snug">
                                {idea.title}
                              </h3>

                              {/* Card Description */}
                              <p className="text-[15px] text-[var(--text-secondary)] mt-2 leading-[1.6] line-clamp-2">
                                {idea.hook}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                      {/* Scenario Generation Panel & References (Visible after selecting an idea) */}
                      {selectedIdeaId && selectedIdea && (
                        <div className="flex-1 grid grid-cols-3 gap-4 min-h-0 overflow-hidden mt-1">
                          
                          {/* Scenario Generator: Left 2 cols */}
                          <div className="col-span-2 bg-[var(--bg-primary)] border border-[#152226] rounded-xl flex flex-col min-h-0 overflow-hidden font-sans">
                            <div className="px-4 pt-4 pb-3 border-b border-[#152226] shrink-0">
                              <h2 className="text-[15px] font-semibold text-white leading-snug line-clamp-2">
                                {selectedIdea.title}
                              </h2>
                            </div>

                            <div className="flex-1 relative overflow-y-auto py-4 px-4 scrollbar-thin min-h-[200px]">
                              {(isGeneratingScript || loaderExiting) && (
                                <div className={`script-gen-loader rounded-lg ${loaderExiting ? "script-gen-loader--exit" : ""}`}>
                                  <div className="script-gen-terminal">
                                    <span className="script-gen-prompt">clipr</span>
                                    <span className="script-gen-prompt-sep">::</span>
                                    <span className="script-gen-prompt-cmd">script</span>
                                  </div>
                                  <div className="script-gen-line" key={loadingMessageIndex}>
                                    <span className="script-gen-chevron">&gt;</span>
                                    <span className="script-gen-message">
                                      {SCRIPT_LOADING_MESSAGES[loadingMessageIndex]}
                                    </span>
                                    <span className="script-gen-cursor" aria-hidden="true" />
                                  </div>
                                  <div className="script-gen-dots" aria-hidden="true">
                                    <span /><span /><span />
                                  </div>
                                </div>
                              )}

                              {!isGeneratingScript && !loaderExiting && (() => {
                                const currentScript = scriptVersions[activeVersionIndex] ?? getIdeaScript(selectedIdea);
                                const revealClass = scriptReveal ? "script-section-reveal" : "opacity-0";

                                return (
                                  <div className="space-y-5">
                                    {scriptError && (
                                      <div className="bg-red-950/20 border border-red-500/30 text-red-400 text-[13px] px-3 py-2 rounded-lg">
                                        {scriptError}
                                      </div>
                                    )}

                                    <div className={`space-y-2 ${revealClass}`} style={scriptReveal ? { animationDelay: "0ms" } : undefined}>
                                      <div className="flex items-baseline gap-2">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#00E5A0]">Hook</span>
                                        <span className="text-[11px] text-[var(--text-secondary)]">(0–3 SEC)</span>
                                      </div>
                                      <p className="text-[15px] font-semibold text-white leading-[1.6]">
                                        &ldquo;{currentScript.hook}&rdquo;
                                      </p>
                                    </div>

                                    <div className={`space-y-2 border-t border-white/[0.06] pt-4 ${revealClass}`} style={scriptReveal ? { animationDelay: "120ms" } : undefined}>
                                      <div className="flex items-baseline gap-2">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Problem</span>
                                        <span className="text-[11px] text-[var(--text-muted)]">(3–15 SEC)</span>
                                      </div>
                                      <ul className="space-y-2">
                                        {currentScript.problem.map((pt, i) => (
                                          <li key={i} className="text-[15px] text-[var(--text-secondary)] leading-[1.6] flex items-start gap-2">
                                            <span className="text-[#00E5A0] shrink-0 mt-1">•</span>
                                            <span>{pt}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>

                                    <div className={`space-y-2 border-t border-white/[0.06] pt-4 ${revealClass}`} style={scriptReveal ? { animationDelay: "240ms" } : undefined}>
                                      <div className="flex items-baseline gap-2">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Solution</span>
                                        <span className="text-[11px] text-[var(--text-muted)]">(15–45 SEC)</span>
                                      </div>
                                      <ul className="space-y-2">
                                        {currentScript.solution.map((pt, i) => (
                                          <li key={i} className="text-[15px] text-white leading-[1.6] flex items-start gap-2">
                                            <span className="text-[var(--text-secondary)] shrink-0 mt-1">•</span>
                                            <span>{pt}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>

                                    <div className={`space-y-2 border-t border-white/[0.06] pt-4 ${revealClass}`} style={scriptReveal ? { animationDelay: "360ms" } : undefined}>
                                      <div className="flex items-baseline gap-2">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#00E5A0]">CTA</span>
                                        <span className="text-[11px] text-[var(--text-muted)]">(45–60 SEC)</span>
                                      </div>
                                      <p className="text-[15px] font-semibold text-[#00E5A0] leading-[1.6]">
                                        &ldquo;{currentScript.cta}&rdquo;
                                      </p>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            <form onSubmit={handleRevisionSubmit} className="script-revision-bar shrink-0">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="flex flex-col min-w-[72px]">
                                    <span className="text-[11px] uppercase tracking-wider text-[#94A3B8] font-semibold">Версия</span>
                                    <span className="text-[15px] font-bold text-white">
                                      {activeVersionIndex + 1} / 4
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setActiveVersionIndex(i => Math.max(0, i - 1))}
                                    disabled={activeVersionIndex <= 0 || isGeneratingScript || loaderExiting}
                                    className="script-version-btn"
                                    aria-label="Предыдущая версия"
                                  >
                                    <ChevronLeft className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setActiveVersionIndex(i => Math.min(scriptVersions.length - 1, i + 1))}
                                    disabled={activeVersionIndex >= scriptVersions.length - 1 || isGeneratingScript || loaderExiting}
                                    className="script-version-btn"
                                    aria-label="Следующая версия"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </div>

                                <input
                                  type="text"
                                  value={revisionComment}
                                  onChange={(e) => setRevisionComment(e.target.value)}
                                  placeholder={revisionCount >= 3 ? "Лимит правок исчерпан" : "Что улучшить в сценарии?"}
                                  disabled={revisionCount >= 3 || isRevisingScript || isGeneratingScript || loaderExiting}
                                  className="script-revision-input flex-1 min-w-0"
                                />

                                <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end">
                                  <span
                                    className={`text-[12px] ${revisionCount >= 3 ? "text-[#FF4D4D]" : "text-[#94A3B8]"}`}
                                    title={revisionCount >= 3 ? "Лимит правок исчерпан" : undefined}
                                  >
                                    Правки: {revisionCount} / 3
                                  </span>
                                  <button
                                    type="submit"
                                    disabled={revisionCount >= 3 || isRevisingScript || isGeneratingScript || loaderExiting || !revisionComment.trim()}
                                    className="script-apply-btn"
                                  >
                                    {isRevisingScript ? (
                                      <>
                                        <span className="script-spinner" />
                                        Обновляю...
                                      </>
                                    ) : (
                                      "Применить"
                                    )}
                                  </button>
                                </div>
                              </div>
                            </form>
                          </div>

                          {/* References Display Panel: Right 1 col */}
                          <div className="col-span-1 bg-[#0D1416] border border-[#152226] rounded-xl p-4 flex flex-col justify-between min-h-0 overflow-hidden">
                            <div className="border-b border-[#152226] pb-2 shrink-0">
                              <h3 className="text-xs font-mono uppercase tracking-wide text-[#6B7C85] font-semibold">
                                Niche References (Static)
                              </h3>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 scrollbar-thin">
                              {REFERENCE_CARDS.map((ref, idx) => (
                                <div key={idx} className="rounded-xl bg-[#070B0D] border border-[#152226] p-3 space-y-1.5 hover:border-[#1E343A] transition-all">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-mono font-semibold text-[#6B7C85] flex items-center space-x-1">
                                      <Play className="w-2.5 h-2.5 text-[#6B7C85]" />
                                      <span>{ref.views}</span>
                                    </span>
                                    <span className="text-[9px] text-[#6B7C85] font-semibold font-mono">{ref.platform}</span>
                                  </div>
                                  <h4 className="text-[11px] font-semibold text-[#EFEFEF] tracking-tight line-clamp-2">
                                    {ref.title}
                                  </h4>
                                  <div className="flex justify-between items-center pt-1 border-t border-[#152226]/50">
                                    <span className="text-[9px] text-[#6B7C85] font-mono">{ref.hashtags}</span>
                                    <span className="text-[9px] text-[#10B981] hover:underline cursor-pointer">
                                      View →
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Calendar/Draft actions */}
                            <div className="border-t border-[#152226] pt-3 flex gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  setSelectedIdeaId(null);
                                  setSelectedIdea(null);
                                }}
                                className="flex-1 border border-[#152226] bg-[#070B0D] text-[#6B7C85] hover:text-[#EFEFEF] text-[11px] py-1.5 rounded-lg transition-all"
                              >
                                Clear
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedIdeaId(null);
                                  setSelectedIdea(null);
                                  setActiveTab("Calendar");
                                }}
                                className="flex-1 bg-[#10B981] hover:bg-[#12cf90] text-[#070B0D] text-[11px] font-bold py-1.5 rounded-lg transition-all"
                              >
                                Save script
                              </button>
                            </div>
                          </div>

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
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold text-[#EFEFEF]">Content Calendar</h2>
                      <p className="text-xs text-[#6B7C85]">June 2026</p>
                    </div>
                    <button className="bg-[#10B981] hover:bg-[#0D9E6E] text-[#070B0D] transition-all text-xs font-semibold rounded-lg px-4 py-2 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                      + Schedule post
                    </button>
                  </div>

                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Calendar Grid */}
                    <div className="flex-1 bg-[#0D1416] rounded-xl border border-[#152226] p-4 shadow-none">
                      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono text-[#6B7C85] font-semibold uppercase tracking-wider pb-2 border-b border-[#152226] mb-2">
                        <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                      </div>

                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 30 }).map((_, idx) => {
                          const day = idx + 1;
                          const posts = MOCK_CALENDAR_POSTS[day] || [];
                          const isSelected = selectedDate === day;

                          return (
                            <div
                              key={day}
                              onClick={() => {
                                setSelectedDate(day);
                                setShowCalendarPanel(true);
                              }}
                              className={`min-h-[80px] rounded-lg p-2 flex flex-col justify-between border cursor-pointer transition-all duration-150 ${isSelected
                                ? "bg-[#10B981]/5 border-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                                : "bg-[#070B0D] border-[#152226] hover:bg-[#11191B]"
                                }`}
                            >
                              <span className="text-[10px] font-mono font-semibold text-[#6B7C85] self-start">
                                {day}
                              </span>

                              <div className="space-y-0.5">
                                {posts.map((post, pIdx) => (
                                  <div
                                    key={pIdx}
                                    className="text-[9px] truncate px-1 py-0.5 rounded bg-[#070B0D] text-[#EFEFEF] border border-[#152226] flex items-center space-x-1"
                                  >
                                    {getPlatformIcon(post.platform, 8)}
                                    <span className="truncate">{post.title}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Date detail side-panel */}
                    {showCalendarPanel && selectedDate !== null && (
                      <div className="w-full lg:w-[280px] bg-[#0D1416] rounded-xl border border-[#152226] p-5 space-y-4 shrink-0 flex flex-col justify-between">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-[#152226] pb-3">
                            <span className="text-xs font-semibold text-[#6B7C85]">June {selectedDate}, 2026</span>
                            <button
                              onClick={() => setShowCalendarPanel(false)}
                              className="p-1 text-[#6B7C85] hover:text-[#EFEFEF] transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {MOCK_CALENDAR_POSTS[selectedDate] ? (
                            <div className="space-y-3">
                              {MOCK_CALENDAR_POSTS[selectedDate].map((post, idx) => (
                                <div key={idx} className="rounded-lg bg-[#070B0D] border border-[#152226] p-3.5 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] text-[#6B7C85] border border-[#152226] px-2 py-0.5 rounded-full flex items-center space-x-1 bg-[#0D1416]">
                                      {getPlatformIcon(post.platform, 10)}
                                      <span>{post.platform}</span>
                                    </span>
                                    <span className="text-[9px] text-[#6B7C85] font-mono">{post.time}</span>
                                  </div>
                                  <h4 className="text-xs font-semibold text-[#EFEFEF] leading-relaxed">
                                    {post.title}
                                  </h4>
                                  <div className="flex justify-between items-center pt-2 border-t border-[#152226]">
                                    <span className="text-[9px] uppercase tracking-wider font-semibold border border-[#152226] px-1.5 py-0.5 rounded text-[#6B7C85] bg-[#0D1416]">
                                      {post.status}
                                    </span>
                                    <button className="text-[10px] text-[#10B981] hover:text-[#12cf90] transition-colors">
                                      Edit script →
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-8 text-center space-y-3">
                              <CalendarRange className="w-6 h-6 text-[#6B7C85] mx-auto" />
                              <p className="text-xs text-[#6B7C85]">No scheduled posts for this date.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Upcoming List */}
                  <div className="space-y-4">
                    <h3 className="text-xs uppercase font-mono tracking-widest text-[#6B7C85] font-semibold">Upcoming posts</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {UPCOMING_POSTS_LIST.map((post) => (
                        <div key={post.id} className="rounded-xl bg-[#0D1416] hover:bg-[#10191B] border border-[#152226] p-4 flex space-x-3 items-center transition-all duration-150">
                          <div className="w-10 h-12 rounded bg-[#070B0D] border border-[#152226] shrink-0 flex items-center justify-center">
                            <Play className="w-3.5 h-3.5 text-[#6B7C85]" />
                          </div>
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center space-x-1.5">
                              {getPlatformIcon(post.platform, 10)}
                              <span className="text-[9px] text-[#6B7C85] font-semibold">{post.platform}</span>
                            </div>
                            <h4 className="text-xs font-semibold text-[#EFEFEF] truncate">{post.title}</h4>
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] text-[#6B7C85] font-mono">{post.time}</span>
                              <span className="text-[8px] uppercase tracking-wider bg-[#070B0D] text-[#6B7C85] border border-[#152226] px-1 rounded">
                                {post.status}
                              </span>
                            </div>
                          </div>
                        </div>
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
                  {/* Filter bar */}
                  <div className="flex items-center justify-between border-b border-[#152226] pb-4">
                    <div className="flex items-center space-x-2">
                      {(["All", "Drafts", "Scheduled", "Published"] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setContentFilter(filter)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-155 ${contentFilter === filter
                            ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/25"
                            : "text-[#6B7C85] hover:text-[#EFEFEF]"
                            }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-[#6B7C85] font-mono">
                      Total: {MOCK_CONTENT_ITEMS.length} items
                    </span>
                  </div>

                  {/* Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {MOCK_CONTENT_ITEMS.filter((item) => contentFilter === "All" || item.status === contentFilter.toUpperCase() || item.status === contentFilter).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl bg-[#0D1416] hover:bg-[#10191B] border border-[#152226] overflow-hidden flex flex-col justify-between h-[210px] shadow-none transition-all duration-150"
                      >
                        {/* Video thumbnail placeholder */}
                        <div className="h-[110px] bg-[#070B0D] border-b border-[#152226] relative flex items-center justify-center overflow-hidden">
                          <div className="absolute top-2 left-2">
                            <span className="text-[9px] text-[#6B7C85] border border-[#152226] bg-[#0D1416] px-1.5 py-0.5 rounded flex items-center space-x-1">
                              {getPlatformIcon(item.platform, 8)}
                              <span className="text-[#EFEFEF]">{item.platform}</span>
                            </span>
                          </div>

                          <div className="absolute top-2 right-2">
                            <span className="text-[8px] uppercase tracking-wider font-semibold px-1 rounded text-[#6B7C85] bg-[#0D1416] border border-[#152226]">
                              {item.status}
                            </span>
                          </div>

                          <div className="w-7 h-7 rounded-full bg-[#0D1416]/80 border border-[#152226] flex items-center justify-center text-[#6B7C85] hover:text-[#EFEFEF] transition-colors">
                            <Play className="w-3.5 h-3.5 fill-[#6B7C85]" />
                          </div>
                        </div>

                        {/* Info & Menu */}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <h4 className="text-xs font-semibold text-[#EFEFEF] line-clamp-2 leading-relaxed">
                            {item.title}
                          </h4>

                          <div className="flex justify-between items-center pt-2 border-t border-[#152226]">
                            <span className="text-[10px] text-[#6B7C85] font-mono">{item.date}</span>
                            <button className="p-1 rounded text-[#6B7C85] hover:text-[#EFEFEF] transition-colors">
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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
              className="relative w-full max-w-[560px] rounded-[20px] p-[32px] border shadow-2xl z-10 overflow-hidden"
              style={{
                background: 'rgba(20, 20, 20, 0.95)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(0, 229, 160, 0.4)',
                boxShadow: '0 0 32px rgba(0, 229, 160, 0.12), inset 0 1px 0 rgba(255,255,255,0.06)'
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
                  className="text-[#00E5A0] font-semibold text-[15px] flex items-center gap-1 hover:opacity-85 transition-opacity"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Write script <span className="ml-1">→</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
