import React from "react";

interface Platform {
  name: string;
  icon: React.ReactNode;
}

const platforms: Platform[] = [
  {
    name: "TikTok",
    icon: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.59 4.23.99 1.15 2.37 1.93 3.86 2.19V10.1c-1.63-.02-3.23-.55-4.57-1.49-.07 1.77-.04 3.54-.05 5.31-.07 2.05-.72 4.14-2.14 5.63-1.67 1.83-4.22 2.66-6.67 2.27-2.73-.39-5.16-2.45-5.91-5.12-.9-3.03.35-6.52 3.04-8.08 1.63-.98 3.59-1.2 5.44-.75v3.83c-1.12-.34-2.38-.13-3.35.53-1.07.69-1.63 2.04-1.37 3.3.21 1.25 1.22 2.26 2.47 2.48 1.48.24 3.04-.54 3.59-1.95.27-.61.34-1.28.32-1.95.01-4.04-.01-8.08.01-12.12z" />
      </svg>
    ),
  },
  {
    name: "LinkedIn",
    icon: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    icon: (
      <svg className="w-5 h-5 stroke-current fill-none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
      </svg>
    ),
  },
  {
    name: "Twitter / X",
    icon: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    name: "YouTube Shorts",
    icon: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M17.71 7.73c-.81-2.36-3.09-3.93-5.59-3.93-1.63 0-3.21.68-4.32 1.83l-3.32 3.3c-1.95 1.95-1.95 5.12 0 7.07l.56.56c.78.78 1.84 1.22 2.94 1.22s2.16-.44 2.94-1.22l3.32-3.3c1.95-1.95 1.95-5.12 0-7.07l-1.63-1.63c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.63 1.63c1.17 1.17 1.17 3.07 0 4.24l-3.32 3.3c-.39.39-.91.61-1.46.61s-1.08-.22-1.46-.61l-.56-.56c-1.17-1.17-1.17-3.07 0-4.24l3.32-3.3c.51-.51 1.2-.79 1.92-.79s1.41.28 1.92.79c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41z" />
        <path d="M10.25 9.75v4.5l3.5-2.25-3.5-2.25z" />
      </svg>
    ),
  },
];

export function Marquee() {
  // Duplicate list to create a seamless infinite loop
  const list = [...platforms, ...platforms, ...platforms, ...platforms];

  return (
    <div className="w-full overflow-hidden py-6 border-y border-zinc-900 bg-zinc-950/20 backdrop-blur-sm relative">
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#080808] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#080808] to-transparent z-10 pointer-events-none" />
      <div className="flex w-max animate-marquee">
        {list.map((platform, idx) => (
          <div
            key={idx}
            className="flex items-center space-x-3 mx-12 text-zinc-400 hover:text-white transition-colors duration-200 cursor-default select-none"
          >
            <span className="text-[#FF4D00]">{platform.icon}</span>
            <span className="font-semibold tracking-wider text-sm">{platform.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
