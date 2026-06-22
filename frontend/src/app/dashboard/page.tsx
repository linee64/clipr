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
  Clock,
  ChevronRight
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
  X_ENABLED,
  type TwitterStatus,
  getLinkedInStatus,
  startLinkedInConnect,
  disconnectLinkedIn,
  postToLinkedIn,
  LINKEDIN_ENABLED,
  type LinkedInStatus,
  getInstagramStatus,
  startInstagramConnect,
  disconnectInstagram,
  postToInstagram,
  INSTAGRAM_ENABLED,
  type InstagramStatus,
  createSchedule,
  listSchedules,
  cancelSchedule,
  getBillingStatus,
  startCheckout,
  openBillingPortal,
  generateIdeas,
  type BillingStatus,
} from "@/lib/api";
import type { TemplateOption, ScheduledPost } from "@/lib/types";
import { UpgradeModal } from "@/components/UpgradeModal";
import { readPlan, setPlan, TRIAL_DAYS, PRO_PRICE, FREE_VIDEO_LIMIT, PRO_VIDEO_LIMIT, type PlanState } from "@/lib/plan";
import { VideoQuotaBadge } from "@/components/VideoQuotaBadge";

// X (Twitter) wordmark — the stylised "X".
function XLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

// Four-point sparkle for Pro accents.
function Spark({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2l1.7 6.6L20 10l-6.3 1.4L12 18l-1.7-6.6L4 10l6.3-1.4L12 2z" />
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
  // The signed-in user's identity, derived from the email saved at registration
  // (set by the landing page / Google sign-in before redirecting here).
  const [profile, setProfile] = useState<{ name: string; email: string; initial: string }>({
    name: "Creator",
    email: "",
    initial: "C",
  });
  const [sidebarActive, setSidebarActive] = useState<"Home" | "My Content" | "Calendar" | "References" | "Settings">("Home");
  const [references, setReferences] = useState<TemplateOption[]>([]);
  const [refsLoading, setRefsLoading] = useState(false);
  const [refsError, setRefsError] = useState<string | null>(null);

  // X (Twitter) connection state for the Settings tab + post-OAuth toast.
  const [xStatus, setXStatus] = useState<TwitterStatus | null>(null);
  const [xToast, setXToast] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  // LinkedIn connection state (parallels X; the toast above is shared).
  const [liStatus, setLiStatus] = useState<LinkedInStatus | null>(null);
  const [igStatus, setIgStatus] = useState<InstagramStatus | null>(null);

  // Subscription / trial state (local until a real billing provider is wired).
  const [planState, setPlanState] = useState<PlanState>({
    plan: "trial",
    daysLeft: TRIAL_DAYS,
    expired: false,
  });
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [trialBannerDismissed, setTrialBannerDismissed] = useState(false);
  // True once the backend confirms Polar is wired; until then "upgrade" falls back
  // to the local stub so the demo still flips to Pro without a payment provider.
  const [billingConfigured, setBillingConfigured] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  // Full server billing snapshot: real Pro + the server-side trial clock and
  // free-tier usage counts (authoritative — survives cache clears / new devices).
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  useEffect(() => {
    setPlanState(readPlan());
  }, []);

  // Hydrate plan + trial + usage from the backend. An active Polar sub → Pro;
  // otherwise the SERVER trial clock drives the free-tier countdown (overriding the
  // local fallback). Re-run after a metered action to refresh remaining uses.
  const refreshBilling = useCallback(async () => {
    try {
      const status = await getBillingStatus();
      setBilling(status);
      setBillingConfigured(!!status.configured);
      if (status.active) {
        setPlanState((s) => (s.plan === "pro" ? s : setPlan("pro")));
      } else if (status.configured) {
        // Polar is the source of truth on a configured deploy: not active => not Pro.
        // Clear any locally-persisted Pro (a real subscription that lapsed/cancelled)
        // and reflect the server trial/expired state, so a lapsed subscriber is
        // correctly downgraded instead of being shown "Pro" forever.
        const daysLeft = typeof status.trial_days_left === "number" ? status.trial_days_left : 0;
        const expired = !!status.trial_expired;
        setPlan("trial");
        setPlanState({ plan: "trial", daysLeft, expired });
      } else if (typeof status.trial_days_left === "number") {
        // Stub/demo deploy (Polar NOT wired): the backend reports active:false but still
        // returns a trial count, so don't clobber a locally-upgraded Pro back to trial
        // after a metered action — only drive the countdown for non-Pro plans.
        const daysLeft = status.trial_days_left;
        const expired = !!status.trial_expired;
        setPlanState((s) => (s.plan === "pro" ? s : { plan: "trial", daysLeft, expired }));
      }
    } catch {
      /* offline / not configured — keep the local plan */
    }
  }, []);

  useEffect(() => {
    refreshBilling();
  }, [refreshBilling]);

  // Free-tier allowances remaining (Infinity for Pro), from the server counts.
  const isProPlan = planState.plan === "pro" || !!billing?.unlimited;
  const freeRegenLeft = isProPlan
    ? Infinity
    : Math.max(0, (billing?.regen_limit ?? 3) - (billing?.regen_used ?? 0));
  const freeVoiceoverLeft = isProPlan
    ? Infinity
    : Math.max(0, (billing?.voiceover_limit ?? 2) - (billing?.voiceover_used ?? 0));
  const isUnlimitedPro = !!billing?.unlimited;
  const videosLimit = isUnlimitedPro
    ? Infinity
    : billing?.videos_limit ?? (isProPlan ? PRO_VIDEO_LIMIT : FREE_VIDEO_LIMIT);
  const videosLeft = isUnlimitedPro
    ? Infinity
    : Math.max(0, videosLimit - (billing?.videos_used ?? 0));

  // Header "Connect accounts" popover (connect X right from the Home tab).
  const [connectMenuOpen, setConnectMenuOpen] = useState(false);
  const connectMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!connectMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (connectMenuRef.current && !connectMenuRef.current.contains(e.target as Node)) {
        setConnectMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [connectMenuOpen]);

  // On load, surface the result of an OAuth round-trip (the backend redirects back
  // to /dashboard?x_connected=1 / ?x_error=... for X, ?li_connected=1 / ?li_error=...
  // for LinkedIn), then scrub it from the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("x_connected")) {
      setXToast({ kind: "ok", text: "X account connected." });
    } else if (params.has("x_error")) {
      setXToast({ kind: "error", text: `Couldn't connect X: ${params.get("x_error")}` });
    } else if (params.has("li_connected")) {
      setXToast({ kind: "ok", text: "LinkedIn account connected." });
    } else if (params.has("li_error")) {
      setXToast({ kind: "error", text: `Couldn't connect LinkedIn: ${params.get("li_error")}` });
    } else if (params.has("ig_connected")) {
      setXToast({ kind: "ok", text: "Instagram account connected." });
    } else if (params.has("ig_error")) {
      setXToast({ kind: "error", text: `Couldn't connect Instagram: ${params.get("ig_error")}` });
    } else if (params.get("billing") === "success") {
      setXToast({ kind: "ok", text: "Payment received — welcome to Pro! 🎉" });
      // The webhook writes the subscription a beat after the redirect; poll briefly.
      [1500, 4000, 8000].forEach((ms) => setTimeout(() => refreshBilling(), ms));
    } else if (params.get("billing") === "cancelled") {
      setXToast({ kind: "error", text: "Checkout cancelled — no charge was made." });
    }
    const oauthKeys = ["x_connected", "x_error", "li_connected", "li_error", "ig_connected", "ig_error", "billing"];
    if (oauthKeys.some((k) => params.has(k))) {
      oauthKeys.forEach((k) => params.delete(k));
      const qs = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
    if (X_ENABLED) {
      getTwitterStatus().then(setXStatus).catch(() => setXStatus({ connected: false }));
    }
    if (LINKEDIN_ENABLED) {
      getLinkedInStatus().then(setLiStatus).catch(() => setLiStatus({ connected: false }));
    }
    if (INSTAGRAM_ENABLED) {
      getInstagramStatus().then(setIgStatus).catch(() => setIgStatus({ connected: false }));
    }
    if (!X_ENABLED && !LINKEDIN_ENABLED && !INSTAGRAM_ENABLED) {
      // Both integrations hidden on this deploy — make sure no client id lingers.
      try {
        localStorage.removeItem("clipr_cid");
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Resolve the displayed profile: prefer the name the user typed in onboarding
  // (clipr_name); otherwise fall back to the email's local part, lightly
  // title-cased. Initial = the name's first letter.
  useEffect(() => {
    try {
      const email = (localStorage.getItem("clipr_email") || "").trim();
      const savedName = (localStorage.getItem("clipr_name") || "").trim();
      if (!email && !savedName) return;
      let name = savedName;
      if (!name && email) {
        const local = email.split("@")[0] || email;
        name =
          local
            .replace(/[._-]+/g, " ")
            .trim()
            .split(" ")
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
      }
      if (!name) name = "Creator";
      setProfile({ name, email, initial: (name.charAt(0) || "C").toUpperCase() });
    } catch {
      /* ignore — keep the default profile */
    }
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
    if (X_ENABLED) getTwitterStatus().then(setXStatus).catch(() => setXStatus({ connected: false }));
    if (LINKEDIN_ENABLED)
      getLinkedInStatus().then(setLiStatus).catch(() => setLiStatus({ connected: false }));
    if (INSTAGRAM_ENABLED)
      getInstagramStatus().then(setIgStatus).catch(() => setIgStatus({ connected: false }));
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

  const handleDisconnectLi = async () => {
    try {
      await disconnectLinkedIn();
    } catch {
      /* ignore — fall through to optimistic update */
    }
    setLiStatus({ connected: false });
    setXToast({ kind: "ok", text: "LinkedIn account disconnected." });
  };

  // Which saved video is currently being posted to LinkedIn (My Content buttons).
  const [liPostingId, setLiPostingId] = useState<string | null>(null);

  // Inline caption editing in My Content: the card being edited + its draft text.
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");

  const handlePostSavedToLinkedIn = async (item: SavedVideo) => {
    if (!liStatus?.connected) {
      // Not connected yet — kick off the OAuth flow instead of a dead click.
      startLinkedInConnect().catch((e) =>
        setXToast({
          kind: "error",
          text: `Couldn't start LinkedIn connect: ${e instanceof Error ? e.message : "try again"}`,
        })
      );
      return;
    }
    setLiPostingId(item.id);
    try {
      const result = await postToLinkedIn({
        output_url: item.output_url,
        caption: item.caption || item.title,
      });
      setXToast({ kind: "ok", text: "Posted to LinkedIn." });
      if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setXToast({
        kind: "error",
        text: e instanceof Error ? e.message : "Couldn't post to LinkedIn. Try again.",
      });
    } finally {
      setLiPostingId(null);
    }
  };

  const handleDisconnectIg = async () => {
    try {
      await disconnectInstagram();
    } catch {
      /* ignore */
    }
    setIgStatus({ connected: false });
    setXToast({ kind: "ok", text: "Instagram account disconnected." });
  };

  const [igPostingId, setIgPostingId] = useState<string | null>(null);

  const handlePostSavedToInstagram = async (item: SavedVideo) => {
    if (!igStatus?.connected) {
      startInstagramConnect().catch((e) =>
        setXToast({
          kind: "error",
          text: `Couldn't start Instagram connect: ${e instanceof Error ? e.message : "try again"}`,
        })
      );
      return;
    }
    setIgPostingId(item.id);
    try {
      const result = await postToInstagram({
        output_url: item.output_url,
        caption: item.caption || item.title,
      });
      setXToast({ kind: "ok", text: "Posted to Instagram." });
      if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setXToast({
        kind: "error",
        text: e instanceof Error ? e.message : "Couldn't post to Instagram. Try again.",
      });
    } finally {
      setIgPostingId(null);
    }
  };

  const schedulePlatformLabel = (platform: string) => {
    if (platform === "twitter") return "X";
    if (platform === "instagram") return "Instagram";
    return "LinkedIn";
  };

  // Subscription actions. When Polar is wired (billingConfigured), these redirect to
  // the hosted Polar checkout / customer portal; otherwise they fall back to the
  // local stub so the demo still flips Pro without a payment provider.
  // Make sure we have an email to key billing on. Returns true if one is available
  // (already stored, or just entered + persisted), false if the user cancelled.
  const ensureBillingEmail = (): boolean => {
    try {
      let email = (localStorage.getItem("clipr_email") || "").trim();
      if (!email) {
        const entered = window.prompt(
          "Enter your email to start your subscription (we'll link it to this account):"
        );
        email = (entered || "").trim();
        if (!email) return false;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          setXToast({ kind: "error", text: "That doesn't look like a valid email." });
          return false;
        }
        localStorage.setItem("clipr_email", email);
      }
      return true;
    } catch {
      return true; // localStorage blocked — let the backend surface any issue
    }
  };

  const handleSubscribe = async () => {
    if (!billingConfigured) {
      setPlanState(setPlan("pro"));
      setUpgradeOpen(false);
      setTrialBannerDismissed(true);
      setXToast({ kind: "ok", text: "Welcome to Pro! 🎉" });
      return;
    }
    // Billing is keyed by email; if we don't have one yet (e.g. landed straight on
    // /dashboard without signing in), ask for it and persist it before checkout.
    if (!ensureBillingEmail()) return;
    setBillingBusy(true);
    try {
      await startCheckout(); // redirects to Polar; control leaves the page
    } catch (e) {
      setBillingBusy(false);
      setXToast({
        kind: "error",
        text: e instanceof Error ? e.message : "Couldn't start checkout. Try again.",
      });
    }
  };
  const handleCancelPlan = async () => {
    if (!billingConfigured) {
      setPlanState(setPlan("trial"));
      setUpgradeOpen(false);
      setXToast({ kind: "ok", text: "Subscription cancelled — you're back on the trial." });
      return;
    }
    if (!ensureBillingEmail()) return;
    setBillingBusy(true);
    try {
      await openBillingPortal(); // redirects to Polar's manage/cancel portal
    } catch (e) {
      setBillingBusy(false);
      setXToast({
        kind: "error",
        text: e instanceof Error ? e.message : "Couldn't open the billing portal. Try again.",
      });
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

  // Copy a saved video's description/caption so it can be pasted into a social post.
  const handleCopyCaption = async (item: SavedVideo) => {
    const text = (item.caption || item.title || "").trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setXToast({ kind: "ok", text: "Caption copied." });
    } catch {
      setXToast({ kind: "error", text: "Couldn't copy — select the text manually." });
    }
  };

  // Persist an edited description back to the saved video (state + localStorage).
  const updateSavedCaption = (id: string, caption: string) => {
    setSavedContent((prev) => {
      const next = prev.map((v) => (v.id === id ? { ...v, caption } : v));
      try {
        localStorage.setItem("clipr_content", JSON.stringify(next));
      } catch {
        /* ignore — localStorage unavailable */
      }
      return next;
    });
  };

  const startEditCaption = (item: SavedVideo) => {
    setEditingCaptionId(item.id);
    setCaptionDraft(item.caption || "");
  };
  const cancelEditCaption = () => {
    setEditingCaptionId(null);
    setCaptionDraft("");
  };
  const saveEditCaption = (id: string) => {
    updateSavedCaption(id, captionDraft.trim());
    setEditingCaptionId(null);
    setCaptionDraft("");
    setXToast({ kind: "ok", text: "Description saved." });
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
  const [ideasError, setIdeasError] = useState<string | null>(null);

  // Scheduling (auto-post a rendered video to a social network at a set time).
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleVideo, setScheduleVideo] = useState<{ output_url: string; title: string } | null>(null);
  const [schedulePlatform, setSchedulePlatform] = useState<"twitter" | "linkedin" | "instagram">("twitter");
  const [scheduleDate, setScheduleDate] = useState(""); // YYYY-MM-DD (local)
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleCaption, setScheduleCaption] = useState("");
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduledPost[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  // Lets the schedule modal jump the still-mounted create flow back to a step.
  const [flowJumpStep, setFlowJumpStep] = useState<FlowStep | null>(null);

  const loadSchedules = useCallback(() => {
    setSchedulesLoading(true);
    listSchedules()
      .then((data) => setSchedules(data.schedules))
      .catch(() => setSchedules([]))
      .finally(() => setSchedulesLoading(false));
  }, []);

  // Load scheduled posts whenever the Calendar tab opens.
  useEffect(() => {
    if (activeTab !== "Calendar") return;
    loadSchedules();
  }, [activeTab, loadSchedules]);


  // Voice Edit profile
  const [isEditingVoice, setIsEditingVoice] = useState(false);
  const [voiceTone, setVoiceTone] = useState("Casual founder");
  const [voicePreview, setVoicePreview] = useState("Direct, no fluff, fast-paced, talking directly to operators.");
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(true);
  const [heroExitState, setHeroExitState] = useState<'visible' | 'exiting' | 'hidden'>('visible');
  // Pending hero-exit animation timer; tracked so navigation can cancel it before it
  // fires (otherwise a stale timer flips heroExitState back to 'hidden' after the user
  // navigated Home/back).
  const heroExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      // No brand DNA yet (e.g. a freshly registered user) → run onboarding first.
      setHasCompletedOnboarding(false);
    }
    setIsLoadingOnboarding(false);
  }, []);

  const handleOnboardingComplete = (data: {
    name: string;
    product: string;
    audience: string;
    tone: "formal" | "casual";
    samplePost: string;
    platform: "TikTok" | "Instagram Reels" | "LinkedIn" | "YouTube Shorts" | "Twitter / X";
  }) => {
    localStorage.setItem("clipr_dna", JSON.stringify(data));
    // Persist the name the user gave in onboarding and reflect it in the profile.
    if (data.name?.trim()) {
      const n = data.name.trim();
      localStorage.setItem("clipr_name", n);
      setProfile((p) => ({ ...p, name: n, initial: (n.charAt(0) || p.initial).toUpperCase() }));
    }
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
    if (heroExitTimerRef.current) {
      clearTimeout(heroExitTimerRef.current);
      heroExitTimerRef.current = null;
    }
    setSelectedIdeaId(null);
    setSelectedIdea(null);
  };

  // "14:30" (24h input value) -> "2:30 PM" (display)
  const formatTime = (t: string): string => {
    const [hStr, m] = (t || "09:00").split(":");
    let h = Number(hStr);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m ?? "00"} ${ampm}`;
  };

  // Format an epoch (seconds) as a short local date+time for the calendar list.
  const formatScheduleWhen = (epochSecs: number): string => {
    const d = new Date(epochSecs * 1000);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Open the schedule modal for a specific rendered video.
  const openScheduleModal = (
    video: { output_url: string; title?: string; caption?: string },
    platform?: "twitter" | "linkedin" | "instagram",
  ) => {
    if (!video.output_url) return;
    setScheduleVideo({ output_url: video.output_url, title: video.title || "Untitled video" });
    const defaultPlatform = X_ENABLED
      ? "twitter"
      : LINKEDIN_ENABLED
        ? "linkedin"
        : INSTAGRAM_ENABLED
          ? "instagram"
          : "twitter";
    setSchedulePlatform(platform ?? defaultPlatform);
    setScheduleCaption(video.caption ?? "");
    const now = new Date();
    setScheduleDate(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    );
    setScheduleTime("09:00");
    setScheduleError(null);
    setScheduleOpen(true);
  };

  const confirmSchedule = async () => {
    if (!scheduleVideo) return;
    const ts = new Date(`${scheduleDate}T${scheduleTime}`).getTime();
    if (!scheduleDate || Number.isNaN(ts)) {
      setScheduleError("Pick a valid date and time.");
      return;
    }
    setScheduleSubmitting(true);
    setScheduleError(null);
    try {
      await createSchedule({
        platform: schedulePlatform,
        output_url: scheduleVideo.output_url,
        caption: scheduleCaption,
        title: scheduleVideo.title,
        scheduled_at: Math.round(ts / 1000),
      });
      setScheduleOpen(false);
      setXToast({ kind: "ok", text: "Post scheduled." });
      setActiveTab("Calendar");
      setSidebarActive("Calendar");
      loadSchedules();
    } catch (e) {
      setScheduleError(e instanceof Error ? e.message : "Couldn't schedule. Try again.");
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const handleCancelSchedule = async (id: string) => {
    try {
      await cancelSchedule(id);
    } catch {
      /* ignore — fall through to optimistic removal */
    }
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const handleScheduleFromRender = (payload: {
    title: string;
    description: string;
    outputUrl: string;
    platform: string;
  }) => {
    openScheduleModal({
      output_url: payload.outputUrl,
      title: payload.title,
      caption: payload.description,
    });
  };

  const triggerGenerateIdeas = async () => {
    setIsGenerating(true);
    setSelectedIdeaId(null);
    setSelectedIdea(null);
    setIdeasError(null);
    setHeroExitState("exiting");

    // Exit animation duration is ~400ms, after which we hide the hero section and show the cards
    if (heroExitTimerRef.current) clearTimeout(heroExitTimerRef.current);
    heroExitTimerRef.current = setTimeout(() => {
      heroExitTimerRef.current = null;
      setHeroExitState("hidden");
    }, 400);

    try {
      const savedDna = localStorage.getItem("clipr_dna");
      let dna = { product: "", audience: "", tone: "casual", samplePost: "", platform: "TikTok" };
      if (savedDna) {
        try { dna = JSON.parse(savedDna); } catch {}
      }

      const topic = inputVal.trim() || dna.product || "Clipr platform";

      const { ideas: rawIdeas } = await generateIdeas({
        topic,
        platform: selectedPlatform || dna.platform || "TikTok",
        format: "Story",
        niche: dna.audience || dna.product || "content creators",
        tone: dna.tone || "casual",
      });

      if (!Array.isArray(rawIdeas) || rawIdeas.length === 0) {
        throw new Error("AI returned no ideas");
      }

      const aiIdeas: IdeaCard[] = rawIdeas.map((it, i) => ({
        id: `ai-idea-${i + 1}`,
        title: it.title || "Untitled idea",
        hook: it.hook_phrase || "",
        vibe: it.vibe || "",
        tags: [it.vibe, it.platform].filter((t): t is string => Boolean(t)),
        estimate: it.potential || "High potential",
      }));
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
          const fallbackProduct = inputVal.trim() || dna.product || "Clipr platform";
          setIdeas(generateDynamicIdeas(fallbackProduct, dna.platform));
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
      // Fresh start: back to the AI chat / idea generation. Cancel any pending hero-exit
      // timer so it can't flip the hero back to 'hidden' right after we reset it.
      if (heroExitTimerRef.current) {
        clearTimeout(heroExitTimerRef.current);
        heroExitTimerRef.current = null;
      }
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
        <div className="pt-4 border-t border-[#152226] space-y-2.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-full bg-[#152226] flex items-center justify-center text-xs font-semibold text-[#EFEFEF]">
              {profile.initial}
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-[#EFEFEF] block leading-tight truncate">{profile.name}</span>
              <span
                className={`text-xs block mt-0.5 truncate ${
                  planState.plan === "pro"
                    ? "text-[#10B981]"
                    : planState.expired
                      ? "text-[#EF8B8B]"
                      : "text-[#6B7C85]"
                }`}
              >
                {isUnlimitedPro
                  ? "Pro · Unlimited videos"
                  : planState.plan === "pro"
                    ? `Pro · ${videosLeft}/${videosLimit} videos`
                    : planState.expired
                      ? "Trial ended"
                      : `Trial · ${videosLeft}/${videosLimit} videos`}
              </span>
            </div>
          </div>
          {planState.plan !== "pro" && (
            <button
              onClick={() => setUpgradeOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#10B981] py-1.5 text-[11px] font-bold text-[#070B0D] hover:bg-[#12cf90] transition-colors shadow-[0_0_12px_rgba(16,185,129,0.25)]"
            >
              <Spark className="w-3 h-3" />
              {planState.expired ? "Upgrade to Pro" : "Upgrade"}
            </button>
          )}
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
            {(X_ENABLED || LINKEDIN_ENABLED) && (
            <div className="relative hidden md:block" ref={connectMenuRef}>
              <button
                onClick={() => setConnectMenuOpen((v) => !v)}
                className="flex items-center space-x-2 text-xs text-[#6B7C85] hover:text-[#EFEFEF] transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    {(xStatus?.connected || liStatus?.connected || igStatus?.connected) ? (
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#10B981] shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                    ) : (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                      </>
                    )}
                  </span>
                  {(xStatus?.connected || liStatus?.connected || igStatus?.connected) ? "Accounts" : "Connect accounts"}
                </span>
                <span className="flex items-center space-x-1 pl-1.5 border-l border-[#152226]">
                  <XLogo className="w-2.5 h-2.5 text-[#EFEFEF]" />
                  {getPlatformIcon("TikTok", 10)}
                  {getPlatformIcon("LinkedIn", 10)}
                  {getPlatformIcon("Reels", 10)}
                </span>
              </button>

              {connectMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-[#152226] bg-[#0D1416] shadow-2xl z-40 p-2 space-y-1">
                  {/* X (Twitter) — live connect */}
                  {X_ENABLED && (
                  <div className="flex items-center justify-between rounded-lg bg-[#070B0D] border border-[#152226] px-2.5 py-2">
                    <span className="flex items-center gap-2 text-xs text-[#EFEFEF] min-w-0">
                      <XLogo className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {xStatus?.connected && xStatus.username ? `@${xStatus.username}` : "X (Twitter)"}
                      </span>
                    </span>
                    {xStatus?.connected ? (
                      <button
                        onClick={handleDisconnectX}
                        className="shrink-0 text-[10px] text-[#6B7C85] hover:text-[#EF8B8B] border border-[#152226] hover:border-[#EF8B8B]/40 px-2 py-1 rounded-md transition-colors"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setConnectMenuOpen(false);
                          startTwitterConnect().catch((e) =>
                            setXToast({
                              kind: "error",
                              text: `Couldn't start X connect: ${
                                e instanceof Error ? e.message : "try again"
                              }`,
                            })
                          );
                        }}
                        className="shrink-0 text-[10px] font-semibold text-[#070B0D] bg-[#10B981] hover:bg-[#12cf90] px-2.5 py-1 rounded-md transition-colors"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                  )}

                  {/* LinkedIn — live connect when enabled, else in development */}
                  {LINKEDIN_ENABLED ? (
                    <div className="flex items-center justify-between rounded-lg bg-[#070B0D] border border-[#152226] px-2.5 py-2">
                      <span className="flex items-center gap-2 text-xs text-[#EFEFEF] min-w-0">
                        {getPlatformIcon("LinkedIn", 14)}
                        <span className="truncate">
                          {liStatus?.connected && liStatus.name ? liStatus.name : "LinkedIn"}
                        </span>
                      </span>
                      {liStatus?.connected ? (
                        <button
                          onClick={handleDisconnectLi}
                          className="shrink-0 text-[10px] text-[#6B7C85] hover:text-[#EF8B8B] border border-[#152226] hover:border-[#EF8B8B]/40 px-2 py-1 rounded-md transition-colors"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setConnectMenuOpen(false);
                            startLinkedInConnect().catch((e) =>
                              setXToast({
                                kind: "error",
                                text: `Couldn't start LinkedIn connect: ${
                                  e instanceof Error ? e.message : "try again"
                                }`,
                              })
                            );
                          }}
                          className="shrink-0 text-[10px] font-semibold text-[#070B0D] bg-[#10B981] hover:bg-[#12cf90] px-2.5 py-1 rounded-md transition-colors"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg bg-[#070B0D] border border-[#152226] px-2.5 py-2 opacity-80">
                      <span className="flex items-center gap-2 text-xs text-[#EFEFEF]">
                        {getPlatformIcon("LinkedIn", 14)}
                        <span>LinkedIn</span>
                      </span>
                      <span className="text-[9px] uppercase tracking-wider font-mono text-[#6B7C85]">In dev</span>
                    </div>
                  )}

                  {/* Instagram Reels — live connect when enabled, else in development */}
                  {INSTAGRAM_ENABLED ? (
                    <div className="flex items-center justify-between rounded-lg bg-[#070B0D] border border-[#152226] px-2.5 py-2">
                      <span className="flex items-center gap-2 text-xs text-[#EFEFEF] min-w-0">
                        {getPlatformIcon("Reels", 14)}
                        <span className="truncate">
                          {igStatus?.connected && igStatus.username
                            ? `@${igStatus.username}`
                            : "Instagram Reels"}
                        </span>
                      </span>
                      {igStatus?.connected ? (
                        <button
                          onClick={handleDisconnectIg}
                          className="shrink-0 text-[10px] text-[#6B7C85] hover:text-[#EF8B8B] border border-[#152226] hover:border-[#EF8B8B]/40 px-2 py-1 rounded-md transition-colors"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setConnectMenuOpen(false);
                            startInstagramConnect().catch((e) =>
                              setXToast({
                                kind: "error",
                                text: `Couldn't start Instagram connect: ${
                                  e instanceof Error ? e.message : "try again"
                                }`,
                              })
                            );
                          }}
                          className="shrink-0 text-[10px] font-semibold text-[#070B0D] bg-[#10B981] hover:bg-[#12cf90] px-2.5 py-1 rounded-md transition-colors"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg bg-[#070B0D] border border-[#152226] px-2.5 py-2 opacity-80">
                      <span className="flex items-center gap-2 text-xs text-[#EFEFEF]">
                        {getPlatformIcon("Reels", 14)}
                        <span>Instagram Reels</span>
                      </span>
                      <span className="text-[9px] uppercase tracking-wider font-mono text-[#6B7C85]">In dev</span>
                    </div>
                  )}

                  {/* TikTok — in development */}
                  <div className="flex items-center justify-between rounded-lg bg-[#070B0D] border border-[#152226] px-2.5 py-2 opacity-80">
                    <span className="flex items-center gap-2 text-xs text-[#EFEFEF]">
                      {getPlatformIcon("TikTok", 14)}
                      <span>TikTok</span>
                    </span>
                    <span className="text-[9px] uppercase tracking-wider font-mono text-[#6B7C85]">In dev</span>
                  </div>

                  <button
                    onClick={() => {
                      setConnectMenuOpen(false);
                      handleNav("Settings");
                    }}
                    className="w-full text-center text-[10px] text-[#6B7C85] hover:text-[#10B981] pt-1 pb-0.5 transition-colors"
                  >
                    Manage in Settings →
                  </button>
                </div>
              )}
            </div>
            )}

            {/* MOBILE: profile avatar -> Settings */}
            <button
              onClick={() => handleNav("Settings")}
              aria-label="Settings"
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-full bg-[#152226] text-[13px] font-semibold text-[#EFEFEF] border border-[#1E2A2E] active:scale-95 transition-transform"
            >
              {profile.initial}
            </button>
          </div>
        </header>

        {/* Trial banner — surfaces in the last 2 days or once the trial has ended */}
        {planState.plan !== "pro" &&
          (planState.expired || planState.daysLeft <= 2) &&
          !trialBannerDismissed && (
            <div
              className={`shrink-0 flex items-center gap-3 px-4 md:px-6 py-2.5 border-b ${
                planState.expired
                  ? "border-[#EF8B8B]/20 bg-[#EF8B8B]/[0.06]"
                  : "border-[#10B981]/20 bg-[#10B981]/[0.06]"
              }`}
            >
              <Spark
                className={`h-4 w-4 shrink-0 ${planState.expired ? "text-[#EF8B8B]" : "text-[#10B981]"}`}
              />
              <p className="text-xs text-[#EFEFEF] flex-1 min-w-0">
                {planState.expired
                  ? "Your free trial has ended. Upgrade to keep rendering and posting."
                  : `${planState.daysLeft} day${planState.daysLeft === 1 ? "" : "s"} left on your free trial.`}
              </p>
              <button
                onClick={() => setUpgradeOpen(true)}
                className="shrink-0 rounded-lg bg-[#10B981] px-3 py-1.5 text-[11px] font-bold text-[#070B0D] hover:bg-[#12cf90] transition-colors"
              >
                Upgrade
              </button>
              {!planState.expired && (
                <button
                  onClick={() => setTrialBannerDismissed(true)}
                  aria-label="Dismiss"
                  className="shrink-0 text-[#6B7C85] hover:text-[#EFEFEF] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

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
                                        setIsFormatOpen(false);
                                        setUpgradeOpen(true);
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
                    // justify-start on mobile: the 6 cards stack into one tall column, and
                    // a centered (justify-center) overflowing flex column clips its top
                    // behind the header with no way to scroll up. Center only on md+ where
                    // the 3-col grid fits without scrolling.
                    <div className="w-full flex-1 flex flex-col items-center justify-start md:justify-center min-h-0 overflow-y-auto px-4 py-6 scrollbar-thin">
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
                                  {idea.vibe || idea.tags?.[0] || "dark and focused"}
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
                              vibe: selectedIdea.vibe || selectedIdea.tags?.[0] || "dark and focused",
                              platform: selectedIdea.tags?.[1] || selectedPlatform,
                              estimate: selectedIdea.estimate,
                              product: inputVal.trim() || dnaInfo.product || "Clipr platform",
                            }}
                            defaultPlatform={selectedPlatform}
                            onBack={handleExitCreateFlow}
                            onSchedulePost={handleScheduleFromRender}
                            jumpToStep={flowJumpStep}
                            onJumpHandled={() => setFlowJumpStep(null)}
                            isPro={isProPlan}
                            onRequireUpgrade={() => setUpgradeOpen(true)}
                            regenLeft={freeRegenLeft}
                            voiceoverLeft={freeVoiceoverLeft}
                            videosLeft={videosLeft}
                            videosLimit={videosLimit}
                            videosUnlimited={isUnlimitedPro}
                            onUsageRefresh={refreshBilling}
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
                      <p className="text-xs text-[#6B7C85]">
                        Scheduled posts auto-publish to{" "}
                        {INSTAGRAM_ENABLED ? "X, LinkedIn, or Instagram" : "X and LinkedIn"} at their time.
                      </p>
                    </div>
                    <button
                      onClick={loadSchedules}
                      className="shrink-0 text-[11px] text-[#6B7C85] hover:text-[#10B981] border border-[#152226] hover:border-[#10B981]/40 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Refresh
                    </button>
                  </div>

                  {schedulesLoading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-[#6B7C85]">
                      <span className="w-4 h-4 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">Loading…</span>
                    </div>
                  ) : schedules.length === 0 ? (
                    <div className="rounded-xl bg-[#0D1416] border border-[#152226] p-12 text-center flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#070B0D] border border-[#152226] flex items-center justify-center">
                        <CalendarRange className="w-5 h-5 text-[#10B981]" />
                      </div>
                      <h3 className="text-base font-semibold text-[#EFEFEF]">No scheduled posts yet</h3>
                      <p className="text-sm text-[#6B7C85] max-w-xs">
                        Open My Content, pick a video and tap the clock icon to schedule an auto-post.
                      </p>
                      <button
                        onClick={() => {
                          setActiveTab("My Content");
                          setSidebarActive("My Content");
                        }}
                        className="mt-1 text-xs font-semibold text-[#070B0D] bg-[#10B981] hover:bg-[#12cf90] px-4 py-2 rounded-lg transition-colors"
                      >
                        Go to My Content
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {schedules.map((s) => {
                        const badge =
                          ({
                            pending: { t: "Scheduled", c: "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/25" },
                            processing: { t: "Posting…", c: "text-[#7FA89C] bg-[#10B981]/[0.06] border-[#152226]" },
                            posted: { t: "Posted", c: "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/25" },
                            error: { t: "Failed", c: "text-[#EF8B8B] bg-[#EF8B8B]/[0.06] border-[#EF8B8B]/25" },
                          } as const)[s.status] ?? { t: s.status, c: "text-[#6B7C85] border-[#152226]" };
                        return (
                          <div
                            key={s.id}
                            className="flex items-center gap-3 rounded-xl bg-[#0D1416] border border-[#152226] px-4 py-3"
                          >
                            <span className="w-8 h-8 rounded-full bg-[#152226] flex items-center justify-center shrink-0 text-[#EFEFEF]">
                              {s.platform === "twitter" ? (
                                <XLogo className="w-3.5 h-3.5" />
                              ) : s.platform === "instagram" ? (
                                getPlatformIcon("Reels", 14)
                              ) : (
                                getPlatformIcon("LinkedIn", 14)
                              )}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#EFEFEF] truncate">
                                {s.title || "Untitled video"}
                              </p>
                              <p className="text-[11px] text-[#6B7C85]">
                                {schedulePlatformLabel(s.platform)} · {formatScheduleWhen(s.scheduled_at)}
                              </p>
                              {s.status === "error" && s.error && (
                                <p className="text-[10px] text-[#EF8B8B] mt-0.5 line-clamp-1">{s.error}</p>
                              )}
                            </div>
                            <span
                              className={`shrink-0 text-[10px] uppercase tracking-wider font-mono border px-2 py-1 rounded-md ${badge.c}`}
                            >
                              {badge.t}
                            </span>
                            {s.status === "posted" && s.result_url ? (
                              <a
                                href={s.result_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 text-[11px] text-[#10B981] hover:underline"
                              >
                                View
                              </a>
                            ) : s.status === "pending" || s.status === "error" || s.status === "processing" ? (
                              <button
                                onClick={() => handleCancelSchedule(s.id)}
                                className="shrink-0 text-[11px] text-[#6B7C85] hover:text-[#EF8B8B] transition-colors"
                              >
                                Cancel
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                        onClick={() => handleNav("Home")}
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

                            {/* Saved description/caption — editable + persisted, and
                                reused when posting to socials (copy / post buttons). */}
                            {editingCaptionId === item.id ? (
                              <div className="rounded-lg bg-[#070B0D] border border-[#10B981]/30 p-2">
                                <textarea
                                  value={captionDraft}
                                  onChange={(e) => setCaptionDraft(e.target.value)}
                                  rows={4}
                                  autoFocus
                                  placeholder="Write a description…"
                                  className="w-full resize-y bg-transparent text-[11px] text-[#EFEFEF] leading-relaxed outline-none placeholder:text-[#3A4A50] scrollbar-thin"
                                />
                                <div className="mt-1.5 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => saveEditCaption(item.id)}
                                    className="text-[10px] font-semibold text-[#070B0D] bg-[#10B981] hover:bg-[#12cf90] px-2.5 py-1 rounded-md transition-colors"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditCaption}
                                    className="text-[10px] text-[#6B7C85] hover:text-[#EFEFEF] transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-lg bg-[#070B0D] border border-[#152226] p-2">
                                {item.caption ? (
                                  <p className="text-[10px] text-[#9FB0B6] leading-relaxed whitespace-pre-line line-clamp-3">
                                    {item.caption}
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-[#3A4A50] italic">No description yet</p>
                                )}
                                <div className="mt-1.5 flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => startEditCaption(item)}
                                    className="text-[10px] font-medium text-[#6B7C85] hover:text-[#10B981] transition-colors"
                                  >
                                    Edit
                                  </button>
                                  {item.caption && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopyCaption(item)}
                                      className="text-[10px] font-medium text-[#6B7C85] hover:text-[#10B981] transition-colors"
                                    >
                                      Copy
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="flex flex-wrap justify-between items-center gap-y-2 md:flex-nowrap pt-2 border-t border-[#152226]">
                              <span className="text-[10px] text-[#6B7C85] font-mono">{item.date}</span>
                              <div className="flex flex-wrap items-center justify-end gap-1.5 md:flex-nowrap">
                                {X_ENABLED && (
                                  <button
                                    onClick={() => handlePostSavedToX(item)}
                                    disabled={xPostingId === item.id}
                                    title={xStatus?.connected ? "Post to X" : "Connect X to post"}
                                    className="p-1.5 md:p-1 rounded text-[#6B7C85] hover:text-[#10B981] transition-colors disabled:opacity-50"
                                  >
                                    {xPostingId === item.id ? (
                                      <span className="block w-3.5 h-3.5 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <XLogo className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                                {LINKEDIN_ENABLED && (
                                  <button
                                    onClick={() => handlePostSavedToLinkedIn(item)}
                                    disabled={liPostingId === item.id}
                                    title={liStatus?.connected ? "Post to LinkedIn" : "Connect LinkedIn to post"}
                                    className="p-1.5 md:p-1 rounded text-[#6B7C85] hover:text-[#10B981] transition-colors disabled:opacity-50"
                                  >
                                    {liPostingId === item.id ? (
                                      <span className="block w-3.5 h-3.5 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      getPlatformIcon("LinkedIn", 14)
                                    )}
                                  </button>
                                )}
                                {INSTAGRAM_ENABLED && (
                                  <button
                                    onClick={() => handlePostSavedToInstagram(item)}
                                    disabled={igPostingId === item.id}
                                    title={igStatus?.connected ? "Post to Instagram" : "Connect Instagram to post"}
                                    className="p-1.5 md:p-1 rounded text-[#6B7C85] hover:text-[#10B981] transition-colors disabled:opacity-50"
                                  >
                                    {igPostingId === item.id ? (
                                      <span className="block w-3.5 h-3.5 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      getPlatformIcon("Reels", 14)
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    openScheduleModal({
                                      output_url: item.output_url,
                                      title: item.title,
                                      caption: item.caption,
                                    })
                                  }
                                  title="Schedule auto-post"
                                  className="p-1.5 md:p-1 rounded text-[#6B7C85] hover:text-[#10B981] transition-colors"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                </button>
                                <a
                                  href={resolveBackendUrl(item.output_url)}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Download"
                                  className="p-1.5 md:p-1 rounded text-[#6B7C85] hover:text-[#10B981] transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  onClick={() => deleteSavedVideo(item.id)}
                                  title="Delete"
                                  className="p-1.5 md:p-1 rounded text-[#6B7C85] hover:text-[#EF8B8B] transition-colors"
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

                  {/* Account & plan */}
                  <section className="rounded-xl bg-[#0D1416] border border-[#152226] p-5 space-y-4">
                    <h3 className="text-[10px] uppercase font-mono tracking-widest text-[#6B7C85] font-semibold">Account</h3>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-[#152226] flex items-center justify-center text-sm font-semibold text-[#EFEFEF] shrink-0">{profile.initial}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#EFEFEF]">{profile.name}</p>
                        <p className="text-xs text-[#6B7C85] truncate">{profile.email || "Not signed in"}</p>
                      </div>
                      <span
                        className={`ml-auto shrink-0 text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full border ${
                          planState.expired
                            ? "text-[#EF8B8B] bg-[#EF8B8B]/10 border-[#EF8B8B]/25"
                            : "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/25"
                        }`}
                      >
                        {planState.plan === "pro" ? "Pro" : planState.expired ? "Trial ended" : "Trial"}
                      </span>
                    </div>

                    {/* Plan card */}
                    <div className="rounded-lg border border-[#152226] bg-[#070B0D] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-semibold text-[#EFEFEF]">
                          <Spark className="w-3.5 h-3.5 text-[#10B981]" />
                          Clipr Pro
                        </span>
                        <span className="text-xs text-[#6B7C85]">
                          <span className="text-[#EFEFEF] font-semibold">{PRO_PRICE}</span>/mo
                        </span>
                      </div>

                      {planState.plan === "pro" ? (
                        <VideoQuotaBadge left={videosLeft} limit={videosLimit} unlimited={isUnlimitedPro} />
                      ) : (
                        <>
                          <p className="text-xs text-[#6B7C85]">
                            {planState.expired
                              ? "Your free trial has ended — upgrade to keep rendering and posting."
                              : `Free trial — ${planState.daysLeft} of ${TRIAL_DAYS} days left.`}
                          </p>
                          {!planState.expired && (
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#152226]">
                              <div
                                className="h-full rounded-full bg-[#10B981]"
                                style={{
                                  width: `${(planState.daysLeft / TRIAL_DAYS) * 100}%`,
                                  boxShadow: "0 0 8px rgba(16,185,129,0.5)",
                                }}
                              />
                            </div>
                          )}
                          <VideoQuotaBadge left={videosLeft} limit={videosLimit} unlimited={isUnlimitedPro} />
                        </>
                      )}

                      <button
                        onClick={() => setUpgradeOpen(true)}
                        className={
                          planState.plan === "pro"
                            ? "w-full text-xs font-medium text-[#EFEFEF] bg-[#11191B] border border-[#152226] rounded-lg px-3 py-2 hover:bg-[#152226] transition-colors"
                            : "w-full flex items-center justify-center gap-1.5 text-xs font-bold text-[#070B0D] bg-[#10B981] hover:bg-[#12cf90] rounded-lg px-3 py-2.5 transition-colors shadow-[0_0_14px_rgba(16,185,129,0.25)]"
                        }
                      >
                        {planState.plan === "pro" ? (
                          "Manage plan"
                        ) : (
                          <>
                            <Spark className="w-3.5 h-3.5" />
                            Upgrade to Pro
                          </>
                        )}
                      </button>
                    </div>
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
                      {/* LinkedIn — live connect when enabled, else shown as in-development */}
                      <div className="flex items-center justify-between rounded-lg bg-[#070B0D] border border-[#152226] px-3 py-2.5">
                        <span className="flex items-center gap-2 text-xs text-[#EFEFEF]">
                          {getPlatformIcon("LinkedIn", 14)}
                          <span>LinkedIn</span>
                          {LINKEDIN_ENABLED && liStatus?.connected && liStatus.name && (
                            <span className="text-[#6B7C85]">{liStatus.name}</span>
                          )}
                        </span>
                        {LINKEDIN_ENABLED ? (
                          liStatus?.connected ? (
                            <div className="flex items-center gap-2.5">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#10B981]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                Connected
                              </span>
                              <button
                                onClick={handleDisconnectLi}
                                className="text-[11px] text-[#6B7C85] hover:text-[#EF8B8B] border border-[#152226] hover:border-[#EF8B8B]/40 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                Disconnect
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                startLinkedInConnect().catch((e) =>
                                  setXToast({
                                    kind: "error",
                                    text: `Couldn't start LinkedIn connect: ${
                                      e instanceof Error ? e.message : "try again"
                                    }`,
                                  })
                                )
                              }
                              className="text-[11px] font-semibold text-[#070B0D] bg-[#10B981] hover:bg-[#12cf90] px-3 py-1.5 rounded-lg transition-colors shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                            >
                              Connect
                            </button>
                          )
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono text-[#6B7C85] border border-[#152226] bg-[#0D1416] px-2.5 py-1 rounded-lg cursor-not-allowed select-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6B7C85]/70" />
                            In development
                          </span>
                        )}
                      </div>

                      {/* X (Twitter) — live connect when enabled, else shown as in-development */}
                      <div className="flex items-center justify-between rounded-lg bg-[#070B0D] border border-[#152226] px-3 py-2.5">
                        <span className="flex items-center gap-2 text-xs text-[#EFEFEF]">
                          <XLogo className="w-3.5 h-3.5 text-[#EFEFEF]" />
                          <span>X (Twitter)</span>
                          {X_ENABLED && xStatus?.connected && xStatus.username && (
                            <span className="text-[#6B7C85]">@{xStatus.username}</span>
                          )}
                        </span>
                        {X_ENABLED ? (
                          xStatus?.connected ? (
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
                          )
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono text-[#6B7C85] border border-[#152226] bg-[#0D1416] px-2.5 py-1 rounded-lg cursor-not-allowed select-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6B7C85]/70" />
                            In development
                          </span>
                        )}
                      </div>

                      {/* Instagram Reels — live connect when enabled, else in development */}
                      <div
                        className={`flex items-center justify-between rounded-lg bg-[#070B0D] border border-[#152226] px-3 py-2.5${INSTAGRAM_ENABLED ? "" : " opacity-80"}`}
                      >
                        <span className="flex items-center gap-2 text-xs text-[#EFEFEF]">
                          {getPlatformIcon("Reels", 14)}
                          <span>Instagram Reels</span>
                          {INSTAGRAM_ENABLED && igStatus?.connected && igStatus.username && (
                            <span className="text-[#6B7C85]">@{igStatus.username}</span>
                          )}
                        </span>
                        {INSTAGRAM_ENABLED ? (
                          igStatus?.connected ? (
                            <div className="flex items-center gap-2.5">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#10B981]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                Connected
                              </span>
                              <button
                                onClick={handleDisconnectIg}
                                className="text-[11px] text-[#6B7C85] hover:text-[#EF8B8B] border border-[#152226] hover:border-[#EF8B8B]/40 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                Disconnect
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                startInstagramConnect().catch((e) =>
                                  setXToast({
                                    kind: "error",
                                    text: `Couldn't start Instagram connect: ${
                                      e instanceof Error ? e.message : "try again"
                                    }`,
                                  })
                                )
                              }
                              className="text-[11px] font-semibold text-[#070B0D] bg-[#10B981] hover:bg-[#12cf90] px-3 py-1.5 rounded-lg transition-colors shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                            >
                              Connect
                            </button>
                          )
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono text-[#6B7C85] border border-[#152226] bg-[#0D1416] px-2.5 py-1 rounded-lg cursor-not-allowed select-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6B7C85]/70" />
                            In development
                          </span>
                        )}
                      </div>

                      {/* TikTok — in development */}
                      <div className="flex items-center justify-between rounded-lg bg-[#070B0D] border border-[#152226] px-3 py-2.5 opacity-80">
                        <span className="flex items-center gap-2 text-xs text-[#EFEFEF]">{getPlatformIcon("TikTok", 14)}<span>TikTok</span></span>
                        <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono text-[#6B7C85] border border-[#152226] bg-[#0D1416] px-2.5 py-1 rounded-lg cursor-not-allowed select-none">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#6B7C85]/70" />
                          In development
                        </span>
                      </div>
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
        {scheduleOpen && scheduleVideo && (
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
                  <h2 className="text-lg font-bold text-[#EFEFEF]">Schedule auto-post</h2>
                  <p className="text-xs text-[#6B7C85] mt-0.5">It posts itself when the time comes</p>
                </div>
                <button
                  onClick={() => setScheduleOpen(false)}
                  className="text-[#6B7C85] hover:text-[#EFEFEF] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Which video */}
              <div className="mb-4 rounded-lg bg-[#070B0D] border border-[#152226] px-3 py-2.5">
                <span className="text-[10px] uppercase font-mono tracking-wider text-[#6B7C85]">Video</span>
                <p className="text-sm text-[#EFEFEF] truncate mt-0.5">{scheduleVideo.title}</p>
              </div>

              <div className="space-y-4">
                {/* Platform */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#6B7C85] font-bold">
                    Platform
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {X_ENABLED && (
                      <button
                        onClick={() => setSchedulePlatform("twitter")}
                        className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                          schedulePlatform === "twitter"
                            ? "border-[#10B981] bg-[#10B981]/10 text-[#EFEFEF]"
                            : "border-[#152226] bg-[#070B0D] text-[#6B7C85] hover:border-[#1E343A]"
                        }`}
                      >
                        <XLogo className="w-3.5 h-3.5" />
                        <span>X</span>
                      </button>
                    )}
                    {LINKEDIN_ENABLED && (
                      <button
                        onClick={() => setSchedulePlatform("linkedin")}
                        className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                          schedulePlatform === "linkedin"
                            ? "border-[#10B981] bg-[#10B981]/10 text-[#EFEFEF]"
                            : "border-[#152226] bg-[#070B0D] text-[#6B7C85] hover:border-[#1E343A]"
                        }`}
                      >
                        {getPlatformIcon("LinkedIn", 14)}
                        <span>LinkedIn</span>
                      </button>
                    )}
                    {INSTAGRAM_ENABLED && (
                      <button
                        onClick={() => setSchedulePlatform("instagram")}
                        className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                          schedulePlatform === "instagram"
                            ? "border-[#10B981] bg-[#10B981]/10 text-[#EFEFEF]"
                            : "border-[#152226] bg-[#070B0D] text-[#6B7C85] hover:border-[#1E343A]"
                        }`}
                      >
                        {getPlatformIcon("Reels", 14)}
                        <span>Instagram</span>
                      </button>
                    )}
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
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
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

                {/* Caption */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-mono tracking-wider text-[#6B7C85] font-bold">
                    Caption
                  </label>
                  <textarea
                    value={scheduleCaption}
                    onChange={(e) => setScheduleCaption(e.target.value)}
                    rows={3}
                    placeholder="Post text…"
                    className="w-full resize-y bg-[#070B0D] border border-[#152226] rounded-lg px-3 py-2.5 text-sm text-[#EFEFEF] outline-none focus:border-[#10B981] transition-colors placeholder:text-[#6B7C85] scrollbar-thin"
                  />
                </div>

                {scheduleDate && (
                  <p className="text-[11px] text-[#6B7C85]">
                    Posts to{" "}
                    <span className="text-[#EFEFEF] font-medium">
                      {schedulePlatformLabel(schedulePlatform)}
                    </span>{" "}
                    on <span className="text-[#EFEFEF] font-medium">{scheduleDate}</span> at{" "}
                    <span className="text-[#EFEFEF] font-medium">{formatTime(scheduleTime)}</span>
                  </p>
                )}

                {scheduleError && (
                  <p className="text-xs text-[#EF8B8B] leading-relaxed">{scheduleError}</p>
                )}
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
                  disabled={scheduleSubmitting}
                  className="flex-1 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#0D9E6E] text-[#070B0D] text-sm font-bold transition-all flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {scheduleSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#070B0D] border-t-transparent rounded-full animate-spin" />
                      Scheduling…
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4" />
                      Schedule
                    </>
                  )}
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

      <UpgradeModal
        open={upgradeOpen}
        plan={planState.plan}
        daysLeft={planState.daysLeft}
        onClose={() => setUpgradeOpen(false)}
        onSubscribe={handleSubscribe}
        onCancel={handleCancelPlan}
        busy={billingBusy}
      />

    </div>
  );
}
