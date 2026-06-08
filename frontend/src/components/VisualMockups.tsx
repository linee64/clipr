"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Calendar, Play, CheckCircle, Flame } from "lucide-react";

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// 1. HERO DEMO SLOT — drop your startup demo into `children`
export function HeroDemoSlot({ children }: { children?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateX: 15 }}
      animate={{ opacity: 1, y: 0, rotateX: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="w-full relative max-w-4xl mx-auto"
      style={{ perspective: 1000 }}
    >
      <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#10B981]/30 to-[#0a0f1e]/80 blur-xl opacity-75 transition duration-1000" />

      <div className="relative rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="text-zinc-500 text-xs font-mono ml-2">clipr_demo</span>
          </div>
          <div className="flex items-center space-x-2 text-xs bg-[#10B981]/10 text-[#10B981] px-3 py-1 rounded-full border border-[#10B981]/20 font-medium">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Live Demo
          </div>
        </div>

        <div className="relative min-h-[420px] md:min-h-[520px] w-full">
          {children ?? (
            <div
              className="absolute inset-0 m-4 rounded-xl border border-dashed border-zinc-800/70 bg-zinc-900/20"
              aria-hidden
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// 2. BENTO SCRIPT MOCKUP
export function BentoScriptMockup() {
  return (
    <div className="relative w-full h-full bg-zinc-950 rounded-xl p-4 border border-zinc-900 overflow-hidden text-left font-sans flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#10B981]">Script Preview</span>
          <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded">Reels / Shorts</span>
        </div>
        <div className="space-y-2 text-xs">
          <p className="text-zinc-300">
            <span className="text-[#10B981] font-bold">[0:00 - Hook]</span> Stop reading resumes. Here is how AI reads 1,000 profiles in 3 seconds...
          </p>
          <p className="text-zinc-400">
            <span className="text-zinc-500 font-semibold">[0:15 - Body]</span> You feed the API your candidate requirements. It matches score + highlights core skills in milliseconds.
          </p>
          <p className="text-zinc-450">
            <span className="text-[#10B981] font-bold">[0:45 - CTA]</span> Comment &apos;SHRED&apos; below and I&apos;ll DM you private beta access.
          </p>
        </div>
      </div>
      <div className="pt-3 border-t border-zinc-900 flex justify-between items-center mt-3 text-[10px] text-zinc-500">
        <span className="flex items-center"><Flame className="w-3.5 h-3.5 mr-1 text-[#10B981]" /> High converting structure</span>
        <span className="text-zinc-300 bg-[#10B981]/20 px-2 py-1 rounded-md text-[10px]">Copy Script</span>
      </div>
    </div>
  );
}

// 3. BENTO CALENDAR MOCKUP
export function BentoCalendarMockup() {
  const days = [
    { day: "Mo", date: "15", active: true, label: "Tiktok" },
    { day: "Tu", date: "16", active: false },
    { day: "We", date: "17", active: true, label: "Insta" },
    { day: "Th", date: "18", active: false },
    { day: "Fr", date: "19", active: true, label: "X/Post" },
    { day: "Sa", date: "20", active: false },
    { day: "Su", date: "21", active: false },
  ];

  return (
    <div className="w-full bg-zinc-950 rounded-xl p-4 border border-zinc-900 text-left">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-1.5">
          <Calendar className="w-4 h-4 text-[#10B981]" />
          <span className="text-xs font-bold text-zinc-300">June 2026</span>
        </div>
        <span className="text-[10px] text-zinc-500">Auto-scheduler Active</span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((item, idx) => (
          <div
            key={idx}
            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
              item.active
                ? "bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981]"
                : "bg-zinc-900/40 border-zinc-800 text-zinc-500"
            }`}
          >
            <span className="text-[8px] font-mono uppercase">{item.day}</span>
            <span className="text-xs font-bold mt-1 text-zinc-100">{item.date}</span>
            {item.active && (
              <span className="text-[7px] mt-1 bg-[#10B981] text-white px-1 py-0.2 rounded font-sans scale-90">
                {item.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 4. BENTO REFERENCE CARD MOCKUP
export function BentoReferencesMockup() {
  const thumbs = [
    { title: "Hook Idea #1", views: "1.2M views", duration: "0:45", color: "from-[#10B981]/30" },
    { title: "Trending Audio #4", views: "840K views", duration: "0:15", color: "from-blue-600/30" },
    { title: "Competitor Analysis", views: "340K views", duration: "0:59", color: "from-zinc-800" },
    { title: "Format Guide", views: "98K views", duration: "1:20", color: "from-emerald-600/30" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 w-full">
      {thumbs.map((item, idx) => (
        <div
          key={idx}
          className="relative rounded-lg overflow-hidden border border-zinc-900 bg-zinc-950 aspect-[4/3] group/ref cursor-pointer text-left"
        >
          <div className={`absolute inset-0 bg-gradient-to-t ${item.color} to-zinc-950/80 z-0`} />
          <div className="absolute inset-0 flex items-center justify-center z-10 opacity-0 group-hover/ref:opacity-100 transition-opacity bg-black/40">
            <span className="w-8 h-8 rounded-full bg-[#10B981] flex items-center justify-center">
              <Play className="w-4 h-4 fill-current text-white ml-0.5" />
            </span>
          </div>
          <div className="absolute bottom-2 left-2 right-2 z-10 space-y-0.5">
            <p className="text-[9px] font-bold text-white truncate">{item.title}</p>
            <div className="flex justify-between text-[8px] text-zinc-400">
              <span>{item.views}</span>
              <span>{item.duration}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// 5. BENTO TWITTER/POST COMMENT MOCKUP
export function BentoCommentsMockup() {
  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 text-left space-y-3 font-sans">
      <div className="flex items-center space-x-2">
        <TwitterIcon className="w-4 h-4 text-sky-400" />
        <span className="text-xs font-semibold text-zinc-300">Clipr Trends • 3m ago</span>
      </div>
      <p className="text-[11px] text-zinc-400 border-l border-zinc-800 pl-2 italic">
        &ldquo;HR tech is changing fast. If you&apos;re still screening resumes manually in 2026, you&apos;re missing out...&rdquo;
      </p>
      <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-850 space-y-1">
        <span className="text-[9px] font-mono text-[#10B981] block uppercase font-bold">Suggested Take (Your Voice)</span>
        <p className="text-[10px] text-zinc-200">
          &ldquo;Honestly, resumes are a terrible metric. We should focus on real-world workflow automation simulations. Here is how we&apos;re fixing it...&rdquo;
        </p>
      </div>
      <div className="flex items-center justify-between text-[9px] text-zinc-500 pt-1">
        <span className="flex items-center"><CheckCircle className="w-3 h-3 text-emerald-500 mr-1" /> Checked with voice model</span>
        <span className="text-[#10B981] font-semibold cursor-pointer">Auto-Reply</span>
      </div>
    </div>
  );
}
