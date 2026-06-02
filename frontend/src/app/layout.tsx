import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Clipr — AI Video Content Workflow for Founders & Creators",
  description:
    "Clipr turns your idea into a ready-to-post Reel or TikTok — script, references, calendar, and auto-posting. All in one visual flow.",
  metadataBase: new URL("https://clipr.ai"),
  openGraph: {
    title: "Clipr — Your content team. Minus the team.",
    description: "Turns an idea into a full video content workflow: script, references, calendar, and auto-posting.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clipr — AI Video Content Workflow",
    description: "Your content team. Minus the team. Script, references, calendar, and auto-posting in one flow.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased text-white selection:bg-[#FF4D00] selection:text-white`}
      >
        <div className="noise-overlay" />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
