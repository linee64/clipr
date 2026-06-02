"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Scissors,
  Clock,
  Link2Off,
  CalendarOff,
  Sparkles,
  Search,
  Check,
  Send,
  FileText,
  ArrowRight
} from "lucide-react";
import { WaitlistForm } from "@/components/WaitlistForm";
import { Marquee } from "@/components/Marquee";
import { Button } from "@/components/ui/button";
import {
  HeroDashboardMockup,
  BentoScriptMockup,
  BentoCalendarMockup,
  BentoReferencesMockup,
  BentoCommentsMockup,
} from "@/components/VisualMockups";

export default function Home() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToWaitlist = () => {
    const element = document.getElementById("waitlist-section");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Scroll animations variants
  const fadeInVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden selection:bg-[#10B981]">
      {/* Dynamic blurred glow orb in Hero background */}
      <div className="absolute top-[10%] left-[50%] -translate-x-[50%] w-[350px] md:w-[600px] h-[350px] md:h-[600px] bg-gradient-to-tr from-[#10B981] to-blue-900 rounded-full blur-[100px] opacity-[0.15] animate-pulseSlow pointer-events-none z-0" />

      {/* 1. NAVBAR */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
            ? "bg-zinc-950/70 border-b border-zinc-900/80 backdrop-blur-md py-4"
            : "bg-transparent py-6"
          }`}
      >
        <div className="max-w-6xl mx-auto px-6 md:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <div className="w-8 h-8 rounded-lg bg-[#10B981] flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.5)]">
              <Scissors className="w-4 h-4 text-white rotate-90" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white flex items-center">
              Clipr<span className="text-[#10B981] font-mono">.</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-zinc-400">
            <a href="#problem" className="hover:text-white transition-colors">The Problem</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </nav>

          <div>
            <Button variant="glass" size="sm" onClick={scrollToWaitlist} className="border border-zinc-800 text-zinc-200">
              Join waitlist
            </Button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-28 z-10">
        <div className="max-w-5xl mx-auto px-4 md:px-8 text-center space-y-8">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center space-x-2 bg-zinc-900 border border-zinc-800 rounded-full px-4.5 py-1.5 text-xs text-zinc-300 shadow-inner"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span>Now in beta</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-300 font-semibold">Join 200+ founders</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-[2.50rem] sm:text-7xl md:text-8xl font-black tracking-tight leading-[0.9] text-white"
          >
            Your content team. <br />
            <span className="text-gradient font-extrabold text-[#10B981]">Minus the team.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="max-w-2xl mx-auto text-lg md:text-xl text-zinc-400 leading-relaxed font-light"
          >
            Clipr turns your idea into a ready-to-post Reel or TikTok — script, references, calendar, and auto-posting. In one flow.
          </motion.p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="pt-2"
          >
            <Button variant="primary" size="lg" onClick={() => window.location.href = '/dashboard'}>
              Launch Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <p className="text-[10px] text-zinc-500 mt-3 tracking-wide">
              Free 7-day trial · No credit card · Cancel anytime
            </p>
          </motion.div>

          {/* Hero visual: tilted mockup dashboard */}
          <div className="pt-12 md:pt-16 max-w-4xl mx-auto">
            <HeroDashboardMockup />
          </div>
        </div>
      </section>

      {/* 3. SOCIAL PROOF BAR */}
      <section className="relative z-10 py-4">
        <Marquee />
      </section>

      {/* 4. PROBLEM SECTION */}
      <section id="problem" className="relative py-24 md:py-32 z-10 max-w-6xl mx-auto px-4 md:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInVariants}
          className="text-center space-y-4 mb-16"
        >
          <span className="text-xs uppercase font-mono tracking-widest text-[#10B981] font-bold">The Struggle</span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white">
            Content is killing your focus
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto text-sm md:text-base">
            Writing, editing, scheduling, and researching take up hours that you should spend building.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: "3+ hours per video",
              desc: "Researching hooks, scripting word-for-word, and matching formatting eats up your calendar.",
              icon: <Clock className="w-6 h-6 text-[#10B981]" />,
            },
            {
              title: "3 different tools",
              desc: "Switching back and forth between Notion scripts, Drive media folders, and buffer calendars.",
              icon: <Link2Off className="w-6 h-6 text-[#10B981]" />,
            },
            {
              title: "No consistency",
              desc: "Posting goes from a weekly plan to monthly, or stops entirely when workloads hit capacity.",
              icon: <CalendarOff className="w-6 h-6 text-[#10B981]" />,
            },
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="p-8 rounded-2xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-all duration-300 group flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800 group-hover:scale-110 transition-transform duration-300">
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-white group-hover:text-[#10B981] transition-colors">{item.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 5. HOW IT WORKS */}
      <section id="how-it-works" className="relative py-24 md:py-32 bg-zinc-950/40 border-y border-zinc-900/60 z-10">
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInVariants}
            className="text-center space-y-4 mb-20"
          >
            <span className="text-xs uppercase font-mono tracking-widest text-[#10B981] font-bold">The Pipeline</span>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white">
              From idea to posted.<br className="md:hidden" /> In 20 minutes.
            </h2>
          </motion.div>

          {/* Timeline Wrapper */}
          <div className="relative border-l-2 border-zinc-900 ml-8 md:ml-12 pl-8 md:pl-16 space-y-16">
            {[
              {
                step: "01",
                title: "Drop your idea",
                desc: "Describe your product, service, or niche in a sentence. Clipr's context engine extracts key selling points automatically.",
                badge: "Idea Ingestion",
                icon: <Sparkles className="w-4 h-4 text-white" />,
              },
              {
                step: "02",
                title: "Get your script",
                desc: "AI automatically drafts engaging Hooks, structured scripts, visual prompt directions, and custom Call-To-Actions customized for Reels & TikTok.",
                badge: "Script Engine",
                icon: <FileText className="w-4 h-4 text-white" />,
              },
              {
                step: "03",
                title: "See references",
                desc: "Browse a dynamically curated feed of top-performing videos from your exact niche to guide your lighting, style, and delivery.",
                badge: "Visual Research",
                icon: <Search className="w-4 h-4 text-white" />,
              },
              {
                step: "04",
                title: "Schedule & post",
                desc: "Select a date/time or let Clipr post automatically. Clipr schedules the video directly to your accounts with pre-filled optimized hashtags.",
                badge: "Auto Publisher",
                icon: <Send className="w-4 h-4 text-white" />,
              },
            ].map((stepItem, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                className="relative"
              >
                {/* Step badge positioned absolute on the timeline connector line */}
                <div className="absolute -left-[50px] md:-left-[82px] top-1.5 w-10 h-10 rounded-full bg-[#080808] border-2 border-zinc-800 hover:border-[#10B981] flex items-center justify-center text-white transition-all shadow-[0_0_10px_rgba(0,0,0,0.8)]">
                  <span className="text-xs font-bold text-zinc-300 font-mono group-hover:text-white">{stepItem.step}</span>
                </div>

                <div className="space-y-2 max-w-xl">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/25 px-2.5 py-0.5 rounded-full">
                      {stepItem.badge}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white pt-1">{stepItem.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{stepItem.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. FEATURES — BENTO GRID */}
      <section id="features" className="relative py-24 md:py-32 z-10 max-w-6xl mx-auto px-4 md:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInVariants}
          className="text-center space-y-4 mb-16"
        >
          <span className="text-xs uppercase font-mono tracking-widest text-[#10B981] font-bold">Capabilities</span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white">
            Everything in one place
          </h2>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Card 1: AI Script Generator (2 cols wide) */}
          <div className="md:col-span-2 rounded-2xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-all p-6 md:p-8 flex flex-col justify-between space-y-6 overflow-hidden min-h-[350px]">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full font-bold">Main Engine</span>
              <h3 className="text-2xl font-bold text-white">AI Script Generator</h3>
              <p className="text-sm text-zinc-400 max-w-md">
                Writes high-conversion scripts tailored to your voice model, optimized hooks, and custom overlays.
              </p>
            </div>
            <div className="w-full">
              <BentoScriptMockup />
            </div>
          </div>

          {/* Card 2: Trend Comments (Medium) */}
          <div className="rounded-2xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-all p-6 md:p-8 flex flex-col justify-between space-y-6 min-h-[350px]">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-mono tracking-widest text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded-full font-bold">Growth Hack</span>
              <h3 className="text-2xl font-bold text-white">Trend Comments</h3>
              <p className="text-sm text-zinc-400">
                Clipr spots trending news in your industry and scripts comments/takes written in your specific voice.
              </p>
            </div>
            <BentoCommentsMockup />
          </div>

          {/* Card 3: Content Calendar (Medium) */}
          <div className="rounded-2xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-all p-6 md:p-8 flex flex-col justify-between space-y-6 min-h-[350px]">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full font-bold">Automation</span>
              <h3 className="text-2xl font-bold text-white">Content Calendar</h3>
              <p className="text-sm text-zinc-400">
                Plan, organize, and drag-and-drop drafts. Automate posting days weeks in advance.
              </p>
            </div>
            <BentoCalendarMockup />
          </div>

          {/* Card 4: References (Small / Row) */}
          <div className="rounded-2xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-all p-6 md:p-8 flex flex-col justify-between space-y-6 min-h-[350px]">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full font-bold">Curation</span>
              <h3 className="text-2xl font-bold text-white">Competitor Library</h3>
              <p className="text-sm text-zinc-400">
                A feed of top references matching your generated hooks so you see format trends immediately.
              </p>
            </div>
            <BentoReferencesMockup />
          </div>

          {/* Card 5: Auto Posting (Small / Row) */}
          <div className="rounded-2xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-all p-6 md:p-8 flex flex-col justify-between min-h-[350px] text-center">
            <div className="space-y-2 text-left">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full font-bold">Publishing</span>
              <h3 className="text-2xl font-bold text-white">Auto Posting</h3>
              <p className="text-sm text-zinc-400">
                Direct integration with social platforms. Clipr posts directly to your profile.
              </p>
            </div>

            <div className="py-6 flex flex-wrap gap-3 justify-center items-center">
              {["TikTok", "Instagram", "LinkedIn", "YouTube", "Twitter/X"].map((plat, idx) => (
                <div key={idx} className="flex items-center space-x-1.5 bg-zinc-900/60 border border-zinc-850 px-3.5 py-2 rounded-full text-xs font-semibold text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-green-500" />
                  <span>{plat}</span>
                </div>
              ))}
            </div>

            <div className="text-[10px] text-zinc-500 border-t border-zinc-900 pt-3 text-left">
              * Official developer APIs only. Secure & sandbox verified.
            </div>
          </div>

        </div>
      </section>

      {/* 7. PRICING */}
      <section id="pricing" className="relative py-24 md:py-32 bg-zinc-950/40 border-y border-zinc-900/60 z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInVariants}
            className="text-center space-y-4 mb-16"
          >
            <span className="text-xs uppercase font-mono tracking-widest text-[#10B981] font-bold">Subscription</span>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white">
              Simple pricing
            </h2>
          </motion.div>

          <div className="max-w-md mx-auto">
            {/* Center Plan Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="relative rounded-3xl bg-zinc-950 border-2 border-[#10B981]/50 p-8 md:p-10 shadow-[0_10px_50px_rgba(16,185,129,0.15)] flex flex-col justify-between"
            >
              {/* Hot badge */}
              <div className="absolute -top-3.5 left-[50%] -translate-x-[50%] bg-[#10B981] text-white text-xs font-mono font-bold uppercase tracking-wider px-4 py-1.5 rounded-full shadow-[0_4px_15px_rgba(16,185,129,0.4)]">
                Pro Access
              </div>

              <div className="space-y-6 pt-2">
                <div className="text-center">
                  <span className="text-zinc-500 text-sm uppercase tracking-wider block font-bold">Full Workflow</span>
                  <div className="flex items-baseline justify-center mt-2">
                    <span className="text-5xl font-black text-white">$29</span>
                    <span className="text-zinc-500 text-sm ml-1">/ month</span>
                  </div>
                </div>

                <div className="border-t border-zinc-900 pt-6 space-y-4">
                  {[
                    "Unlimited script generation",
                    "TikTok & LinkedIn auto-posting",
                    "Content calendar",
                    "Trend comment generator",
                    "Reference library",
                  ].map((feat, idx) => (
                    <div key={idx} className="flex items-center space-x-3 text-zinc-300 text-sm">
                      <div className="w-5 h-5 rounded-full bg-[#10B981]/10 flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 text-[#10B981]" />
                      </div>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 space-y-3">
                <Button variant="primary" className="w-full py-4 rounded-xl" onClick={() => window.location.href = '/dashboard'}>
                  Start free 7-day trial
                </Button>
                <p className="text-[10px] text-zinc-500 text-center tracking-wide">
                  Then $29/mo · Cancel anytime
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 8. WAITLIST CTA SECTION */}
      <section id="waitlist-section" className="relative py-28 md:py-36 z-10 max-w-4xl mx-auto px-4 md:px-8 text-center">
        {/* Card wrapper */}
        <div className="relative rounded-3xl bg-zinc-950 border border-zinc-900 p-8 md:p-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#10B981]/5 to-blue-900/5 pointer-events-none" />

          <div className="relative space-y-8 max-w-xl mx-auto z-10">
            <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
              Be the first to ship more content, faster
            </h2>

            <p className="text-sm md:text-base text-zinc-400">
              Join the waitlist today. We are rolling out private access slots to 15 creators every Monday.
            </p>

            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="relative border-t border-zinc-900 py-12 md:py-16 bg-zinc-950/20 backdrop-blur-sm z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start space-x-2">
              <div className="w-6 h-6 rounded-md bg-[#10B981] flex items-center justify-center">
                <Scissors className="w-3.5 h-3.5 text-white rotate-90" />
              </div>
              <span className="font-bold text-lg text-white">Clipr</span>
            </div>
            <p className="text-xs text-zinc-500">From idea to posted.</p>
          </div>

          <div className="flex flex-col items-center md:items-end gap-3 text-xs text-zinc-400">
            <div className="flex space-x-6">
              <a href="#privacy" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#terms" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
            <p className="text-zinc-500">Made by a founder, for founders</p>
            <p className="text-[10px] text-zinc-650 mt-1">© Clipr 2026. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
