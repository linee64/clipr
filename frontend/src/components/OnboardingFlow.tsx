"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Sparkles,
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Briefcase,
  Users,
  MessageSquare,
  User
} from "lucide-react";

interface OnboardingFlowProps {
  onComplete: (data: {
    name: string;
    product: string;
    audience: string;
    tone: "formal" | "casual";
    samplePost: string;
    platform: "TikTok" | "Instagram Reels" | "LinkedIn" | "YouTube Shorts" | "Twitter / X";
  }) => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const tone = "casual";
  const samplePost = "";
  const [platform, setPlatform] = useState<"TikTok" | "Instagram Reels" | "LinkedIn" | "YouTube Shorts" | "Twitter / X">("TikTok");
  
  // Loading state when generating DNA
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);

  const stepsData = [
    { title: "Your Name", desc: "How we address you" },
    { title: "Product / Idea", desc: "Tell us about yourself (optional)" },
    { title: "Audience", desc: "Who is the content for (optional)" },
    { title: "Platform", desc: "Where you publish" },
  ];

  const handleNext = () => {
    if (step === 2 && !product.trim()) {
      setProduct("AI-powered content workflow tool for founders and creators");
    }
    if (step === 3 && !audience.trim()) {
      setAudience("Startup Founders");
    }

    if (step < 4) {
      setStep(step + 1);
    } else {
      triggerGeneration();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const triggerGeneration = () => {
    setIsGenerating(true);
    
    // Simulate steps of DNA generation
    const intervals = [800, 1600, 2400, 3200];
    intervals.forEach((time, index) => {
      setTimeout(() => {
        setGenerationStep(index + 1);
        if (index === intervals.length - 1) {
          setTimeout(() => {
            onComplete({
              name: name.trim(),
              product: product.trim() || "AI-powered content workflow tool for founders and creators",
              audience: audience.trim() || "Startup Founders",
              tone,
              samplePost,
              platform,
            });
          }, 600);
        }
      }, time);
    });
  };

  const getPlatformIcon = (plat: string) => {
    switch (plat) {
      case "LinkedIn":
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="#0A66C2"/>
            <path d="M7.5 9.5V17H5V9.5H7.5ZM6.25 8.5C5.56 8.5 5 7.94 5 7.25C5 6.56 5.56 6 6.25 6C6.94 6 7.5 6.56 7.5 7.25C7.5 7.94 6.94 8.5 6.25 8.5ZM19 17H16.5V13.25C16.5 12.19 15.56 11.5 14.75 11.5C13.94 11.5 13.25 12.19 13.25 13V17H10.75V9.5H13.25V10.69C13.69 10.06 14.56 9.5 15.5 9.5C17.16 9.5 19 10.56 19 13.25V17Z" fill="white"/>
          </svg>
        );
      case "Instagram Reels":
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id="ig-grad-onb" x1="0" y1="24" x2="24" y2="0">
                <stop offset="0%" stopColor="#FFDC80"/>
                <stop offset="25%" stopColor="#F77737"/>
                <stop offset="50%" stopColor="#E1306C"/>
                <stop offset="75%" stopColor="#C13584"/>
                <stop offset="100%" stopColor="#833AB4"/>
              </linearGradient>
            </defs>
            <rect width="24" height="24" rx="6" fill="url(#ig-grad-onb)"/>
            <rect x="4" y="4" width="16" height="16" rx="4.5" stroke="white" strokeWidth="2" fill="none"/>
            <circle cx="12" cy="12" r="3.5" stroke="white" strokeWidth="2" fill="none"/>
            <circle cx="17.5" cy="6.5" r="1.25" fill="white"/>
          </svg>
        );
      case "Twitter / X":
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        );
      case "TikTok":
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="#010101"/>
            <path d="M16.5 4.5C16.5 4.5 16.5 8.5 20 8.5V11C20 11 17.5 11.2 16.5 9.5V15.5C16.5 18.5 14.5 20.5 11.5 20.5C8.5 20.5 6 18.5 6 15.5C6 12.5 8.5 10.5 11 10.5V13.5C9.5 13.5 9 14.5 9 15.5C9 16.5 9.5 17.5 11.5 17.5C13.5 17.5 13.5 16 13.5 15.5V4.5H16.5Z" fill="white"/>
            <path d="M16.5 4.5C16.5 4.5 16.5 8.5 20 8.5V11C20 11 17.5 11.2 16.5 9.5V15.5" stroke="#25F4EE" strokeWidth="0.7" fill="none"/>
            <path d="M13.5 15.5V4.5H16.5" stroke="#FE2C55" strokeWidth="0.7" fill="none"/>
          </svg>
        );
      case "YouTube Shorts":
      default:
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="#FF0000"/>
            <path d="M10 9v6l5-3-5-3z" fill="white"/>
          </svg>
        );
    }
  };

  const isNextDisabled = () => {
    if (step === 1 && !name.trim()) return true;
    return false;
  };

  const stepsTransitions = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
  };

  if (isGenerating) {
    const messages = [
      "Analyzing product and UGC niche...",
      "Profiling target audience...",
      "Analyzing voice tone and style patterns...",
      "Configuring Clipr DNA...",
    ];

    return (
      <div className="fixed inset-0 z-50 bg-[#070B0D] flex flex-col items-center justify-center overflow-y-auto p-6 py-10 select-none">
        <div className="absolute top-[30%] left-[50%] -translate-x-[50%] w-[300px] h-[300px] bg-[#10B981] rounded-full blur-[120px] opacity-[0.2] animate-pulse pointer-events-none" />
        
        <div className="relative z-10 max-w-md w-full text-center space-y-8">
          <div className="w-20 h-20 rounded-2xl bg-[#0D1416] border border-[#152226] flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.15)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#10B981]/10 to-transparent animate-spin" style={{ animationDuration: '3s' }} />
            <Sparkles className="w-8 h-8 text-[#10B981] relative z-10 animate-pulse" />
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight">Creating your Clipr DNA</h2>
            <p className="text-sm text-[#6B7C85]">This will take just a few seconds</p>
          </div>

          {/* Stepper Status list */}
          <div className="bg-[#0D1416]/50 border border-[#152226] rounded-xl p-5 text-left space-y-3 backdrop-blur-md">
            {messages.map((msg, idx) => {
              const isCompleted = generationStep > idx;
              const isCurrent = generationStep === idx;
              return (
                <div key={idx} className="flex items-center space-x-3 text-sm transition-all duration-300">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                    isCompleted 
                      ? "bg-[#10B981]/15 border-[#10B981] text-[#10B981]" 
                      : isCurrent 
                      ? "border-[#10B981] text-[#10B981] animate-pulse" 
                      : "border-[#152226] text-[#6B7C85]"
                  }`}>
                    {isCompleted ? <Check className="w-3 h-3" /> : <span className="text-[10px] font-mono">{idx + 1}</span>}
                  </div>
                  <span className={isCompleted ? "text-white/95" : isCurrent ? "text-[#10B981] font-medium" : "text-[#6B7C85]"}>
                    {msg}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[#152226] h-1.5 rounded-full overflow-hidden">
            <motion.div 
              className="bg-[#10B981] h-full"
              initial={{ width: "0%" }}
              animate={{ width: `${(generationStep / messages.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#070B0D] flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">

      {/* Background glow orbs */}
      <div className="absolute top-[-10%] left-[20%] w-[350px] h-[350px] bg-gradient-to-br from-[#10B981] to-emerald-950 rounded-full blur-[120px] opacity-[0.08] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-gradient-to-tr from-emerald-950 to-emerald-500 rounded-full blur-[140px] opacity-[0.05] pointer-events-none" />

      {/* LEFT PANEL: Progress & Info */}
      <div className="w-full md:w-[320px] shrink-0 bg-[#0B1012] border-b md:border-b-0 md:border-r border-[#152226] p-6 md:p-8 flex flex-col justify-between relative z-10">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <Image
              src="/Clipr-logo.png"
              alt="Clipr"
              width={24}
              height={24}
              className="w-6 h-6 rounded-[6px]"
            />
            <span className="text-lg font-bold tracking-tight text-white">
              Clipr<span className="text-[#10B981] font-mono">.</span>
            </span>
          </div>

          <div className="space-y-1">
            <h1 className="text-lg font-bold text-white tracking-tight">Create Clipr DNA</h1>
            <p className="text-xs text-[#6B7C85] leading-relaxed">
              Answer 4 simple questions. Then, all video content will be generated specifically for your product and in your personal style.
            </p>
          </div>

          {/* Steps Indicator */}
          <div className="hidden md:flex flex-col space-y-4 pt-4">
            {stepsData.map((s, idx) => {
              const isPast = step > idx + 1;
              const isActive = step === idx + 1;
              return (
                <div key={idx} className="flex items-center space-x-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono border transition-all ${
                    isPast 
                      ? "bg-[#10B981]/10 border-[#10B981] text-[#10B981]" 
                      : isActive 
                      ? "border-[#10B981] text-[#10B981] bg-[#10B981]/5 shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                      : "border-[#152226] text-[#6B7C85]"
                  }`}>
                    {isPast ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <div>
                    <span className={`text-xs block font-semibold leading-tight ${isActive ? "text-white" : "text-[#6B7C85]"}`}>
                      {s.title}
                    </span>
                    <span className="text-[10px] text-[#6B7C85] block mt-0.5">
                      {s.desc}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Small badge */}
        <div className="pt-4 border-t border-[#152226] text-[10px] text-[#6B7C85] font-mono flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          <span>Quick start in 1 minute</span>
        </div>
      </div>

      {/* RIGHT PANEL: Question content */}
      <div className="flex-1 flex flex-col md:justify-between p-6 md:p-12 pb-10 md:pb-12 relative z-10 md:min-h-[450px]">
        {/* Mobile step bar indicator */}
        <div className="md:hidden w-full bg-[#152226] h-1 rounded-full mb-6 overflow-hidden">
          <div className="bg-[#10B981] h-full" style={{ width: `${(step / 4) * 100}%` }} />
        </div>

        <div className="max-w-xl w-full mx-auto md:my-auto space-y-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" {...stepsTransitions} className="space-y-4">
                <div className="space-y-2">
                  <span className="text-xs uppercase font-mono tracking-widest text-[#10B981] font-bold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Step 1 of 4
                  </span>
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    What should we call you?
                  </h2>
                  <p className="text-sm text-[#6B7C85]">
                    We&apos;ll use your name across your dashboard. You can change it later in Settings.
                  </p>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && name.trim()) handleNext();
                    }}
                    className="w-full bg-[#0D1416] border border-[#152226] hover:border-[#1E343A] focus:border-[#10B981] rounded-xl px-4 py-3.5 text-white text-sm outline-none focus:ring-1 focus:ring-[#10B981]/30 transition-all placeholder:text-[#6B7C85]"
                    placeholder="For example: Alex Rivera"
                    autoFocus
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" {...stepsTransitions} className="space-y-4">
                <div className="space-y-2">
                  <span className="text-xs uppercase font-mono tracking-widest text-[#10B981] font-bold flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" /> Step 2 of 4 <span className="text-[#6B7C85] text-xs font-normal font-sans lowercase">(optional)</span>
                  </span>
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    Tell us about your product, UGC niche, or blog topic
                  </h2>
                  <p className="text-sm text-[#6B7C85]">
                    Describe the core idea in one sentence. We will use this to generate customized content ideas for you.
                  </p>
                </div>

                <div className="space-y-2">
                  <textarea
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    className="w-full bg-[#0D1416] border border-[#152226] hover:border-[#1E343A] focus:border-[#10B981] rounded-xl p-4 text-white text-sm outline-none resize-none h-32 focus:ring-1 focus:ring-[#10B981]/30 transition-all placeholder:text-[#6B7C85]"
                    placeholder="For example: UGC content about fitness and healthy habits for millennials OR A B2B project management platform for small businesses"
                    autoFocus
                  />
                  <div className="flex justify-between items-center text-[11px] text-[#6B7C85]">
                    <span>Minimum 10 characters</span>
                    <span>{product.length} chars</span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" {...stepsTransitions} className="space-y-4">
                <div className="space-y-2">
                  <span className="text-xs uppercase font-mono tracking-widest text-[#10B981] font-bold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Step 3 of 4 <span className="text-[#6B7C85] text-xs font-normal font-sans lowercase">(optional)</span>
                  </span>
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    Who are you making content for?
                  </h2>
                  <p className="text-sm text-[#6B7C85]">
                    Describe your target audience or choose from the suggestions below.
                  </p>
                </div>

                <div className="space-y-4">
                  <input
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="w-full bg-[#0D1416] border border-[#152226] hover:border-[#1E343A] focus:border-[#10B981] rounded-xl px-4 py-3.5 text-white text-sm outline-none focus:ring-1 focus:ring-[#10B981]/30 transition-all placeholder:text-[#6B7C85]"
                    placeholder="For example: Aspiring designers, solo founders, college students"
                    autoFocus
                  />

                  {/* Suggestion tags */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono uppercase text-[#6B7C85] tracking-wider block">Quick suggestions:</span>
                    <div className="flex flex-wrap gap-2">
                      {["Startup Founders", "Designers & Creators", "Marketers", "Developers", "B2B Clients", "E-commerce Shoppers"].map((tag) => (
                        <button
                           key={tag}
                           onClick={() => setAudience(tag)}
                           className="px-3 py-1.5 rounded-full text-xs border border-[#152226] bg-[#0D1416] text-[#6B7C85] hover:text-white hover:border-[#10B981] transition-all"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" {...stepsTransitions} className="space-y-4">
                <div className="space-y-2">
                  <span className="text-xs uppercase font-mono tracking-widest text-[#10B981] font-bold flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" /> Step 4 of 4
                  </span>
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    Which platform are you focusing on first?
                  </h2>
                  <p className="text-sm text-[#6B7C85]">
                    This will determine the primary format of your generated scripts.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  {(["TikTok", "Instagram Reels", "LinkedIn", "YouTube Shorts", "Twitter / X"] as const).map((plat) => {
                    const isSelected = platform === plat;
                    return (
                      <button
                        key={plat}
                        onClick={() => setPlatform(plat)}
                        className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-3 transition-all duration-200 ${
                          isSelected
                            ? "border-[#10B981] bg-[#10B981]/5 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                            : "border-[#152226] bg-[#0D1416] hover:bg-[#11191B] hover:border-[#1E343A]"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-900 border border-zinc-800">
                          {getPlatformIcon(plat)}
                        </div>
                        <span className="text-xs font-semibold text-white">{plat}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* BOTTOM NAV BAR: BACK & NEXT BUTTONS */}
        <div className="max-w-xl w-full mx-auto flex justify-between items-center pt-6 border-t border-[#152226]">
          <button
            onClick={handleBack}
            className={`flex items-center space-x-1.5 text-xs text-[#6B7C85] hover:text-white transition-all px-3 py-2 rounded-lg ${
              step === 1 ? "opacity-0 pointer-events-none" : ""
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                // Step 1 (name) is optional — skipping falls back to the email-derived name.
                if (step === 2) { if (!product.trim()) setProduct("AI-powered content workflow tool for founders and creators"); }
                if (step === 3) { if (!audience.trim()) setAudience("Startup Founders"); }
                handleNext();
              }}
              className="text-[11px] text-[#6B7C85] hover:text-white underline underline-offset-2 transition-all"
            >
              Skip
            </button>

            <button
              onClick={handleNext}
              disabled={isNextDisabled()}
              className={`bg-[#10B981] disabled:opacity-30 disabled:pointer-events-none hover:bg-[#12cf90] text-[#070B0D] text-xs font-semibold px-5 py-2.5 rounded-lg flex items-center space-x-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]`}
            >
              <span>{step === 4 ? "Create DNA" : "Next"}</span>
              {step === 4 ? <Sparkles className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
