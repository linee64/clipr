"use client";

import { Play } from "lucide-react";

const MOCK_REFERENCES = [
  {
    platform: "TikTok",
    views: "2.3M views",
    title: "Why onboarding buddy programs fail",
    link: "TikTok",
  },
  {
    platform: "LinkedIn",
    views: "890K views",
    title: "How we ship code on Day 1",
    link: "LinkedIn",
  },
  {
    platform: "Reels",
    views: "1.2M views",
    title: "HR automation mistakes founders make",
    link: "Instagram",
  },
  {
    platform: "TikTok",
    views: "540K views",
    title: "The 60-second founder hook formula",
    link: "TikTok",
  },
];

function PlatformBadge({ platform }: { platform: string }) {
  const label = platform.slice(0, 1);
  return (
    <span className="absolute top-2 left-2 w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold text-white">
      {label}
    </span>
  );
}

interface ReferencesStepProps {
  onSkip: () => void;
  onContinue: () => void;
}

export function ReferencesStep({ onSkip, onContinue }: ReferencesStepProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[#EFEFEF]">References</h2>
          <p className="text-sm text-[#888888] mt-1">
            Find videos in your niche to understand the format
          </p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-[#888888] underline hover:text-[#EFEFEF] shrink-0"
        >
          Skip this step →
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl">
        {MOCK_REFERENCES.map((ref, idx) => (
          <div
            key={idx}
            className="bg-[#242424] border border-[#333333] rounded-xl overflow-hidden"
          >
            <div className="relative aspect-video bg-[#1a1a1a] flex items-center justify-center">
              <PlatformBadge platform={ref.platform} />
              <span className="absolute top-2 right-2 text-xs text-[#888888]">
                {ref.views}
              </span>
              <Play className="w-10 h-10 text-[#555555]" fill="#555555" strokeWidth={0} />
            </div>
            <div className="p-4">
              <h3 className="text-sm font-medium text-[#EFEFEF]">{ref.title}</h3>
              <p className="text-xs text-[#10B981] mt-1 cursor-pointer hover:underline">
                Opens in {ref.link} →
              </p>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="w-full max-w-4xl mt-8 bg-[#10B981] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#12cf90] transition-colors"
      >
        Continue to upload →
      </button>
    </div>
  );
}
