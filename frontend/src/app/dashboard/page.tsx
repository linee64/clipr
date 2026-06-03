"use client";

import React, { useState } from "react";
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
  Mic,
  RefreshCw,
  Play,
  ArrowLeft,
  CalendarRange,
  Edit2,
  MoreVertical,
  X,
  Flame
} from "lucide-react";

// ----------------------------------------------------
// MOCK DATA & CONFIG
// ----------------------------------------------------

interface IdeaCard {
  id: string;
  title: string;
  hook: string;
  tags: string[];
  estimate: string;
}

interface ScriptVariant {
  hook: string;
  problem: string[];
  solution: string[];
  cta: string;
}

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

const SCRIPT_VARIANTS: Record<string, ScriptVariant> = {
  "Aggressive Hook": {
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
  },
  "Storytelling": {
    hook: "I once hired a senior dev who quit on day four because of one stupid mistake I made.",
    problem: [
      "I was too busy putting out fires to welcome him properly",
      "He felt like an outsider left alone in a dark room",
      "No clear ownership, no connection, zero context"
    ],
    solution: [
      "I redesigned our entry flow from the ground up",
      "Now we start with a virtual coffee on hour one",
      "Every new hire gets a personal video message explaining our mission"
    ],
    cta: "Drop a comment if you've ever had a terrible first week"
  },
  "Educational": {
    hook: "The onboarding formula that top-tier YC startups use to ship code on Day 1.",
    problem: [
      "Standard onboarding takes 2 to 3 weeks of dead meetings",
      "It wastes senior developer time explaining basic setups",
      "Delayed feedback loops stunt developer velocity forever"
    ],
    solution: [
      "Use one-command developer environment bootstrap tools",
      "Build a interactive, self-paced documentation sandbox",
      "Create clear milestones for the first 30, 60, and 90 days"
    ],
    cta: "Subscribe to my newsletter for the full blueprint"
  }
};

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

  // Create Tab States
  const [inputVal, setInputVal] = useState("I'm building an AI tool for HR automation and want to explain why onboarding matters...");
  const [selectedPlatform, setSelectedPlatform] = useState<"TikTok" | "LinkedIn" | "Reels">("TikTok");
  const [selectedFormat, setSelectedFormat] = useState<"Tutorial" | "Story" | "Hot Take" | "List">("Tutorial");
  const [isGenerating, setIsGenerating] = useState(false);

  // Modal and details
  const [selectedIdea, setSelectedIdea] = useState<IdeaCard | null>(null);
  const [activeScriptTab, setActiveScriptTab] = useState<"Aggressive Hook" | "Storytelling" | "Educational">("Aggressive Hook");
  const [selectedDate, setSelectedDate] = useState<number | null>(10);
  const [showCalendarPanel, setShowCalendarPanel] = useState(true);

  // Filters
  const [contentFilter, setContentFilter] = useState<"All" | "Drafts" | "Scheduled" | "Published">("All");

  // Voice Edit profile
  const [isEditingVoice, setIsEditingVoice] = useState(false);
  const [voiceTone, setVoiceTone] = useState("Casual founder");
  const [voicePreview, setVoicePreview] = useState("Direct, no fluff, fast-paced, talking directly to operators.");

  const triggerGenerateIdeas = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 1500);
  };

  const getPlatformIcon = (platform: string, size = 14) => {
    const s = `${size}px`;
    switch (platform) {
      case "LinkedIn":
        return (
          <svg style={{ width: s, height: s }} viewBox="0 0 24 24" fill="currentColor" className="text-[#888888]">
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
          </svg>
        );
      case "Instagram":
      case "Reels":
      case "Instagram Reels":
        return (
          <svg style={{ width: s, height: s }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#888888]">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
          </svg>
        );
      default: // TikTok
        return <Scissors style={{ width: s, height: s }} className="text-[#888888]" />;
    }
  };

  return (
    <div className="relative min-h-screen bg-[#070B0D] text-[#EFEFEF] flex flex-col md:flex-row font-sans overflow-x-hidden antialiased text-[14px] leading-[1.6]">
      
      {/* ----------------------------------------------------
          LEFT SIDEBAR (220px, bg #0D1517, border-r #152226)
         ---------------------------------------------------- */}
      <aside className="hidden md:flex flex-col w-[220px] shrink-0 border-r border-[#152226] bg-[#0B1012] min-h-screen p-5 justify-between relative z-10">
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
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-[10px] text-[14px] font-normal transition-all duration-200 border ${
                    isActive
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
      <main className="flex-1 flex flex-col min-h-screen relative z-10 bg-[#070B0D]">
        
        {/* TOP NAVBAR */}
        <header className="h-12 border-b border-[#152226] bg-[#070B0D] px-6 flex items-center justify-between sticky top-0 z-20">
          {/* Tabs */}
          <div className="flex items-center h-full space-x-6">
            {(["Create", "Calendar", "My Content"] as const).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    if (tab === "Create") setSidebarActive("Home");
                    else setSidebarActive(tab as "My Content" | "Calendar");
                  }}
                  className={`h-full text-xs font-medium relative px-1 transition-colors duration-150 ${
                    isActive ? "text-[#EFEFEF]" : "text-[#6B7C85] hover:text-[#EFEFEF]"
                  }`}
                >
                  <span>{tab}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  )}
                </button>
              );
            })}
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

            <div className="flex items-center space-x-2 text-xs text-[#6B7C85] hover:text-[#EFEFEF] cursor-pointer transition-colors">
              <span className="flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                </span>
                Connect accounts
              </span>
              <div className="flex items-center space-x-1 pl-1.5 border-l border-[#152226]">
                <Scissors className="w-2.5 h-2.5" />
                {getPlatformIcon("LinkedIn", 10)}
              </div>
            </div>
          </div>
        </header>

        {/* WORKSPACE CONTENT */}
        <div className="flex-1 p-6 md:p-8 max-w-4xl w-full mx-auto space-y-6 overflow-y-auto">
          
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
                className="space-y-6"
              >
                {/* Input Workspace Card */}
                <div className="glowing-textarea-card rounded-[14px] p-6 relative overflow-hidden">
                  {/* Radial glow background inside the card */}
                  <div className="absolute inset-0 glow-bg-radial pointer-events-none z-0" />
                  
                  <div className="relative z-10 space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-[#6B7C85] font-semibold block">
                        WHAT&apos;S YOUR NEXT VIDEO ABOUT?
                      </label>
                      <textarea
                        value={inputVal}
                        onChange={(e) => setInputVal(e.target.value)}
                        className="w-full bg-transparent text-[#EFEFEF] border-0 outline-none p-0 text-base font-normal resize-none min-h-[100px] placeholder:text-[#6B7C85] focus:ring-0"
                        placeholder="Explain why something matters in your industry..."
                      />
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-[#152226]">
                      <div className="flex items-center space-x-3">
                        {/* Platform Pills */}
                        <div className="flex items-center space-x-1.5">
                          {(["TikTok", "LinkedIn", "Reels"] as const).map((plat) => {
                            const isSel = selectedPlatform === plat;
                            return (
                              <button
                                key={plat}
                                onClick={() => setSelectedPlatform(plat)}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-normal border transition-all duration-200 ${
                                  isSel
                                    ? "border-[#10B981] text-[#10B981] bg-[#10B981]/5 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                                    : "bg-transparent border-[#152226] text-[#6B7C85] hover:text-[#EFEFEF] hover:border-[#1E343A]"
                                }`}
                              >
                                {plat}
                              </button>
                            );
                          })}
                        </div>

                        <div className="w-[1px] h-3 bg-[#152226]" />

                        {/* Format Pills */}
                        <div className="flex items-center space-x-1.5">
                          {(["Tutorial", "Story", "Hot Take", "List"] as const).map((form) => {
                            const isSel = selectedFormat === form;
                            return (
                              <button
                                key={form}
                                onClick={() => setSelectedFormat(form)}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-normal border transition-all duration-200 ${
                                  isSel
                                    ? "border-[#10B981] text-[#10B981] bg-[#10B981]/5 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                                    : "bg-transparent border-[#152226] text-[#6B7C85] hover:text-[#EFEFEF] hover:border-[#1E343A]"
                                }`}
                              >
                                {form}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Mic icon */}
                      <button className="text-[#6B7C85] hover:text-[#EFEFEF] transition-colors p-1.5 hover:bg-[#152226] rounded-md">
                        <Mic className="w-4 h-4 text-[#10B981]" />
                      </button>
                    </div>

                    {/* Generate button (glowing mint green, font-weight 600) */}
                    <button
                      className="w-full neon-btn text-[#070B0D] transition-all text-sm font-semibold rounded-[10px] py-3 mt-4 flex items-center justify-center space-x-2"
                      onClick={triggerGenerateIdeas}
                      disabled={isGenerating}
                    >
                      <span>{isGenerating ? "Generating ideas..." : "Generate ideas"}</span>
                      {!isGenerating && <span className="text-base">→</span>}
                    </button>
                  </div>
                </div>

                {/* Ideas Feed */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <h2 className="text-base font-semibold text-[#EFEFEF]">Ideas for you</h2>
                      <span className="text-xs text-[#6B7C85] ml-2">Based on your profile</span>
                    </div>
                    <button 
                      onClick={triggerGenerateIdeas}
                      className="text-[#6B7C85] hover:text-[#EFEFEF] transition-colors p-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isGenerating ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[1, 2, 3, 4].map((n) => (
                        <div key={n} className="h-[185px] rounded-xl border border-[#152226] bg-[#0D1416] animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {IDEA_CARDS.map((idea, idx) => (
                        <motion.div
                          key={idea.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.15, delay: idx * 0.04 }}
                          className="group rounded-xl border border-[#152226] bg-[#0D1416] hover:border-[#1E343A] hover:bg-[#10191B] p-5 flex flex-col justify-between h-[185px] transition-all duration-150 relative overflow-hidden"
                        >
                          <div className="space-y-2 relative z-10">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5">
                                {idea.tags.map((t, i) => (
                                  <span 
                                    key={i} 
                                    className="text-[11px] text-[#6B7C85] border border-[#152226] px-2 py-0.5 rounded-full flex items-center space-x-1 bg-[#070B0D]"
                                  >
                                    {getPlatformIcon(t, 10)}
                                    <span>{t}</span>
                                  </span>
                                ))}
                              </div>
                              <div className="flex items-center space-x-1 text-[#6B7C85]">
                                <Flame className="w-3.5 h-3.5 text-[#10B981] animate-pulse" />
                                <span className="text-[11px] font-mono">{idea.estimate}</span>
                              </div>
                            </div>

                            <h3 className="text-base font-semibold text-[#EFEFEF] mt-2 leading-snug group-hover:text-white">
                              {idea.title}
                            </h3>
                            <p className="text-xs text-[#6B7C85] line-clamp-2 leading-relaxed font-normal">
                              {idea.hook}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-[#152226] flex items-center justify-between relative z-10">
                            <span className="text-[9px] uppercase tracking-wide text-[#6B7C85] font-mono">
                              potential analysis
                            </span>
                            <button
                              onClick={() => setSelectedIdea(idea)}
                              className="text-xs font-semibold text-[#10B981] hover:text-[#12cf90] hover:opacity-90 transition-colors"
                            >
                              Write script →
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
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
                            className={`min-h-[80px] rounded-lg p-2 flex flex-col justify-between border cursor-pointer transition-all duration-150 ${
                              isSelected
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
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-155 ${
                          contentFilter === filter
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

      </main>

      {/* ----------------------------------------------------
          RIGHT SIDEBAR: TRENDS (280px, bg #0B1012, border-l #152226)
         ---------------------------------------------------- */}
      <aside className="hidden lg:flex flex-col w-[280px] shrink-0 border-l border-[#152226] bg-[#0B1012] min-h-screen p-5 justify-between relative z-10 space-y-6">
        
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
            <span className="text-[9px] text-[#6B7C85] uppercase font-mono tracking-wider">LIVE</span>
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
                    <span className={`text-[9px] font-mono tracking-widest font-bold ${sourceColor}`}>
                      {trend.source}
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

        {/* Sparkle Decoration Graphic */}
        <div className="absolute bottom-36 right-6 w-8 h-8 opacity-25 text-[#10B981] select-none pointer-events-none">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
            <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" />
          </svg>
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
          SCRIPT MODAL OVERLAY (Centered simple dialog, bg #242424)
         ---------------------------------------------------- */}
      <AnimatePresence>
        {selectedIdea !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#080808]/85 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="bg-[#0D1416] border border-[#152226] rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] relative"
            >
              {/* Top Bar */}
              <div className="border-b border-[#152226] bg-[#0D1416] px-6 py-4 flex items-center justify-between">
                <button
                  onClick={() => setSelectedIdea(null)}
                  className="flex items-center space-x-2 text-[#6B7C85] hover:text-[#EFEFEF] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-xs">Back</span>
                </button>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono text-[#6B7C85] uppercase font-semibold">Script Engine</span>
                  <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full shadow-[0_0_8px_#10B981] animate-pulse" />
                </div>
              </div>

              {/* Main Body */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-8">
                
                {/* Left side: Script builder */}
                <div className="flex-1 space-y-6">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-mono tracking-widest text-[#10B981] font-semibold">
                      Topic
                    </span>
                    <h2 className="text-lg font-bold text-[#EFEFEF] leading-tight">
                      {selectedIdea.title}
                    </h2>
                  </div>

                  {/* Tab Selector */}
                  <div className="flex bg-[#070B0D] p-1 rounded-lg border border-[#152226] w-fit">
                    {(["Aggressive Hook", "Storytelling", "Educational"] as const).map((variant) => (
                      <button
                        key={variant}
                        onClick={() => setActiveScriptTab(variant)}
                        className={`px-3 py-1 rounded text-[10px] font-semibold transition-all duration-150 ${
                          activeScriptTab === variant
                            ? "bg-[#0D1416] text-[#10B981] shadow-[0_2px_8px_rgba(0,0,0,0.2)] border border-[#152226]"
                            : "text-[#6B7C85] hover:text-[#EFEFEF] border border-transparent"
                        }`}
                      >
                        {variant}
                      </button>
                    ))}
                  </div>

                  {/* Script Details Card */}
                  <div className="rounded-xl border border-[#152226] bg-[#070B0D] p-5 space-y-5">
                    {/* Hook Section */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-mono uppercase text-[#10B981] font-semibold">
                        Hook (0-3 sec)
                      </span>
                      <p className="text-sm font-semibold text-[#EFEFEF] leading-relaxed">
                        &ldquo;{SCRIPT_VARIANTS[activeScriptTab].hook}&rdquo;
                      </p>
                    </div>

                    {/* Problem Section */}
                    <div className="space-y-1.5 border-t border-[#152226] pt-3">
                      <span className="text-[9px] font-mono uppercase text-[#6B7C85] font-semibold">
                        Problem (3-15 sec)
                      </span>
                      <ul className="space-y-2">
                        {SCRIPT_VARIANTS[activeScriptTab].problem.map((pt, i) => (
                          <li key={i} className="text-xs text-[#6B7C85] flex items-start space-x-2">
                            <span className="text-[#10B981] mt-1 shrink-0">•</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Solution Section */}
                    <div className="space-y-1.5 border-t border-[#152226] pt-3">
                      <span className="text-[9px] font-mono uppercase text-[#6B7C85] font-semibold">
                        Solution (15-45 sec)
                      </span>
                      <ul className="space-y-2">
                        {SCRIPT_VARIANTS[activeScriptTab].solution.map((pt, i) => (
                          <li key={i} className="text-xs text-[#EFEFEF] flex items-start space-x-2">
                            <span className="text-[#6B7C85] mt-1 shrink-0">•</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* CTA Section */}
                    <div className="space-y-1.5 border-t border-[#152226] pt-3">
                      <span className="text-[9px] font-mono uppercase text-[#10B981] font-semibold">
                        CTA (45-60 sec)
                      </span>
                      <p className="text-xs font-semibold text-[#10B981] italic">
                        &ldquo;{SCRIPT_VARIANTS[activeScriptTab].cta}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right side: Niche references */}
                <div className="w-full lg:w-[280px] space-y-4 shrink-0">
                  <h3 className="text-xs font-mono uppercase tracking-wide text-[#6B7C85] font-semibold border-b border-[#152226] pb-2">
                    References from your niche
                  </h3>

                  <div className="space-y-3">
                    {REFERENCE_CARDS.map((ref, idx) => (
                      <div key={idx} className="rounded-xl bg-[#070B0D] border border-[#152226] p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono font-semibold text-[#6B7C85] flex items-center space-x-1">
                            <Play className="w-2.5 h-2.5 text-[#6B7C85]" />
                            <span>{ref.views}</span>
                          </span>
                          <span className="text-[9px] text-[#6B7C85] font-semibold font-mono">{ref.platform}</span>
                        </div>
                        <h4 className="text-xs font-semibold text-[#EFEFEF] tracking-tight line-clamp-2">
                          {ref.title}
                        </h4>
                        <div className="flex justify-between items-center pt-1 border-t border-[#152226]">
                          <span className="text-[9px] text-[#6B7C85] font-mono">{ref.hashtags}</span>
                          <span className="text-[9px] text-[#10B981] hover:underline cursor-pointer">
                            View →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Bottom Action Bar */}
              <div className="border-t border-[#152226] bg-[#0D1416] px-6 py-4 flex justify-between items-center">
                <p className="text-[10px] text-[#6B7C85] font-mono">
                  Style matched with: <span className="text-[#EFEFEF] font-semibold">{voiceTone}</span>
                </p>

                <div className="flex items-center space-x-3">
                  <button 
                    className="border border-[#152226] bg-[#070B0D] text-[#6B7C85] hover:text-[#EFEFEF] hover:opacity-90 text-xs px-4 py-2 rounded-lg transition-all duration-150"
                    onClick={() => setSelectedIdea(null)}
                  >
                    Save to drafts
                  </button>
                  <button 
                    className="bg-[#10B981] hover:bg-[#12cf90] text-[#070B0D] text-xs px-4 py-2 rounded-lg font-semibold transition-all duration-150"
                    onClick={() => {
                      setSelectedIdea(null);
                      setActiveTab("Calendar");
                    }}
                  >
                    Add to calendar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
