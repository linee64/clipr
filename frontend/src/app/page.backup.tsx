"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Check,
  X,
  Mic,
  Music,
  Send,
  Search,
  Play,
  Pause,
  Sparkles,
  Cpu,
  Layers,
  Film,
  Smartphone
} from "lucide-react";
import { WaitlistForm } from "@/components/WaitlistForm";
import { Marquee } from "@/components/Marquee";
import { Button } from "@/components/ui/button";
import { InfiniteVideoCarousel } from "@/components/InfiniteVideoCarousel";
import { GooeyNav } from "@/components/GooeyNav";

// Custom SVG Icons for Twitter/X and LinkedIn
function XIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function LinkedInIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  );
}

function InstagramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
  );
}

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [revealText, setRevealText] = useState(false);
  const [isScrollLocked, setIsScrollLocked] = useState(true);
  const lockTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedScrollRef = React.useRef(0);
  const isUnlockingRef = React.useRef(false);

  // Redesigned Pipeline interactive states
  const [typedPrompt, setTypedPrompt] = useState("");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeSubtitleStyle, setActiveSubtitleStyle] = useState("plaque");
  const [activeColorGrade, setActiveColorGrade] = useState("cinematic");
  const [selectedBrollClip, setSelectedBrollClip] = useState("terminal");

  // Loop typing simulation for Step 1
  useEffect(() => {
    const fullPrompt = "Explain why developer velocity is the ultimate startup metric, using dark cinematic vibes and fast-paced editing.";
    let currentIndex = 0;
    let isDeleting = false;
    let timeout: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (!isDeleting) {
        setTypedPrompt(fullPrompt.slice(0, currentIndex + 1));
        currentIndex++;
        if (currentIndex === fullPrompt.length) {
          isDeleting = true;
          timeout = setTimeout(tick, 3000);
        } else {
          timeout = setTimeout(tick, 45);
        }
      } else {
        setTypedPrompt(fullPrompt.slice(0, currentIndex - 1));
        currentIndex--;
        if (currentIndex === 0) {
          isDeleting = false;
          timeout = setTimeout(tick, 800);
        } else {
          timeout = setTimeout(tick, 15);
        }
      }
    };

    tick();
    return () => clearTimeout(timeout);
  }, []);

  const bgVideos = [
    "/result/result_blueprint.mp4",
    "/result/result_dev_loop.mp4",
    "/result/result_growth_hook.mp4",
    "/result/result_solo_build.mp4"
  ];

  const handleVideoEnded = () => {
    setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % bgVideos.length);
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.scrollY > 5) {
      setRevealText(true);
      setIsScrollLocked(false);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY;
      setScrolled(currentScroll > 20);
      
      if (currentScroll > 50) {
        setRevealText(true);
        setIsScrollLocked(false);
      } else if (currentScroll <= 5) {
        setRevealText(false);
        setIsScrollLocked(true);
        accumulatedScrollRef.current = 0;
        isUnlockingRef.current = false;
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isScrollLocked) return;

    const unlockScroll = () => {
      if (isUnlockingRef.current) return;
      isUnlockingRef.current = true;
      setRevealText(true);
      lockTimeoutRef.current = setTimeout(() => {
        setIsScrollLocked(false);
        isUnlockingRef.current = false;
      }, 1800);
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY > 0) {
        accumulatedScrollRef.current += e.deltaY;
        if (accumulatedScrollRef.current >= 300) {
          unlockScroll();
        }
        e.preventDefault();
      } else if (e.deltaY < 0) {
        e.preventDefault();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      (window as unknown as { _touchStartY?: number })._touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const startY = (window as unknown as { _touchStartY?: number })._touchStartY || 0;
      const currentY = e.touches[0].clientY;
      const diffY = startY - currentY;

      if (diffY > 100) {
        unlockScroll();
        e.preventDefault();
      } else if (diffY < -10) {
        e.preventDefault();
      } else {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const keys = ["ArrowDown", "PageDown", " ", "Down"];
      if (keys.includes(e.key)) {
        unlockScroll();
        e.preventDefault();
      } else if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Up") {
        e.preventDefault();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("keydown", handleKeyDown, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("keydown", handleKeyDown);
      if (lockTimeoutRef.current) {
        clearTimeout(lockTimeoutRef.current);
      }
    };
  }, [isScrollLocked]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsRegistered(localStorage.getItem("clipr_registered") === "1");
    }
  }, []);

  const openSignup = (plan?: "1_month" | "3_months" | "6_months") => {
    if (typeof window !== "undefined") {
      if (plan) {
        localStorage.setItem("clipr_selected_plan", plan);
      } else {
        localStorage.removeItem("clipr_selected_plan");
      }
      if (localStorage.getItem("clipr_registered") === "1") {
        window.location.href = "/dashboard";
        return;
      }
    }
    setSignupOpen(true);
  };

  // Video data for Gallery
  const resultVideos = [
    {
      src: "/result/result_dev_loop.mp4",
      tag: "Fast Grind",
      title: "The Developer Loop",
      desc: "High-contrast grading, trap beats, and 0.55s rapid cuts synced to typing actions.",
    },
    {
      src: "/result/result_growth_hook.mp4",
      tag: "Hook Builder",
      title: "Stop Wasting Time",
      desc: "Bold center captions and maximum initial retention pacing for tech founders.",
    },
    {
      src: "/result/result_blueprint.mp4",
      tag: "Cinematic Slow",
      title: "Product Blueprint",
      desc: "Dark cinematic style, slow ambient background music, and reflective voiceover.",
    },
    {
      src: "/result/result_solo_build.mp4",
      tag: "Moody Arc",
      title: "The Solo Build",
      desc: "Warm color balance, low-key aesthetics, and story-driven subtitle plaque placements.",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#070B0D] selection:bg-[#10B981] selection:text-white font-sans antialiased text-white">
      {/* 2. NAVBAR */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#070B0D]/85 border-b border-zinc-900/40 backdrop-blur-md py-4"
            : "bg-transparent py-6"
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 md:px-8 flex items-center justify-between w-full">
          {/* Logo on Left */}
          <div className="flex-1 flex justify-start">
            <div
              className="flex items-center space-x-2.5 cursor-pointer z-10"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <Image
                src="/Clipr-logo.png"
                alt="Clipr"
                width={28}
                height={28}
                priority
                className="w-7 h-7 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              />
              <span className="text-xl font-bold tracking-tight text-white flex items-center font-sans">
                Clipr<span className="text-[#10B981] font-mono">.</span>
              </span>
            </div>
          </div>

          {/* Links in Center */}
          <div className="hidden md:block flex-none">
            <GooeyNav
              items={[
                { label: "Pricing", href: "#pricing" },
                { label: "Features", href: "#features" },
                { label: "Blog", href: "#gallery" }
              ]}
            />
          </div>

          {/* Buttons on Right */}
          <div className="flex-1 flex justify-end items-center space-x-5 z-10">
            <button
              onClick={() => openSignup()}
              className="text-[13px] font-medium text-zinc-400 hover:text-white transition-colors duration-200"
            >
              Contact Us
            </button>
            
            {isRegistered ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => window.location.href = "/dashboard"}
                className="rounded-full bg-white hover:bg-zinc-100 text-zinc-950 font-bold px-5 py-2.5 border-0 transition-all text-xs tracking-wide"
              >
                Go to Dashboard
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => openSignup()}
                className="rounded-full bg-white hover:bg-zinc-100 text-zinc-950 font-bold px-5 py-2.5 border-0 transition-all text-xs tracking-wide shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
              >
                Try Free
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* 3. HERO SECTION (Above the fold, sticky scroll-reveal lock) */}
      <div className="relative h-[120vh] z-10">
        <section className="sticky top-0 w-full h-screen flex flex-col justify-between pt-32 pb-12 overflow-hidden">
          {/* 1. SEQUENTIAL VIDEO BACKGROUND (Synced to sticky timeline) */}
          <div className="absolute inset-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
            <video
              key={bgVideos[currentVideoIndex]}
              src={bgVideos[currentVideoIndex]}
              autoPlay
              muted
              playsInline
              onEnded={handleVideoEnded}
              className="w-full h-full object-cover opacity-50 filter brightness-[0.6] contrast-[1.05] transition-all duration-1000"
            />
            {/* Dark gradient overlay to blend into background and keep text readable */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#070B0D]/85 via-transparent to-[#070B0D]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#070B0D_95%)]" />
            {/* Subtle green ambient glow overlay matching Clipr brand */}
            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[350px] sm:w-[600px] h-[300px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none z-0" />
          </div>

          {/* Empty container for flex layout centering */}
          <div />

          {/* Center Content */}
          <div className={`max-w-4xl mx-auto px-6 text-center space-y-7 md:space-y-9 transition-all duration-[1800ms] ease-in-out ${revealText ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12 pointer-events-none"}`}>
            <motion.h1
              className="text-[2.5rem] sm:text-[3.25rem] md:text-[4.75rem] font-medium tracking-tight leading-[1.08] text-white font-serif max-w-3xl mx-auto"
            >
              AI video creation and workflow for modern teams
            </motion.h1>

            <motion.p
              className="max-w-2xl mx-auto text-sm sm:text-base md:text-[1.08rem] text-zinc-400/90 leading-relaxed font-light font-sans"
            >
              Write scripts, assemble aesthetic B-roll, generate ElevenLabs voiceovers, and auto-post to socials — all in one flow.
            </motion.p>

            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={() => openSignup()}
                className="bg-white hover:bg-zinc-100 text-zinc-950 font-bold px-8 py-3.5 rounded-full shadow-[0_4px_25px_rgba(255,255,255,0.2)] hover:shadow-[0_4px_30px_rgba(255,255,255,0.3)] transition-all text-xs tracking-wider"
              >
                Try for Free
              </Button>
            </div>
          </div>

          {/* Empty bottom element replacing logos */}
          <div className="h-6" />
        </section>
      </div>

      {/* 3.5. SOCIAL PROOF BAR (Restored) */}
      <section className="relative z-10 py-2 border-y border-zinc-900/40 bg-zinc-950/20">
        <Marquee />
      </section>      {/* 4. THE PIPELINE SHOWCASE */}
      <section id="process" className="relative py-20 md:py-32 z-10 max-w-5xl mx-auto px-6 overflow-hidden">
        {/* Decorative background lines & glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/[0.03] rounded-full blur-[160px] pointer-events-none -z-10" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#10B981]/[0.02] rounded-full blur-[140px] pointer-events-none -z-10" />

        <div className="text-center space-y-4 mb-20 md:mb-28">
          <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[#10B981] font-bold">The Pipeline</span>
          <h2 className="text-3xl sm:text-[2.75rem] md:text-[3.5rem] font-medium font-serif tracking-tight leading-tight text-white max-w-2xl mx-auto">
            Zero friction video assembly
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto text-sm sm:text-base font-light leading-relaxed">
            From raw concept to scheduled post. See how Clipr orchestrates the entire generation process.
          </p>
        </div>

        {/* Step-by-Step Vertical Pipeline Container */}
        <div className="relative space-y-24 md:space-y-36 w-full">
          {/* Central vertical line */}
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-zinc-800/30 -translate-x-px z-0" />

          {/* Step 1 */}
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8 md:gap-16 w-full">
            {/* Timeline Dot */}
            <div className="absolute left-[7px] md:left-1/2 md:-translate-x-1/2 top-6 md:top-1/2 md:-translate-y-1/2 w-4.5 h-4.5 rounded-full bg-zinc-950 border-2 border-[#10B981] flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)] z-20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            </div>

            {/* Left Content (Text) */}
            <div className="w-full md:w-[45%] pl-8 md:pl-0 md:text-right space-y-3.5 z-10">
              <div className="flex items-center md:justify-end space-x-2 text-[10px] font-mono tracking-widest text-[#10B981] font-bold">
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-[#10B981]" />
                <span>01 / CONTENT ENGINE</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-normal font-serif text-white tracking-tight">
                AI Scripting & Prompting
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed max-w-md md:ml-auto">
                Turn your raw ideas into a viral, scene-by-scene script instantly. Every hook is optimized by our core LLM engine.
              </p>
            </div>

            {/* Right Visual (Small Card) */}
            <div className="w-full md:w-[45%] pl-8 md:pl-0 z-10">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="bg-[#0C0E0F]/90 border border-zinc-800/40 rounded-2xl p-5 shadow-2xl backdrop-blur-sm max-w-sm hover:border-[#10B981]/30 transition-all duration-300 group"
              >
                <div className="flex items-center justify-between text-[8px] font-mono text-zinc-500 mb-3.5 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><Cpu className="w-2.5 h-2.5" /> Prompt Box</span>
                  <span className="text-[#10B981] font-bold flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-[#10B981] animate-ping" /> Typing</span>
                </div>
                <div className="bg-[#050607]/80 border border-zinc-900 rounded-xl p-4 min-h-[90px] relative">
                  <p className="text-[11px] text-zinc-300 leading-relaxed font-sans select-none">
                    {typedPrompt}
                    <span className="w-1.5 h-3.5 bg-[#10B981] inline-block ml-0.5 animate-pulse align-middle" />
                  </p>
                </div>
                <div className="flex items-center justify-between mt-3.5 text-[10px]">
                  <span className="text-zinc-550 bg-zinc-900/50 px-2.5 py-1 rounded-full text-[8px] font-mono border border-zinc-850 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] opacity-75" />
                    Reels / Shorts Mode
                  </span>
                  <span className="text-zinc-400 font-mono text-[9px]">v1.4 Engine</span>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative flex flex-col md:flex-row-reverse md:items-center justify-between gap-8 md:gap-16 w-full">
            {/* Timeline Dot */}
            <div className="absolute left-[7px] md:left-1/2 md:-translate-x-1/2 top-6 md:top-1/2 md:-translate-y-1/2 w-4.5 h-4.5 rounded-full bg-zinc-950 border-2 border-[#10B981] flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)] z-20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            </div>

            {/* Right Content (Text) */}
            <div className="w-full md:w-[45%] pl-8 md:pl-0 text-left space-y-3.5 z-10">
              <div className="flex items-center space-x-2 text-[10px] font-mono tracking-widest text-[#10B981] font-bold">
                <Layers className="w-3.5 h-3.5 text-[#10B981]" />
                <span>02 / STORYBOARD MAPPING</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-normal font-serif text-white tracking-tight">
                Aesthetic B-Roll Curation
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed max-w-md">
                Our model maps atmospheric stock videos to your scenes. Click a clip below to swap references in real-time.
              </p>
            </div>

            {/* Left Visual (Small Card) */}
            <div className="w-full md:w-[45%] pl-8 md:pl-0 flex md:justify-end z-10">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="bg-[#0C0E0F]/90 border border-zinc-800/40 rounded-2xl p-5 shadow-2xl backdrop-blur-sm max-w-sm hover:border-[#10B981]/30 transition-all duration-300 w-full"
              >
                <div className="flex items-center justify-between text-[8px] font-mono text-zinc-500 mb-3 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><Search className="w-2.5 h-2.5" /> B-Roll Assets</span>
                  <span className="text-[#10B981] font-bold">Mapped ✓</span>
                </div>
                
                <div className="space-y-2">
                  {[
                    { id: "keyboard", title: "Keyboard Typing B-Roll", tag: "S1 Scene", grad: "from-emerald-950 via-zinc-950 to-indigo-950/40" },
                    { id: "terminal", title: "Terminal Scroll B-Roll", tag: "S2 Scene", grad: "from-cyan-950 via-zinc-950 to-slate-950/40" },
                    { id: "desk", title: "Aesthetic Desk Ambient", tag: "S3 Scene", grad: "from-amber-950 via-zinc-950 to-stone-950/40" },
                  ].map((c) => (
                    <div 
                      key={c.id}
                      onClick={() => setSelectedBrollClip(c.id)}
                      className={`cursor-pointer border rounded-xl p-2.5 flex items-center justify-between gap-3 text-[10px] transition-all duration-300 relative overflow-hidden group/item ${
                        selectedBrollClip === c.id 
                          ? "border-[#10B981]/50 bg-[#050607]/80 shadow-[0_0_12px_rgba(16,185,129,0.08)]" 
                          : "border-zinc-850 bg-[#050607]/20 hover:border-zinc-700/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 relative overflow-hidden">
                          <div className={`absolute inset-0 bg-gradient-to-tr ${c.grad} opacity-60`} />
                          <Film className={`w-3.5 h-3.5 text-zinc-400 group-hover/item:text-[#10B981] transition-colors relative z-10 ${selectedBrollClip === c.id ? "text-[#10B981] scale-110" : ""}`} />
                        </div>
                        <div className="text-left">
                          <span className="text-zinc-300 font-medium block text-xs">{c.title}</span>
                          <span className="text-[8px] text-zinc-500 block font-mono">{c.tag}</span>
                        </div>
                      </div>
                      <span className={`text-[8.5px] font-mono shrink-0 px-2 py-0.5 rounded-full border transition-all ${
                        selectedBrollClip === c.id 
                          ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/20 font-bold" 
                          : "bg-zinc-900 text-zinc-500 border-zinc-800"
                      }`}>
                        {selectedBrollClip === c.id ? "Active" : "Select"}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8 md:gap-16 w-full">
            {/* Timeline Dot */}
            <div className="absolute left-[7px] md:left-1/2 md:-translate-x-1/2 top-6 md:top-1/2 md:-translate-y-1/2 w-4.5 h-4.5 rounded-full bg-zinc-950 border-2 border-[#10B981] flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)] z-20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            </div>

            {/* Left Content (Text) */}
            <div className="w-full md:w-[45%] pl-8 md:pl-0 md:text-right space-y-3.5 z-10">
              <div className="flex items-center md:justify-end space-x-2 text-[10px] font-mono tracking-widest text-[#10B981] font-bold">
                <Music className="w-3.5 h-3.5 text-[#10B981]" />
                <span>03 / AUDIO ALIGNMENT</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-normal font-serif text-white tracking-tight">
                Voiceover & Soundtrack Sync
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed max-w-md md:ml-auto">
                Generate high-fidelity voice narration. Select tracks that automatically align beats and duck under the speech.
              </p>
            </div>

            {/* Right Visual (Small Card) */}
            <div className="w-full md:w-[45%] pl-8 md:pl-0 z-10">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                onMouseEnter={() => setIsPlayingAudio(true)}
                onMouseLeave={() => setIsPlayingAudio(false)}
                className="bg-[#0C0E0F]/90 border border-zinc-800/40 rounded-2xl p-5 shadow-2xl backdrop-blur-sm max-w-sm hover:border-[#10B981]/30 transition-all duration-300 w-full text-left"
              >
                <div className="flex items-center justify-between text-[8px] font-mono text-zinc-550 mb-3.5 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><Mic className="w-2.5 h-2.5" /> Voice & Beat Sync</span>
                  <span className="text-[#10B981] font-mono font-bold flex items-center gap-1">
                    {isPlayingAudio ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
                        Live Wave
                      </>
                    ) : (
                      "Hover to Play"
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-[#050607]/60 border border-zinc-850 p-3 rounded-xl mb-4">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[#10B981]/10 border border-[#10B981]/25 flex items-center justify-center shrink-0">
                      <Mic className="w-3.5 h-3.5 text-[#10B981] animate-pulse" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-zinc-355 block">Adam Voice (ElevenLabs)</span>
                      <span className="text-[8px] text-zinc-550">English Deep Narrative</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                    className="w-6 h-6 rounded-full bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center hover:bg-[#10B981]/20 transition-all"
                  >
                    {isPlayingAudio ? (
                      <Pause className="w-2.5 h-2.5 text-[#10B981]" />
                    ) : (
                      <Play className="w-2.5 h-2.5 text-[#10B981] ml-0.5" />
                    )}
                  </button>
                </div>
                
                {/* Waveform Visualization Mockup */}
                <div className="flex items-end justify-start space-x-[2px] h-9 pt-1.5 bg-[#050607]/20 border border-zinc-900/40 rounded-xl px-3.5">
                  {[10, 45, 25, 65, 45, 15, 30, 85, 55, 25, 35, 75, 95, 40, 15, 65, 30, 10, 25, 45].map((h, i) => (
                    <motion.span
                      key={i}
                      className="w-1 bg-[#10B981]/30 rounded-t flex-1"
                      animate={isPlayingAudio ? { 
                        height: [`${h * 0.4}%`, `${h}%`, `${h * 0.6}%`, `${h}%`, `${h * 0.4}%`] 
                      } : { 
                        height: `${h * 0.4}%` 
                      }}
                      transition={{ 
                        duration: 1.0, 
                        repeat: Infinity, 
                        delay: i * 0.04,
                        ease: "easeInOut"
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="relative flex flex-col md:flex-row-reverse md:items-center justify-between gap-8 md:gap-16 w-full">
            {/* Timeline Dot */}
            <div className="absolute left-[7px] md:left-1/2 md:-translate-x-1/2 top-6 md:top-1/2 md:-translate-y-1/2 w-4.5 h-4.5 rounded-full bg-zinc-950 border-2 border-[#10B981] flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)] z-20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            </div>

            {/* Right Content (Text) */}
            <div className="w-full md:w-[45%] pl-8 md:pl-0 text-left space-y-3.5 z-10">
              <div className="flex items-center space-x-2 text-[10px] font-mono tracking-widest text-[#10B981] font-bold">
                <Smartphone className="w-3.5 h-3.5 text-[#10B981]" />
                <span>04 / SUBTITLE STYLING</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-normal font-serif text-white tracking-tight">
                Kinetic Captions & Filters
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed max-w-md">
                Inject custom color filters and trendy dynamic subtitles. Click layout buttons to preview styles.
              </p>
            </div>

            {/* Left Visual (Small Card) */}
            <div className="w-full md:w-[45%] pl-8 md:pl-0 flex md:justify-end z-10">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="bg-[#0C0E0F]/90 border border-zinc-800/40 rounded-2xl p-5 shadow-2xl backdrop-blur-sm max-w-sm hover:border-[#10B981]/30 transition-all duration-300 w-full flex items-stretch justify-between gap-4"
              >
                {/* Left Side: Selectors */}
                <div className="space-y-4 text-left flex-1 flex flex-col justify-center">
                  <div className="space-y-1.5">
                    <span className="text-[7.5px] font-mono text-zinc-500 uppercase tracking-wider block font-bold">Subtitle Style</span>
                    <div className="flex flex-col gap-1">
                      {[
                        { id: "plaque", label: "Plaque Box" },
                        { id: "bold", label: "TikTok Yellow" },
                        { id: "neon", label: "Neon Outline" }
                      ].map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setActiveSubtitleStyle(s.id)}
                          className={`text-[8.5px] font-bold px-2.5 py-1 rounded-md text-left transition-all border ${
                            activeSubtitleStyle === s.id 
                              ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/25" 
                              : "bg-zinc-900/30 text-zinc-450 border-transparent hover:border-zinc-800"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <span className="text-[7.5px] font-mono text-zinc-500 uppercase tracking-wider block font-bold">Color Grade</span>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { id: "cinematic", label: "Cinematic" },
                        { id: "moody", label: "Moody" },
                        { id: "contrast", label: "High-Con" }
                      ].map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setActiveColorGrade(g.id)}
                          className={`text-[8px] px-2 py-0.5 rounded-full transition-all border ${
                            activeColorGrade === g.id 
                              ? "bg-white text-zinc-950 border-white font-bold" 
                              : "bg-zinc-900 text-zinc-450 border-zinc-800 hover:border-zinc-700"
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Side: iPhone screen preview */}
                <div className="w-28 aspect-[9/16] bg-zinc-950 border border-zinc-850 rounded-xl relative flex items-center justify-center overflow-hidden shrink-0 shadow-inner group/phone">
                  {/* Dynamic background grade overlay */}
                  <div className={`absolute inset-0 transition-all duration-700 opacity-60 ${
                    activeColorGrade === "cinematic" 
                      ? "bg-gradient-to-tr from-emerald-950/50 via-zinc-950 to-indigo-950/20" 
                      : activeColorGrade === "moody" 
                        ? "bg-gradient-to-tr from-violet-950/60 via-zinc-950 to-cyan-950/30" 
                        : "bg-gradient-to-tr from-rose-950/40 via-zinc-950 to-amber-950/20"
                  }`} />
                  
                  {/* Grid Lines Mockup */}
                  <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:14px_24px]" />

                  {/* Subtitle text dynamically changing styles */}
                  <div className="z-10 text-center px-2">
                    {activeSubtitleStyle === "plaque" && (
                      <span className="inline-block bg-[#0A0D0E]/90 border border-[#10B981]/50 text-[#10B981] font-mono font-black text-[7.5px] uppercase px-1.5 py-0.5 rounded shadow-[0_0_10px_rgba(16,185,129,0.25)] tracking-widest scale-100 animate-pulse">
                        LOCKED IN.
                      </span>
                    )}
                    {activeSubtitleStyle === "bold" && (
                      <span className="text-yellow-400 font-extrabold text-[9px] uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-sans italic block animate-bounce">
                        DEVELOPER VELOCITY.
                      </span>
                    )}
                    {activeSubtitleStyle === "neon" && (
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-[#10B981] font-sans font-black text-[8.5px] uppercase tracking-wider block drop-shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse">
                        GO FAST ✓
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8 md:gap-16 w-full">
            {/* Timeline Dot */}
            <div className="absolute left-[7px] md:left-1/2 md:-translate-x-1/2 top-6 md:top-1/2 md:-translate-y-1/2 w-4.5 h-4.5 rounded-full bg-zinc-950 border-2 border-[#10B981] flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)] z-20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            </div>

            {/* Left Content (Text) */}
            <div className="w-full md:w-[45%] pl-8 md:pl-0 md:text-right space-y-3.5 z-10">
              <div className="flex items-center md:justify-end space-x-2 text-[10px] font-mono tracking-widest text-[#10B981] font-bold">
                <Send className="w-3.5 h-3.5 text-[#10B981]" />
                <span>05 / DISTRIBUTION</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-normal font-serif text-white tracking-tight">
                Automated Calendar Queue
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed max-w-md md:ml-auto">
                Connect your social accounts via OAuth. Instantly auto-publish generated clips or enqueue them into our calendar.
              </p>
            </div>

            {/* Right Visual (Small Card) */}
            <div className="w-full md:w-[45%] pl-8 md:pl-0 z-10">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="bg-[#0C0E0F]/90 border border-zinc-800/40 rounded-2xl p-5 shadow-2xl backdrop-blur-sm max-w-sm hover:border-[#10B981]/30 transition-all duration-300 w-full text-left"
              >
                <div className="flex items-center justify-between text-[8px] font-mono text-zinc-555 mb-3.5 uppercase tracking-wider">
                  <span>Weekly Queue</span>
                  <span className="text-[#10B981] font-mono text-[8px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <span className="w-1/2 h-1/2 bg-[#10B981] rounded-full animate-ping" /> Connected
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { day: "Mon", active: true, label: "Dev Velocity", network: "X" },
                    { day: "Wed", active: true, label: "Gemini AI", network: "LinkedIn" },
                    { day: "Fri", active: false, label: "Open", network: "" }
                  ].map((d, i) => (
                    <div 
                      key={i} 
                      className={`p-2 rounded-xl border flex flex-col justify-between min-h-[72px] transition-all duration-300 ${
                        d.active 
                          ? "bg-[#0A0D0E]/80 border-[#10B981]/25 hover:border-[#10B981]/50 shadow-[0_4px_12px_rgba(16,185,129,0.04)]" 
                          : "bg-[#050607]/20 border-zinc-900/60 hover:border-zinc-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[7.5px] font-mono text-zinc-500 font-bold block">{d.day}</span>
                        {d.active && (
                          <span className="text-[7.5px] text-[#10B981] font-mono font-bold">{d.network}</span>
                        )}
                      </div>
                      {d.active ? (
                        <span className="text-[8px] text-zinc-300 font-bold block truncate leading-none mt-1">{d.label}</span>
                      ) : (
                        <span className="text-[7px] text-zinc-750 italic block leading-none mt-1">Open Slot</span>
                      )}
                      <div className={`w-1.5 h-1.5 rounded-full bg-[#10B981] mt-1.5 opacity-85 ${d.active ? "block" : "hidden"}`} />
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Call to Action Banner under the pipeline */}
        <div className="mt-24 max-w-4xl mx-auto bg-zinc-950/60 border border-zinc-900/60 backdrop-blur-md rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[0_15px_35px_rgba(16,185,129,0.02)] z-10">
          <div className="text-left space-y-1">
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#10B981] font-bold block">
              Experience the Full Studio
            </span>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-sans max-w-xl">
              Ready to automate your social video pipeline? Create your first storyboard and let Clipr render, voice, and publish it.
            </p>
          </div>
          <button
            onClick={() => openSignup()}
            className="bg-[#10B981] hover:bg-emerald-500 text-zinc-950 font-bold px-6 py-3 rounded-full text-xs transition-all shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.35)] font-sans"
          >
            Try dashboard for free ✓
          </button>
        </div>
      </section>

      {/* 5. PRICING PRESET GALLERY (RESULT GALLERY) */}
      <section id="gallery" className="relative py-20 md:py-32 bg-[#090e10]/20 border-y border-zinc-900/40 z-10 overflow-hidden">
        {/* Soft atmospheric glows */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[450px] h-[450px] bg-emerald-500/[0.02] rounded-full blur-[130px] pointer-events-none -z-10" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[350px] h-[350px] bg-indigo-500/[0.015] rounded-full blur-[110px] pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center space-y-4 mb-16">
            <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[#10B981] font-bold">On-Chain Proof</span>
            <h2 className="text-3xl sm:text-[2.75rem] md:text-[3.5rem] font-medium font-serif tracking-tight leading-tight text-white max-w-2xl mx-auto">
              Generated in under 3 minutes
            </h2>
            <p className="text-zinc-400 max-w-md mx-auto text-sm sm:text-base font-light leading-relaxed">
              These actual vertical videos were completely rendered inside Clipr from simple idea inputs.
            </p>
          </div>
        </div>

        {/* Carousel on Mobile, Grid on Desktop */}
        <div className="lg:hidden">
          <InfiniteVideoCarousel videos={resultVideos} />
        </div>

        <div className="hidden lg:block max-w-6xl mx-auto px-8">
          <div className="grid grid-cols-4 gap-6">
            {resultVideos.map((video, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                className="group relative flex flex-col justify-between rounded-2xl bg-[#0C0E0F]/80 border border-zinc-800/40 overflow-hidden hover:border-[#10B981]/30 transition-all duration-500 shadow-xl hover:shadow-[0_20px_50px_rgba(16,185,129,0.05)] hover:scale-[1.02]"
              >
                <div className="relative aspect-[9/16] w-full overflow-hidden bg-zinc-900/10">
                  <video
                    src={video.src}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent opacity-60 pointer-events-none" />
                  <span className="absolute top-3.5 left-3.5 text-[9px] uppercase font-mono tracking-wider font-semibold text-[#10B981] bg-[#10B981]/8 border border-[#10B981]/20 px-3 py-1 rounded-full backdrop-blur-md shadow-sm">
                    {video.tag}
                  </span>
                </div>
                <div className="p-5 space-y-1.5 bg-[#0C0E0F]/90 z-10 border-t border-zinc-900/40 text-left">
                  <h3 className="font-medium font-serif text-base text-white group-hover:text-[#10B981] transition-colors duration-300">
                    {video.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed font-light">
                    {video.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. BENTO FEATURE GRID */}
      <section id="features" className="relative py-20 md:py-28 z-10 max-w-6xl mx-auto px-6">
        <div className="text-center space-y-3 mb-16">
          <span className="text-[11px] uppercase font-mono tracking-[0.25em] text-[#10B981] font-bold">Tech Stack Depth</span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
            Designed for technical founders
          </h2>
          <p className="text-zinc-400 max-w-md mx-auto text-sm sm:text-base">
            No messy timelines or drag-and-drop keyframes. We automate the video engineering.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bento Box 1 */}
          <div className="md:col-span-2 rounded-2xl bg-zinc-950 border border-zinc-900 p-6.5 flex flex-col justify-between hover:border-zinc-800/80 transition-colors">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Music className="w-5 h-5 text-[#10B981]" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Audio Beat-Match Engine</h3>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">
                We analyze background tracks using Librosa frequency peak and transient beat detection. Cuts, zooms, and filter shifts are automatically mapped to music beats, creating professional-grade editor pacing.
              </p>
            </div>
            <div className="mt-6 flex items-center space-x-2 text-xs font-mono text-[#10B981]">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>FFmpeg & Librosa dynamic compilation</span>
            </div>
          </div>

          {/* Bento Box 2 */}
          <div className="rounded-2xl bg-zinc-950 border border-zinc-900 p-6.5 flex flex-col justify-between hover:border-zinc-800/80 transition-colors">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Mic className="w-5 h-5 text-[#10B981]" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">ElevenLabs Voiceover</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Add natural AI narration in one click. Premium Pro templates grant access to high-fidelity narrator models that keep the user locked in.
              </p>
            </div>
            <span className="mt-6 text-xs text-zinc-500 font-mono uppercase font-bold">12+ premium voice variants</span>
          </div>

          {/* Bento Box 3 */}
          <div className="rounded-2xl bg-zinc-950 border border-zinc-900 p-6.5 flex flex-col justify-between hover:border-zinc-800/80 transition-colors">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Search className="w-5 h-5 text-[#10B981]" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Pexels Integration</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Search and download high-resolution vertical B-roll clips directly from the editor workspace. Import stock files with zero manual downloads.
              </p>
            </div>
            <span className="mt-6 text-xs text-zinc-500 font-mono uppercase font-bold">Pexels stock API library</span>
          </div>

          {/* Bento Box 4 */}
          <div className="md:col-span-2 rounded-2xl bg-zinc-950 border border-zinc-900 p-6.5 flex flex-col justify-between hover:border-zinc-800/80 transition-colors">
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Send className="w-5 h-5 text-[#10B981]" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">OAuth Multi-Channel Publishing</h3>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">
                Authorize profiles securely via API. Publish directly to X, LinkedIn, or Instagram Reels. Our background worker scheduler triggers posts based on your visual calendar times automatically.
              </p>
            </div>
            <div className="mt-6 flex gap-4">
              <span className="text-xs text-zinc-500 font-mono">X (OAuth 2.0)</span>
              <span className="text-xs text-zinc-500 font-mono">LinkedIn (Partner API)</span>
              <span className="text-xs text-zinc-500 font-mono">Meta Graph API</span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. PRICING SECTION */}
      <section id="pricing" className="relative py-20 md:py-28 bg-[#090e10]/40 border-y border-zinc-900/50 z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-zinc-400 text-sm md:text-base">
              Start for free, upgrade when you require larger production quotas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto items-stretch">
            {/* Free Plan */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="relative rounded-2xl bg-zinc-950 border border-zinc-800/80 p-6 flex flex-col justify-between"
            >
              <div className="space-y-4 pt-2">
                <div className="text-center">
                  <span className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Free Tier</span>
                  <div className="flex items-baseline justify-center mt-1.5">
                    <span className="text-4xl font-black text-white">$0</span>
                    <span className="text-zinc-500 text-xs ml-1 font-mono">/ month</span>
                  </div>
                </div>

                <div className="border-t border-zinc-900 pt-5 space-y-3">
                  {[
                    "5 videos rendered per month",
                    "3 storyboard regens per month",
                    "2 AI voiceovers per month",
                    "Pexels stock clips search",
                    "TikTok Bold & basic caption styles",
                  ].map((feat, idx) => (
                    <div key={idx} className="flex items-start space-x-2.5 text-zinc-300 text-xs leading-tight">
                      <Check className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 space-y-3">
                <Button variant="outline" size="sm" className="w-full py-3 rounded-full text-xs font-bold border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/80" onClick={() => openSignup()}>
                  Get Started Free
                </Button>
                <p className="text-[9px] text-zinc-500 text-center tracking-wide font-mono">
                  No credit card required
                </p>
              </div>
            </motion.div>

            {/* 1 Month Pro Plan */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative rounded-2xl bg-zinc-950 border border-zinc-800/80 p-6 flex flex-col justify-between"
            >
              <div className="space-y-4 pt-2">
                <div className="text-center">
                  <span className="text-zinc-500 text-xs uppercase tracking-widest font-bold">1-Month Pro</span>
                  <div className="flex items-baseline justify-center mt-1.5">
                    <span className="text-4xl font-black text-white">$10</span>
                    <span className="text-zinc-500 text-xs ml-1 font-mono">/ month</span>
                  </div>
                </div>

                <div className="border-t border-zinc-900 pt-5 space-y-3">
                  {[
                    "10 videos rendered per month",
                    "10 storyboard generations per month",
                    "10 AI voiceovers per month",
                    "Access to premium voices & templates",
                    "Scheduled auto-posting to X & LinkedIn",
                    "Pay-as-you-go flexibility",
                  ].map((feat, idx) => (
                    <div key={idx} className="flex items-start space-x-2.5 text-zinc-300 text-xs leading-tight">
                      <Check className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                      <span className={idx === 5 ? "font-medium text-[#10B981]" : ""}>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 space-y-3">
                <Button variant="outline" size="sm" className="w-full py-3 rounded-full text-xs font-bold border-[#10B981]/50 text-[#10B981] hover:bg-[#10B981]/10 bg-transparent" onClick={() => openSignup("1_month")}>
                  Upgrade to Pro
                </Button>
                <p className="text-[9px] text-zinc-500 text-center tracking-wide font-mono">
                  Billed securely via Polar
                </p>
              </div>
            </motion.div>

            {/* 3 Months Pro Plan */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative rounded-2xl bg-zinc-950 border-2 border-[#10B981] p-6 shadow-[0_8px_30px_rgba(16,185,129,0.12)] flex flex-col justify-between transform md:-translate-y-2"
            >
              <div className="absolute -top-3 left-[50%] -translate-x-[50%] bg-[#10B981] text-zinc-950 text-[9px] font-mono font-bold uppercase tracking-wider px-4 py-1 rounded-full shadow-[0_4px_12px_rgba(16,185,129,0.3)] whitespace-nowrap">
                Most Popular (-50%)
              </div>

              <div className="space-y-4 pt-2">
                <div className="text-center">
                  <span className="text-zinc-500 text-xs uppercase tracking-widest font-bold">3-Month Pro</span>
                  <div className="flex flex-col items-center justify-center mt-1.5">
                    <div className="flex items-baseline space-x-2">
                      <span className="text-lg font-bold text-zinc-500 line-through">$30</span>
                      <span className="text-4xl font-black text-white">$14.99</span>
                    </div>
                    <span className="text-zinc-400 text-[10px] font-mono mt-1">Billed every 3 months (~$5/mo)</span>
                  </div>
                </div>

                <div className="border-t border-zinc-900 pt-5 space-y-3">
                  {[
                    "20 videos rendered per month",
                    "Unlimited storyboard generations",
                    "Unlimited ElevenLabs voiceovers",
                    "Premium voices & visual templates",
                    "Scheduled auto-posting to X & LinkedIn",
                    "Premium scriptwriting & viral hook generation",
                  ].map((feat, idx) => (
                    <div key={idx} className="flex items-start space-x-2.5 text-zinc-300 text-xs leading-tight">
                      <Check className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                      <span className={idx === 5 ? "font-medium text-[#10B981]" : ""}>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 space-y-3">
                <Button variant="primary" size="sm" className="w-full py-3 rounded-full text-xs font-bold bg-[#10B981] hover:bg-[#12cf90] text-zinc-950 border-0 shadow-[0_0_18px_rgba(16,185,129,0.3)]" onClick={() => openSignup("3_months")}>
                  Start 5-Day Free Trial
                </Button>
                <p className="text-[9px] text-zinc-500 text-center tracking-wide font-mono">
                  Billed securely via Polar
                </p>
              </div>
            </motion.div>

            {/* 6 Months Pro Plan */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="relative rounded-2xl bg-zinc-950 border border-zinc-800/80 p-6 flex flex-col justify-between"
            >
              <div className="absolute -top-3 left-[50%] -translate-x-[50%] bg-indigo-500 text-white text-[9px] font-mono font-bold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-[0_4px_12px_rgba(99,102,241,0.3)]">
                Best Value
              </div>

              <div className="space-y-4 pt-2">
                <div className="text-center">
                  <span className="text-zinc-500 text-xs uppercase tracking-widest font-bold">6-Month Pro</span>
                  <div className="flex flex-col items-center justify-center mt-1.5">
                    <span className="text-4xl font-black text-white">$35</span>
                    <span className="text-zinc-400 text-[10px] font-mono mt-1">Billed every 6 months (~$5.83/mo)</span>
                  </div>
                </div>

                <div className="border-t border-zinc-900 pt-5 space-y-3">
                  {[
                    "50 videos rendered per month",
                    "Unlimited storyboard generations",
                    "Unlimited ElevenLabs voiceovers",
                    "Access to premium voices & templates",
                    "Scheduled auto-posting to X & LinkedIn",
                    "Priority rendering queue",
                  ].map((feat, idx) => (
                    <div key={idx} className="flex items-start space-x-2.5 text-zinc-300 text-xs leading-tight">
                      <Check className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                      <span className={idx === 5 ? "font-medium text-indigo-400" : ""}>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 space-y-3">
                <Button variant="outline" size="sm" className="w-full py-3 rounded-full text-xs font-bold border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10 bg-transparent" onClick={() => openSignup("6_months")}>
                  Upgrade to Pro
                </Button>
                <p className="text-[9px] text-zinc-500 text-center tracking-wide font-mono">
                  Billed securely via Polar
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 8. FAQ SECTION */}
      <section className="relative py-20 md:py-28 z-10 max-w-4xl mx-auto px-6">
        <div className="text-center space-y-3 mb-16">
          <span className="text-[11px] uppercase font-mono tracking-[0.25em] text-[#10B981] font-bold">Information</span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {[
            {
              q: "Do I need my own video footage?",
              a: "Not at all. While you can upload your own phone recordings, Clipr integrates directly with Pexels stock video. You can search, preview, and select high-resolution aesthetic clips from right inside the visual workspace.",
            },
            {
              q: "How does the social media auto-posting work?",
              a: "Clipr links to your X (Twitter), LinkedIn, and Instagram Reels profiles using standard OAuth 2.0 protocols. We never store your passwords. Renders are posted directly through their official APIs, either instantly or queued in our calendar scheduler.",
            },
            {
              q: "What are storyboard regens?",
              a: "When you enter an idea, Clipr drafts a visual storyboard script. On the Free plan, you are limited to 3 total storyboard generations. Pro subscribers get unlimited generations, allowing you to test different hooks and pacing drafts freely.",
            },
            {
              q: "Can I cancel my subscription at any time?",
              a: "Yes. All plans and payments are handled securely through Polar. You can cancel your subscription with one click from the studio settings. If you cancel during the 5-day trial period, you will not be charged a single cent.",
            },
          ].map((faq, idx) => (
            <div key={idx} className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-5.5 hover:border-zinc-800 transition-colors">
              <h3 className="font-bold text-base text-white tracking-tight">{faq.q}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed mt-2">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="relative border-t border-zinc-900 py-12 md:py-16 bg-[#070B0D] backdrop-blur-sm z-10">
        <div className="max-w-6xl mx-auto px-6 md:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start space-x-2">
              <Image
                src="/Clipr-logo.png"
                alt="Clipr"
                width={24}
                height={24}
                className="w-6 h-6 rounded-md"
              />
              <span className="font-bold text-lg text-white">Clipr</span>
            </div>
            <p className="text-xs text-zinc-500">Aesthetic short-form video creation in one pipeline.</p>
          </div>

          <div className="flex flex-col items-center md:items-end gap-3 text-xs text-zinc-450">
            <div className="flex space-x-6">
              <a href="#privacy" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#terms" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
            <div className="flex items-center space-x-4">
              <a href="https://x.com/clipr" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors" aria-label="X (Twitter)">
                <XIcon className="w-4 h-4" />
              </a>
              <a href="https://linkedin.com/company/clipr" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors" aria-label="LinkedIn">
                <LinkedInIcon className="w-4 h-4" />
              </a>
              <a href="https://instagram.com/clipr" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors" aria-label="Instagram">
                <InstagramIcon className="w-4 h-4" />
              </a>
            </div>
            <p className="text-zinc-500 font-mono">Made by a founder, for founders</p>
            <p className="text-[10px] text-zinc-650 mt-1">© Clipr 2026. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* SIGN-UP MODAL — opened by every "Get started" / "Start Trial" CTA */}
      <AnimatePresence>
        {signupOpen && (
          <div className="fixed inset-0 z-[60] flex items-start md:items-center justify-center overflow-y-auto p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setSignupOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-[6px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative z-10 my-auto w-full max-w-md overflow-hidden rounded-3xl border border-[#10B981]/30 bg-zinc-950/95 backdrop-blur-xl p-6 sm:p-8 shadow-2xl"
              style={{ boxShadow: "0 0 45px rgba(16,185,129,0.15)" }}
            >
              <div
                className="pointer-events-none absolute -top-24 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full blur-3xl"
                style={{ background: "radial-gradient(circle, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0) 70%)" }}
              />
              <button
                onClick={() => setSignupOpen(false)}
                aria-label="Close"
                className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative text-center space-y-2 mb-6">
                <div className="flex items-center justify-center gap-2">
                  <Image
                    src="/Clipr-logo.png"
                    alt="Clipr"
                    width={28}
                    height={28}
                    className="w-7 h-7 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                  />
                  <span className="text-xl font-bold tracking-tight text-white">
                    Clipr<span className="text-[#10B981] font-mono">.</span>
                  </span>
                </div>
                <h3 className="text-2xl font-black tracking-tight text-white pt-1">Get started free</h3>
                <p className="text-sm text-zinc-400">
                  Turn your first idea into a ready-to-post video today.
                </p>
              </div>

              <div className="relative">
                <WaitlistForm />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
