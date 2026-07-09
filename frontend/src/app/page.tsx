"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Check,
  ChevronDown,
  Menu,
  X,
  Users,
  TrendingUp,
  Cpu,
  Heart,
  ShoppingBag,
  Sparkles
} from "lucide-react";


export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const faqs = [
    {
      q: "How does Clipr automate my video creation?",
      a: "Clipr integrates scripting, storyboard mapping, stock asset search (Pexels), ElevenLabs AI voiceovers, and TikTok-style bold captions into a single dashboard. Once you approve a storyboard layout, we compile it and automatically schedule/publish it to TikTok, Reels, or Shorts."
    },
    {
      q: "Can I cancel my subscription or change plans at any time?",
      a: "Yes, all plans are flexible. You can upgrade, downgrade, or cancel your subscription at any point from your dashboard settings. If you cancel, your access continues until the end of the current billing cycle."
    },
    {
      q: "How does auto-posting work for Instagram and TikTok?",
      a: "Clipr securely connects to your social platforms via standard developer APIs. When you schedule a video in your calendar, Clipr pushes it directly at the designated peak hours without requiring manual downloads or reminders."
    },
    {
      q: "Is there a money-back guarantee?",
      a: "We offer a 7-day money-back guarantee for all new subscriptions. If you are not satisfied with your rendering quota or the storyboard tool, reach out to our team for a full refund."
    }
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans antialiased relative overflow-x-hidden selection:bg-[#51E0CF] selection:text-[#0A0F0F]">
      
      {/* Background Vertical Grid Lines */}
      <div className="absolute inset-0 pointer-events-none z-0 flex justify-between max-w-[1216px] mx-auto px-4 md:px-8">
        <div className="w-[1px] h-full bg-gradient-to-b from-white/10 via-white/[0.01] to-transparent" />
        <div className="w-[1px] h-full bg-gradient-to-b from-white/10 via-white/[0.01] to-transparent hidden md:block" />
        <div className="w-[1px] h-full bg-gradient-to-b from-white/10 via-white/[0.01] to-transparent hidden md:block" />
        <div className="w-[1px] h-full bg-gradient-to-b from-white/10 via-white/[0.01] to-transparent" />
      </div>

      {/* Stars Background Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-45 z-0 bg-repeat bg-top"
        style={{ backgroundImage: `url('/images/figma/stars.svg')`, backgroundSize: '700px 486px' }}
      />

      {/* Header / Navigation */}
      <header className="sticky top-0 z-50 w-full bg-[#050505]/70 backdrop-blur-md border-b border-white/[0.06] transition-all">
        <div className="max-w-[1216px] mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2.5 relative z-10">
            <Image 
              src="/Clipr-logo.png" 
              alt="Clipr Logo" 
              width={32} 
              height={32} 
              className="w-8 h-8 rounded-lg shadow-[0_0_15px_rgba(81,224,207,0.4)]" 
            />
            <span className="text-xl font-bold tracking-tight text-white flex items-center font-display">
              Clipr<span className="text-[#51E0CF] font-mono">.</span>
            </span>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 bg-white/[0.02] border border-white/[0.08] px-6 py-2 rounded-full backdrop-blur-md">
            <a href="#about" className="text-sm font-medium text-white/70 hover:text-white transition-colors">About</a>
            <a href="#integrations" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Integrations</a>
            <a href="#pricing" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Pricing</a>
          </nav>

          {/* Desktop Right Action */}
          <div className="hidden md:flex items-center gap-6">
            <a 
              href="/login" 
              className="text-sm font-medium text-white/70 hover:text-white transition-colors"
            >
              Log in
            </a>
            <a 
              href="/signup"
              className="px-6 py-2.5 text-sm font-medium bg-[#51E0CF] text-[#0A0F0F] rounded-full hover:bg-[#43cdbd] hover:scale-105 transition-all duration-250 shadow-[0_0_20px_rgba(81,224,207,0.2)] font-display"
            >
              Get started
            </a>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2 text-white hover:text-[#51E0CF] transition-colors relative z-10"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="absolute top-20 left-0 w-full bg-[#050505]/95 border-b border-white/[0.08] px-6 py-8 flex flex-col gap-6 md:hidden z-40 backdrop-blur-xl"
            >
              <a 
                href="#about" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-medium text-white/80 hover:text-white transition-colors"
              >
                About
              </a>
              <a 
                href="#integrations" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-medium text-white/80 hover:text-white transition-colors"
              >
                Integrations
              </a>
              <a 
                href="#pricing" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-medium text-white/80 hover:text-white transition-colors"
              >
                Pricing
              </a>
              <div className="w-full flex flex-col gap-4 border-t border-white/10 pt-4">
                <a 
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-3 bg-white/[0.04] border border-white/[0.1] text-white text-center font-semibold rounded-full text-sm"
                >
                  Log in
                </a>
                <a 
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-3 bg-[#51E0CF] text-[#0A0F0F] text-center font-semibold rounded-full text-sm"
                >
                  Get started
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero Section */}
      <section id="about" className="relative z-10 pt-16 md:pt-28 pb-20 max-w-[1216px] mx-auto px-4 md:px-8 flex flex-col items-center">
        {/* Soft Radial Glow Top */}
        <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#51E0CF]/5 blur-[120px] rounded-full pointer-events-none" />

        {/* Product Overview Badge */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] shadow-[inset_0px_2px_12px_rgba(255,255,255,0.04)] px-4 py-1.5 rounded-full backdrop-blur-md mb-8 hover:border-white/10 transition-colors"
        >
          <Image 
            src="/images/figma/benefit-icon-01.svg" 
            alt="Badge icon" 
            width={20} 
            height={20} 
            className="w-5 h-5 opacity-90"
          />
          <span className="text-xs md:text-sm font-medium text-white/80 tracking-wide">Clipr Product Overview</span>
        </motion.div>

        {/* Main Hero Header */}
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl md:text-7xl font-bold font-display text-center leading-[1.1] max-w-[900px] mb-6 tracking-tight bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent"
        >
          Your Entire Video Content Team. Minus the Team.
        </motion.h1>

        {/* Subtitle description */}
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-base md:text-xl text-white/70 text-center max-w-[620px] leading-relaxed mb-10 font-sans"
        >
          Clipr turns your ideas into ready-to-post Reels, Shorts, and TikToks. Scripting, storyboards, voiceovers, and auto-publishing—all in one seamless flow.
        </motion.p>

        {/* Action Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-12"
        >
          <a 
            href="/signup"
            className="px-8 py-4 font-display font-semibold bg-[#51E0CF] text-[#0A0F0F] rounded-full hover:bg-[#43cdbd] hover:scale-105 transition-all duration-300 shadow-[0_0_30px_rgba(81,224,207,0.3)] text-base"
          >
            Get started for free
          </a>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20 text-center border-b border-white/[0.08] pb-16 w-full max-w-[900px]">
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.08] mb-4 text-[#51E0CF]">
              <Users size={24} />
            </div>
            <h3 className="text-4xl md:text-5xl font-bold font-display bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent mb-2">48M+</h3>
            <p className="text-sm text-white/50 font-sans max-w-[200px]">
              Total video impressions generated.
            </p>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.08] mb-4 text-[#51E0CF]">
              <TrendingUp size={24} />
            </div>
            <h3 className="text-4xl md:text-5xl font-bold font-display bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent mb-2">95%</h3>
            <p className="text-sm text-white/50 font-sans max-w-[200px]">
              Auto-posting scheduling success rate.
            </p>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.08] mb-4 text-[#51E0CF]">
              <Cpu size={24} />
            </div>
            <h3 className="text-4xl md:text-5xl font-bold font-display bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent mb-2">22K+</h3>
            <p className="text-sm text-white/50 font-sans max-w-[200px]">
              Videos rendered this month.
            </p>
          </div>
        </div>

        {/* Showcase Infinite Carousel of Compiled Short Videos */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="w-full mt-12 relative overflow-hidden"
        >
          <div className="text-center mb-8">
            <h3 className="text-xl md:text-2xl font-bold font-display text-white mb-2">
              Videos Created with Clipr
            </h3>
            <p className="text-sm text-white/50 font-sans max-w-[500px] mx-auto">
              Browse through the completed video designs, custom captions, and visual assets compiled by the AI editor.
            </p>
          </div>

          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .animate-marquee-infinite {
              display: flex;
              width: max-content;
              animation: marquee 35s linear infinite;
            }
            .animate-marquee-infinite:hover {
              animation-play-state: paused;
            }
          `}} />

          {/* Carousel Wrapper */}
          <div className="relative w-full overflow-hidden py-4">
            {/* Scroll Container */}
            <div className="animate-marquee-infinite gap-6 px-4">
              {[
                "/result/result_growth_hook.mp4",
                "/result/result_blueprint.mp4",
                "/result/result_dev_loop.mp4",
                "/result/result_solo_build.mp4",
                "/result/result_creator_1.mp4",
                "/result/result_creator_2.mp4",
                // Duplicated for seamless loop
                "/result/result_growth_hook.mp4",
                "/result/result_blueprint.mp4",
                "/result/result_dev_loop.mp4",
                "/result/result_solo_build.mp4",
                "/result/result_creator_1.mp4",
                "/result/result_creator_2.mp4"
              ].map((src, idx) => (
                <div 
                  key={idx}
                  className="shrink-0 w-[200px] md:w-[240px] group relative bg-[#050505]/40 border border-white/[0.06] rounded-[24px] overflow-hidden p-2 shadow-2xl hover:border-[#51E0CF]/40 hover:scale-[1.015] transition-all duration-300 backdrop-blur-md"
                >
                  <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-[#0A0A0A]">
                    <video 
                      src={src}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover filter brightness-[0.9] group-hover:brightness-100 transition-all duration-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Logos (Trust) Section */}
      <section className="relative z-10 border-t border-white/[0.06] bg-gradient-to-b from-transparent to-white/[0.01] py-16">
        <div className="max-w-[1216px] mx-auto px-4 md:px-8 text-center">
          <p className="font-display text-lg font-bold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent mb-10 tracking-wide uppercase">
            The world&apos;s best creators trust Clipr.
          </p>

          {/* Marquee/Flex container of logos */}
          <div className="flex flex-wrap items-center justify-center gap-12 md:gap-20 opacity-40 hover:opacity-60 transition-opacity duration-300 mb-8 px-4">
            <Image src="/images/figma/company-logo-02.svg" alt="Company Logo" width={118} height={30} className="h-7 w-auto filter invert" />
            <Image src="/images/figma/company-logo-03.svg" alt="Company Logo" width={83} height={30} className="h-7 w-auto filter invert" />
            <Image src="/images/figma/company-logo-04.svg" alt="Company Logo" width={88} height={30} className="h-7 w-auto filter invert" />
            <Image src="/images/figma/company-logo-05.svg" alt="Company Logo" width={87} height={30} className="h-7 w-auto filter invert" />
            <Image src="/images/figma/company-logo-06.svg" alt="Company Logo" width={82} height={30} className="h-7 w-auto filter invert" />
          </div>

          <p className="text-sm text-white/50 font-sans tracking-wide">
            Trusted by leading companies from around the globe.
          </p>
        </div>
      </section>

      {/* Features/Benefits Section */}
      <section id="integrations" className="relative z-10 py-24 border-t border-white/[0.06] max-w-[1216px] mx-auto px-4 md:px-8">
        
        {/* Header grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-end mb-20">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] shadow-[inset_0px_2px_12px_rgba(255,255,255,0.04)] px-4 py-1.5 rounded-full backdrop-blur-md mb-6">
              <Image src="/images/figma/benefit-icon-01.svg" alt="Badge icon" width={20} height={20} className="w-5 h-5 opacity-90" />
              <span className="text-xs md:text-sm font-medium text-white/80">Clipr Product Overview</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold font-display leading-tight tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Discover a simple<br />video production workflow today.
            </h2>
          </div>
          <div>
            <p className="text-base md:text-lg text-white/70 leading-relaxed font-sans max-w-[450px] lg:ml-auto">
              Clipr connects script generation, visual storyboards, and publishing templates so you don&apos;t need to jump between editors.
            </p>
          </div>
        </div>

        {/* Benefits Cards Grid */}
        <div className="grid grid-cols-1 gap-8">
          
          {/* Card 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8 md:p-12 bg-white/[0.01] border border-white/[0.06] rounded-[24px] hover:border-white/10 hover:bg-white/[0.02] transition-all duration-300">
            <div className="flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-8">
                <Image src="/images/figma/benefit-icon-01.svg" alt="Benefit Icon" width={56} height={58} className="w-14 h-14" />
                <span className="text-3xl font-semibold text-white/15">01</span>
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-bold font-display mb-4 bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                  Express ideas like a storyteller, not a machine.
                </h3>
                <p className="text-sm md:text-base text-white/60 leading-relaxed font-sans">
                  Turn basic text prompts into compelling video storyboards with precise audio cues, voiceover pacing, and visual tags.
                </p>
              </div>
            </div>
            <div className="relative rounded-xl border border-white/[0.08] overflow-hidden bg-[#050505]/80 p-2 shadow-2xl mt-8 lg:mt-0">
              <video 
                src="/123/1.mp4" 
                autoPlay 
                muted 
                loop 
                playsInline
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>

          {/* Card 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8 md:p-12 bg-white/[0.01] border border-white/[0.06] rounded-[24px] hover:border-white/10 hover:bg-white/[0.02] transition-all duration-300">
            <div className="flex flex-col justify-between h-full lg:order-2">
              <div className="flex items-center justify-between mb-8">
                <Image src="/images/figma/benefit-icon-02.png" alt="Benefit Icon" width={56} height={58} className="w-14 h-14" />
                <span className="text-3xl font-semibold text-white/15">02</span>
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-bold font-display mb-4 bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                  Build your sequence scene by scene.
                </h3>
                <p className="text-sm md:text-base text-white/60 leading-relaxed font-sans">
                  Manage b-rolls, visual assets, ElevenLabs voices, and captions block by block with our intuitive visual timeline editor.
                </p>
              </div>
            </div>
            <div className="relative rounded-xl border border-white/[0.08] overflow-hidden bg-[#050505]/80 p-2 shadow-2xl mt-8 lg:mt-0 lg:order-1">
              <video 
                src="/123/2.mp4" 
                autoPlay 
                muted 
                loop 
                playsInline
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>

          {/* Card 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8 md:p-12 bg-white/[0.01] border border-white/[0.06] rounded-[24px] hover:border-white/10 hover:bg-white/[0.02] transition-all duration-300">
            <div className="flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-8">
                <Image src="/images/figma/benefit-icon-03.svg" alt="Benefit Icon" width={56} height={58} className="w-14 h-14" />
                <span className="text-3xl font-semibold text-white/15">03</span>
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-bold font-display mb-4 bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                  Scale publishing without publishing stress.
                </h3>
                <p className="text-sm md:text-base text-white/60 leading-relaxed font-sans">
                  Connect your Instagram, TikTok, and YouTube channels to schedule and auto-post directly from your calendar dashboard.
                </p>
              </div>
            </div>
            <div className="relative rounded-xl border border-white/[0.08] overflow-hidden bg-[#050505]/80 p-2 shadow-2xl mt-8 lg:mt-0">
              <video 
                src="/123/3.mp4" 
                autoPlay 
                muted 
                loop 
                playsInline
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>

        </div>
      </section>

      {/* Sub-features Grid Section */}
      <section className="relative z-10 py-24 border-t border-white/[0.06] max-w-[1216px] mx-auto px-4 md:px-8">
        
        {/* Title */}
        <div className="flex flex-col items-center text-center mb-20">
          <div className="inline-flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] shadow-[inset_0px_2px_12px_rgba(255,255,255,0.04)] px-4 py-1.5 rounded-full backdrop-blur-md mb-6">
            <Image src="/images/figma/benefit-icon-01.svg" alt="Badge icon" width={20} height={20} className="w-5 h-5 opacity-90" />
            <span className="text-xs md:text-sm font-medium text-white/80">Clipr Product Overview</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold font-display tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent leading-[1.2] max-w-[800px]">
            Build a video presence that wins you more followers.
          </h2>
        </div>

        {/* 6 Grid items */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* Item 1 */}
          <div className="p-8 bg-white/[0.01] border border-white/[0.06] rounded-2xl hover:border-white/10 hover:bg-white/[0.02] hover:-translate-y-1 transition-all duration-300 backdrop-blur-md">
            <Image src="/images/figma/feature-icon-01.svg" alt="Feature Icon" width={48} height={48} className="w-12 h-12 mb-6" />
            <h4 className="text-xl font-bold font-display text-white mb-3">Smart Storyboarding</h4>
            <p className="text-sm text-white/50 leading-relaxed font-sans mb-4">
              AI-driven layout structures mapping scenes, visual cues, voiceovers, and transitions.
            </p>
            <p className="text-xs text-white/40 font-sans">
              Instant generation based on text prompts.
            </p>
          </div>

          {/* Item 2 */}
          <div className="p-8 bg-white/[0.01] border border-white/[0.06] rounded-2xl hover:border-white/10 hover:bg-white/[0.02] hover:-translate-y-1 transition-all duration-300 backdrop-blur-md">
            <Image src="/images/figma/feature-icon-02.svg" alt="Feature Icon" width={48} height={48} className="w-12 h-12 mb-6" />
            <h4 className="text-xl font-bold font-display text-white mb-3">Easy Voiceover Sync</h4>
            <p className="text-sm text-white/50 leading-relaxed font-sans mb-4">
              One-click synthetic voice generation integrated with ElevenLabs premium voices.
            </p>
            <p className="text-xs text-white/40 font-sans">
              Perfect timing sync with visual clips.
            </p>
          </div>

          {/* Item 3 */}
          <div className="p-8 bg-white/[0.01] border border-white/[0.06] rounded-2xl hover:border-white/10 hover:bg-white/[0.02] hover:-translate-y-1 transition-all duration-300 backdrop-blur-md">
            <Image src="/images/figma/feature-icon-03.svg" alt="Feature Icon" width={48} height={48} className="w-12 h-12 mb-6" />
            <h4 className="text-xl font-bold font-display text-white mb-3">Social Auto-Posting</h4>
            <p className="text-sm text-white/50 leading-relaxed font-sans mb-4">
              Connect and automatically schedule posting to TikTok, Reels, Shorts, X, & LinkedIn.
            </p>
            <p className="text-xs text-white/40 font-sans">
              Published directly at peak audience hours.
            </p>
          </div>

          {/* Item 4 */}
          <div className="p-8 bg-white/[0.01] border border-white/[0.06] rounded-2xl hover:border-white/10 hover:bg-white/[0.02] hover:-translate-y-1 transition-all duration-300 backdrop-blur-md">
            <Image src="/images/figma/feature-icon-04.svg" alt="Feature Icon" width={48} height={48} className="w-12 h-12 mb-6" />
            <h4 className="text-xl font-bold font-display text-white mb-3">Tailored Templates</h4>
            <p className="text-sm text-white/50 leading-relaxed font-sans mb-4">
              Modern bold typography preset styles for caption overlays designed to hold attention.
            </p>
            <p className="text-xs text-white/40 font-sans">
              Matches viral formats in one click.
            </p>
          </div>

          {/* Item 5 */}
          <div className="p-8 bg-white/[0.01] border border-white/[0.06] rounded-2xl hover:border-white/10 hover:bg-white/[0.02] hover:-translate-y-1 transition-all duration-300 backdrop-blur-md">
            <Image src="/images/figma/feature-icon-05.svg" alt="Feature Icon" width={48} height={48} className="w-12 h-12 mb-6" />
            <h4 className="text-xl font-bold font-display text-white mb-3">B-Roll Library</h4>
            <p className="text-sm text-white/50 leading-relaxed font-sans mb-4">
              Seamless search and search filter integration of high-quality stock b-roll visual media.
            </p>
            <p className="text-xs text-white/40 font-sans">
              Quick replacement with custom uploads.
            </p>
          </div>

          {/* Item 6 */}
          <div className="p-8 bg-white/[0.01] border border-white/[0.06] rounded-2xl hover:border-white/10 hover:bg-white/[0.02] hover:-translate-y-1 transition-all duration-300 backdrop-blur-md">
            <Image src="/images/figma/feature-icon-06.svg" alt="Feature Icon" width={48} height={48} className="w-12 h-12 mb-6" />
            <h4 className="text-xl font-bold font-display text-white mb-3">Content Calendar</h4>
            <p className="text-sm text-white/50 leading-relaxed font-sans mb-4">
              Visual drag-and-drop dashboard to organize your weekly publish schedule and queue.
            </p>
            <p className="text-xs text-white/40 font-sans">
              Tracks script templates and post status.
            </p>
          </div>

        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 py-24 border-t border-white/[0.06] max-w-[1216px] mx-auto px-4 md:px-8 flex flex-col items-center">
        
        {/* Soft Glow */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#51E0CF]/5 blur-[120px] rounded-full pointer-events-none" />

        {/* Pricing Header */}
        <div className="flex flex-col items-center text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] shadow-[inset_0px_2px_12px_rgba(255,255,255,0.04)] px-4 py-1.5 rounded-full backdrop-blur-md mb-6">
            <Image src="/images/figma/benefit-icon-01.svg" alt="Badge icon" width={20} height={20} className="w-5 h-5 opacity-90" />
            <span className="text-xs md:text-sm font-medium text-white/80">Simple Pricing System</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold font-display tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent mb-4 leading-tight">
            Our Plans Scale With Your Business
          </h2>
          <p className="text-sm md:text-base text-white/60 leading-relaxed font-sans max-w-[450px]">
            Choose the billing period that fits your content schedule. Cancel or upgrade anytime.
          </p>
        </div>
        {/* Promo Badge */}
        <div className="bg-[#51E0CF]/10 border border-[#51E0CF]/30 px-4 py-1.5 rounded-full text-[11px] text-[#51E0CF] font-mono tracking-wider font-semibold mb-16 max-w-fit">
          Save up to 20% on multi-month plans
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full items-stretch">
          
          {/* Plan 1: Free */}
          <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/[0.06] backdrop-blur-md flex flex-col justify-between hover:border-white/10 transition-all duration-300">
            <div className="space-y-6">
              <div className="flex items-center gap-2.5 bg-white/[0.02] border border-white/[0.08] px-3.5 py-1.5 rounded-full w-fit">
                <Heart className="w-4 h-4 text-[#51E0CF]" />
                <span className="text-xs font-semibold text-white">Free Tier</span>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold font-display bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">$0</span>
                  <span className="text-xs text-white/50 font-sans">/ month</span>
                </div>
                <p className="text-[10px] text-white/40 mt-1 font-sans">Always free</p>
              </div>
              <div className="w-full h-[1px] bg-white/[0.08]" />
              <ul className="space-y-3.5 text-xs text-white/70">
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>5 videos</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>3 storyboard regens</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>2 AI voiceovers</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>Stock clips</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>Basic captions</span>
                </li>
              </ul>
            </div>
            <a 
              href="/signup?plan=free"
              className="mt-8 w-full py-3 text-xs font-semibold font-display bg-white/[0.04] border border-white/[0.1] text-white rounded-full hover:bg-white/[0.08] transition-all text-center block"
            >
              Get Started Free
            </a>
          </div>

          {/* Plan 2: 1-Month Pro */}
          <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/[0.06] backdrop-blur-md flex flex-col justify-between hover:border-white/10 transition-all duration-300">
            <div className="space-y-6">
              <div className="flex items-center gap-2.5 bg-white/[0.02] border border-white/[0.08] px-3.5 py-1.5 rounded-full w-fit">
                <ShoppingBag className="w-4 h-4 text-white/60" />
                <span className="text-xs font-semibold text-white">1-Month Pro</span>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold font-display bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">$5</span>
                  <span className="text-xs text-white/50 font-sans">/ month</span>
                </div>
                <p className="text-[10px] text-white/40 mt-1 font-sans">Billed monthly</p>
              </div>
              <div className="w-full h-[1px] bg-white/[0.08]" />
              <ul className="space-y-3.5 text-xs text-white/70">
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>10 videos</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>10 storyboard regens</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>10 AI voiceovers</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>Premium voices & templates</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>Auto-posting</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>Pay-as-you-go</span>
                </li>
              </ul>
            </div>
            <a 
              href="/signup?plan=1_month_pro"
              className="mt-8 w-full py-3 text-xs font-semibold font-display bg-white/[0.04] border border-white/[0.1] text-white rounded-full hover:bg-white/[0.08] transition-all text-center block"
            >
              Upgrade to Pro
            </a>
          </div>

          {/* Plan 3: 3-Month Pro (Most Popular) */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border-2 border-[#51E0CF] backdrop-blur-md flex flex-col justify-between shadow-[0_0_30px_rgba(81,224,207,0.12)] relative group transform md:-translate-y-2 transition-all duration-300">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#51E0CF] text-[#0A0F0F] text-[9px] font-mono font-bold uppercase tracking-wider px-4 py-1 rounded-full shadow-[0_4px_12px_rgba(81,224,207,0.25)] whitespace-nowrap">
              Most Popular (Save 20% · 3-Day Free Trial)
            </div>
            
            <div className="space-y-6 mt-2">
              <div className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.1] px-3.5 py-1.5 rounded-full w-fit">
                <Sparkles className="w-4 h-4 text-[#51E0CF]" />
                <span className="text-xs font-semibold text-white">3-Month Pro</span>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg text-white/40 line-through font-display font-medium mr-1.5">
                    $15
                  </span>
                  <span className="text-4xl font-bold font-display bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                    $11.99
                  </span>
                  <span className="text-xs text-white/50 font-sans">
                    / 3 months
                  </span>
                </div>
                <p className="text-[10px] text-[#51E0CF] mt-1 font-sans font-medium">
                  Billed every 3 months (2 Months + 1 Month Gift)
                </p>
              </div>
              <div className="w-full h-[1px] bg-white/[0.08]" />
              <ul className="space-y-3.5 text-xs text-white/80">
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>20 videos</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span className="font-semibold text-white">Unlimited storyboard regens</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span className="font-semibold text-white">Unlimited ElevenLabs voiceovers</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>Premium templates</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>Auto-posting</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span className="text-[#51E0CF] font-medium">Viral hook scriptwriting</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span className="font-semibold text-white">3-day free trial</span>
                </li>
              </ul>
            </div>
            <a 
              href="/signup?plan=3_months_pro"
              className="mt-8 w-full py-3.5 text-xs font-semibold font-display bg-[#51E0CF] text-[#0A0F0F] rounded-full hover:bg-[#43cdbd] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 shadow-[0_0_20px_rgba(81,224,207,0.2)] text-center block"
            >
              Start 3-Day Free Trial
            </a>
          </div>

          {/* Plan 4: 6-Month Pro */}
          <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/[0.06] backdrop-blur-md flex flex-col justify-between hover:border-white/10 transition-all duration-300 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[9px] font-mono font-bold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-[0_4px_12px_rgba(99,102,241,0.25)] whitespace-nowrap">
              Best Value (Save 16%)
            </div>
            
            <div className="space-y-6 mt-2">
              <div className="flex items-center gap-2.5 bg-white/[0.02] border border-white/[0.08] px-3.5 py-1.5 rounded-full w-fit">
                <ShoppingBag className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-white">6-Month Pro</span>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg text-white/40 line-through font-display font-medium mr-1.5">
                    $30
                  </span>
                  <span className="text-4xl font-bold font-display bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                    $25
                  </span>
                  <span className="text-xs text-white/50 font-sans">
                    / 6 months
                  </span>
                </div>
                <p className="text-[10px] text-white/40 mt-1 font-sans">
                  Billed every 6 months
                </p>
              </div>
              <div className="w-full h-[1px] bg-white/[0.08]" />
              <ul className="space-y-3.5 text-xs text-white/70">
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>50 videos</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>Unlimited storyboard regens</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>Unlimited voiceovers</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>Premium templates</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span>Auto-posting</span>
                </li>
                <li className="flex items-start gap-2.5 leading-snug">
                  <Check className="w-4 h-4 text-[#51E0CF] shrink-0 mt-0.5" />
                  <span className="font-semibold text-indigo-400">Priority render queue</span>
                </li>
              </ul>
            </div>
            <a 
              href="/signup?plan=6_months_pro"
              className="mt-8 w-full py-3 text-xs font-semibold font-display bg-white/[0.04] border border-white/[0.1] text-white rounded-full hover:bg-white/[0.08] transition-all text-center block"
            >
              Upgrade to Pro
            </a>
          </div>

        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative z-10 py-24 border-t border-white/[0.06] max-w-[1216px] mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Accordions */}
          <div className="lg:col-span-6 flex flex-col justify-between">
            <div className="mb-10 lg:mb-0">
              <div className="inline-flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] shadow-[inset_0px_2px_12px_rgba(255,255,255,0.04)] px-4 py-1.5 rounded-full backdrop-blur-md mb-6">
                <Image src="/images/figma/benefit-icon-01.svg" alt="Badge icon" width={20} height={20} className="w-5 h-5 opacity-90" />
                <span className="text-xs md:text-sm font-medium text-white/80">Clipr Product Overview</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold font-display tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent mb-4 leading-tight">
                Frequently asked questions
              </h2>
              <p className="text-sm md:text-base text-white/60 leading-relaxed font-sans max-w-[450px] mb-8">
                For any other questions, feel welcome to reach out to our team.
              </p>
            </div>

            {/* Accordions */}
            <div className="flex flex-col border-t border-white/[0.08]">
              {faqs.map((faq, index) => (
                <div key={index} className="border-b border-white/[0.08] py-4">
                  <button 
                    onClick={() => toggleFaq(index)}
                    className="w-full flex items-center justify-between text-left py-2 text-white/80 hover:text-white transition-colors group"
                  >
                    <span className="font-semibold text-base md:text-lg font-sans leading-relaxed group-hover:translate-x-0.5 transition-transform">
                      {faq.q}
                    </span>
                    <ChevronDown 
                      size={20} 
                      className={`text-white/40 group-hover:text-white transition-all duration-300 ${openFaqIndex === index ? 'rotate-180 text-[#51E0CF]' : ''}`} 
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaqIndex === index && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <p className="text-sm md:text-base text-white/50 leading-relaxed pt-2 pb-4 font-sans max-w-[500px]">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>

          {/* Right Image/Illustration */}
          <div className="lg:col-span-6 flex items-center justify-center lg:justify-end">
            <div className="relative w-full max-w-[550px] rounded-2xl border border-white/[0.08] bg-[#050505] p-3 shadow-2xl overflow-hidden group">
              <div className="absolute inset-0 border border-white/[0.06] rounded-2xl pointer-events-none group-hover:border-white/10 transition-colors" />
              <Image 
                src="/images/figma/faq-illustration.png" 
                alt="FAQ Illustration" 
                width={658} 
                height={670} 
                layout="responsive"
                className="rounded-xl brightness-[0.95] group-hover:scale-[1.01] transition-transform duration-500"
              />
            </div>
          </div>

        </div>
      </section>


      {/* CTA / Trial Section */}
      <section className="relative z-10 py-24 border-t border-white/[0.06] max-w-[1216px] mx-auto px-4 md:px-8">
        
        {/* Soft Glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#51E0CF]/[0.02] to-transparent pointer-events-none" />

        <div className="relative bg-white/[0.01] border border-white/[0.06] rounded-[32px] p-8 md:p-16 flex flex-col lg:flex-row items-center justify-between gap-12 overflow-hidden shadow-2xl backdrop-blur-md">
          
          {/* Inner details */}
          <div className="max-w-[500px]">
            <h2 className="text-3xl md:text-5xl font-bold font-display tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent mb-6 leading-tight">
              Start Your<br />3-day free trial
            </h2>
            <div className="flex flex-col sm:flex-row gap-6 text-white/60">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#51E0CF]/10 text-[#51E0CF]">
                  <Check size={12} />
                </div>
                <span className="text-sm font-sans">Free 3-day trial</span>
              </div>
            </div>
          </div>

          {/* Action button & side illustration */}
          <div className="flex flex-col sm:flex-row items-center gap-8 relative">
            <div className="absolute -left-12 -top-12 w-24 h-24 bg-[#51E0CF]/10 blur-xl rounded-full pointer-events-none" />
            
            <Image 
              src="/images/figma/cta-icon.png" 
              alt="CTA Illustration Icon" 
              width={80} 
              height={80} 
              className="w-20 h-20 filter drop-shadow-[0_0_15px_rgba(81,224,207,0.2)] animate-bounce"
              style={{ animationDuration: '4s' }}
            />

            <a 
              href="/signup?plan=general_trial"
              className="px-8 py-4 font-display font-semibold bg-[#51E0CF] text-[#0A0F0F] rounded-full hover:bg-[#43cdbd] hover:scale-105 transition-all duration-300 shadow-[0_0_30px_rgba(81,224,207,0.3)] text-base text-center block"
            >
              Get started
            </a>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-black/40 py-16">
        <div className="max-w-[1216px] mx-auto px-4 md:px-8">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            
            {/* Logo and brief info */}
            <div className="flex flex-col gap-6">
              <a href="#" className="flex items-center gap-2.5">
                <Image src="/Clipr-logo.png" alt="Clipr Logo" width={32} height={32} className="w-8 h-8 rounded-lg" />
                <span className="text-xl font-bold tracking-tight text-white flex items-center font-display">
                  Clipr<span className="text-[#51E0CF] font-mono">.</span>
                </span>
              </a>
              <p className="text-sm text-white/50 leading-relaxed font-sans max-w-[240px]">
                Clipr turns ideas into ready-to-post vertical video blueprints automatically.
              </p>
              <div className="inline-flex items-center bg-white/[0.04] border border-white/[0.1] px-4 py-2 rounded-full backdrop-blur-md text-sm text-white/70 max-w-fit font-mono">
                Early Access Edition
              </div>
            </div>

            {/* Links Columns */}
            <div>
              <h5 className="font-display font-bold text-sm text-white/40 tracking-wider uppercase mb-6">Product</h5>
              <ul className="flex flex-col gap-4 text-sm font-medium text-white/80">
                <li><a href="#about" className="hover:text-[#51E0CF] transition-colors">Clipr Features</a></li>
                <li><a href="#pricing" className="hover:text-[#51E0CF] transition-colors">Pricing Plans</a></li>
                <li><a href="#integrations" className="hover:text-[#51E0CF] transition-colors">Integrations</a></li>
              </ul>
            </div>

            <div>
              <h5 className="font-display font-bold text-sm text-white/40 tracking-wider uppercase mb-6">Features</h5>
              <ul className="flex flex-col gap-4 text-sm font-medium text-white/80">
                <li><a href="#about" className="hover:text-[#51E0CF] transition-colors">Storyboarding</a></li>
                <li><a href="#about" className="hover:text-[#51E0CF] transition-colors">AI Voiceovers</a></li>
                <li><a href="#about" className="hover:text-[#51E0CF] transition-colors">Calendar Schedule</a></li>
              </ul>
            </div>

            <div>
              <h5 className="font-display font-bold text-sm text-white/40 tracking-wider uppercase mb-6">Resources</h5>
              <ul className="flex flex-col gap-4 text-sm font-medium text-white/80">
                <li><a href="#" className="hover:text-[#51E0CF] transition-colors">Changelog</a></li>
                <li><a href="#" className="hover:text-[#51E0CF] transition-colors">Licence</a></li>
              </ul>
            </div>

          </div>

          {/* Copyright bar */}
          <div className="border-t border-white/[0.08] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40 font-sans">
            <span>Copyright ©2026 Clipr. All rights reserved.</span>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <div className="w-[1px] h-3 bg-white/20" />
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
