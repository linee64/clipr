"use client";

import React from "react";
import { OnboardingFlow } from "@/components/OnboardingFlow";

export default function OnboardingPage() {
  const handleOnboardingComplete = (data: {
    name: string;
    product: string;
    audience: string;
    tone: "formal" | "casual";
    samplePost: string;
    platform: "TikTok" | "Instagram Reels" | "LinkedIn" | "YouTube Shorts" | "Twitter / X";
  }) => {
    localStorage.setItem("clipr_dna", JSON.stringify(data));
    if (data.name?.trim()) {
      localStorage.setItem("clipr_name", data.name.trim());
    }
    // Redirect to dashboard
    window.location.href = "/dashboard";
  };

  return (
    <div className="w-full min-h-screen bg-[#070B0D] flex flex-col justify-center">
      <OnboardingFlow onComplete={handleOnboardingComplete} />
    </div>
  );
}
