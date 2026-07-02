import type { Metadata } from "next";
import localFont from "next/font/local";
import { Playfair_Display, Alex_Brush, Space_Grotesk, Inter } from "next/font/google";
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
const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
});
const alexBrush = Alex_Brush({
  subsets: ["latin"],
  variable: "--font-cursive",
  weight: ["400"],
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Clipr — AI Video Content Workflow for Founders & Creators",
  description:
    "Clipr turns your idea into a ready-to-post Reel or TikTok — script, references, calendar, and auto-posting. All in one visual flow.",
  metadataBase: new URL("https://clipr.ai"),
  // Tab icon comes from the file-convention icons in src/app (favicon.ico,
  // icon.png, apple-icon.png), all generated from the logo.
  openGraph: {
    title: "Clipr — Your content team. Minus the team.",
    description: "Turns an idea into a full video content workflow: script, references, calendar, and auto-posting.",
    type: "website",
    images: ["/Clipr-logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clipr — AI Video Content Workflow",
    description: "Your content team. Minus the team. Script, references, calendar, and auto-posting in one flow.",
    images: ["/Clipr-logo.png"],
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
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${alexBrush.variable} ${spaceGrotesk.variable} ${inter.variable} font-sans antialiased text-white selection:bg-[#10B981] selection:text-white`}
      >
        <div className="noise-overlay" />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
