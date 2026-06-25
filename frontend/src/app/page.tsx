"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Clock,
  Link2Off,
  CalendarOff,
  Sparkles,
  Search,
  Check,
  Send,
  FileText,
  ArrowRight,
  X
} from "lucide-react";
import { WaitlistForm } from "@/components/WaitlistForm";
import { Marquee } from "@/components/Marquee";
import { Button } from "@/components/ui/button";
import {
  HeroDemoSlot,
} from "@/components/VisualMockups";

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);

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

  const openSignup = () => setSignupOpen(true);

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
            <Image
              src="/Clipr-logo.png"
              alt="Clipr"
              width={32}
              height={32}
              priority
              className="w-8 h-8 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.5)]"
            />
            <span className="text-xl font-bold tracking-tight text-white flex items-center">
              Clipr<span className="text-[#10B981] font-mono">.</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-zinc-400">
            <a href="#problem" className="hover:text-white transition-colors">The Problem</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => { window.location.href = "/login"; }}
              className="text-sm font-medium text-zinc-300 hover:text-white transition-colors px-2 sm:px-3 py-1.5"
            >
              Log in
            </button>
            <Button variant="primary" size="sm" onClick={openSignup} className="rounded-full">
              Get started
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
            <span>Now live</span>
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
            <Button variant="primary" size="lg" onClick={openSignup}>
              Get started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <p className="text-[10px] text-zinc-500 mt-3 tracking-wide">
              Free 5-day trial · No credit card · Cancel anytime
            </p>
          </motion.div>

          {/* Hero visual: startup demo slot */}
          <div className="pt-12 md:pt-16 w-full">
            <HeroDemoSlot />
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

      {/* 7. PRICING */}
      <section id="pricing" className="relative py-16 md:py-24 bg-zinc-950/40 border-y border-zinc-900/60 z-10">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInVariants}
            className="text-center space-y-3 mb-10"
          >
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#10B981] font-bold">Subscription</span>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white">
              Simple pricing
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto items-stretch">
            {/* Free Plan */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="relative rounded-2xl bg-zinc-950 border border-zinc-800 p-6 md:p-7 flex flex-col justify-between"
            >
              <div className="absolute -top-3 left-[50%] -translate-x-[50%] bg-zinc-800 text-zinc-300 text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-zinc-700">
                Free
              </div>

              <div className="space-y-4 pt-1">
                <div className="text-center">
                  <span className="text-zinc-500 text-xs uppercase tracking-wider block font-bold">Starter</span>
                  <div className="flex items-baseline justify-center mt-1.5">
                    <span className="text-4xl font-black text-white">$0</span>
                    <span className="text-zinc-500 text-xs ml-1">/ month</span>
                  </div>
                </div>

                <div className="border-t border-zinc-900 pt-4 space-y-2.5">
                  {[
                    "5 scripts per month",
                    "Script preview & export",
                    "Basic hook suggestions",
                  ].map((feat, idx) => (
                    <div key={idx} className="flex items-center space-x-2.5 text-zinc-300 text-xs">
                      <div className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-zinc-400" />
                      </div>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 space-y-2">
                <Button variant="outline" size="sm" className="w-full py-2.5 rounded-lg text-xs" onClick={openSignup}>
                  Start for free
                </Button>
                <p className="text-[9px] text-zinc-500 text-center tracking-wide">
                  Free forever · No credit card
                </p>
              </div>
            </motion.div>

            {/* Pro Plan */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative rounded-2xl bg-zinc-950 border-2 border-[#10B981]/50 p-6 md:p-7 shadow-[0_8px_40px_rgba(16,185,129,0.12)] flex flex-col justify-between"
            >
              <div className="absolute -top-3 left-[50%] -translate-x-[50%] bg-[#10B981] text-white text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-[0_4px_12px_rgba(16,185,129,0.35)]">
                Launch Offer
              </div>

              <div className="space-y-4 pt-1">
                <div className="text-center">
                  <span className="text-zinc-500 text-xs uppercase tracking-wider block font-bold">Full Workflow</span>
                  <div className="flex flex-col items-center mt-1.5 space-y-0.5">
                    <span className="text-base text-zinc-500 line-through font-semibold">$15</span>
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-black text-white">$7.99</span>
                      <span className="text-zinc-500 text-xs ml-1">/ month</span>
                    </div>
                    <span className="inline-block text-[9px] font-mono font-bold uppercase tracking-wider text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20 px-2 py-0.5 rounded-full mt-1">
                      Save $7.01 · Limited time
                    </span>
                  </div>
                </div>

                <div className="border-t border-zinc-900 pt-4 space-y-2.5">
                  {[
                    "Unlimited script generation",
                    "TikTok & LinkedIn auto-posting",
                    "Content calendar",
                    "Trend comment generator",
                    "Reference library",
                  ].map((feat, idx) => (
                    <div key={idx} className="flex items-center space-x-2.5 text-zinc-300 text-xs">
                      <div className="w-4 h-4 rounded-full bg-[#10B981]/10 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-[#10B981]" />
                      </div>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 space-y-2">
                <Button variant="primary" size="sm" className="w-full py-2.5 rounded-lg text-xs" onClick={openSignup}>
                  Start 5-day free trial
                </Button>
                <p className="text-[9px] text-zinc-500 text-center tracking-wide">
                  Free 5-day trial · Then $7.99/mo · Cancel anytime
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="relative border-t border-zinc-900 py-12 md:py-16 bg-zinc-950/20 backdrop-blur-sm z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
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

      {/* SIGN-UP MODAL — opened by every "Get started" CTA */}
      <AnimatePresence>
        {signupOpen && (
          <div className="fixed inset-0 z-[60] flex items-start md:items-center justify-center overflow-y-auto p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setSignupOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-[8px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative z-10 my-auto w-full max-w-md overflow-hidden rounded-3xl border border-[#10B981]/30 bg-zinc-950/95 backdrop-blur-xl p-6 sm:p-8 shadow-2xl"
              style={{ boxShadow: "0 0 40px rgba(16,185,129,0.12)" }}
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
                    className="w-7 h-7 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.5)]"
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
