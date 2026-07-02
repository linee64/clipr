"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "entering" | "error">("idle");
  const [message, setMessage] = useState("");
  const [justConfirmed, setJustConfirmed] = useState(false);

  const enterStudio = (userEmail?: string) => {
    try {
      localStorage.setItem("clipr_registered", "1");
      if (userEmail) localStorage.setItem("clipr_email", userEmail);
      localStorage.removeItem("clipr_login_active");
    } catch {
      /* ignore */
    }
    window.location.href = "/dashboard";
  };

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("confirmed") === "1") {
        setJustConfirmed(true);
      }
    } catch {
      /* ignore */
    }

    if (!isSupabaseConfigured || !supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        let changed = false;
        if (url.hash && (url.hash.includes("access_token") || url.hash.includes("error"))) {
          url.hash = "";
          changed = true;
        }
        if (url.searchParams.has("code")) { url.searchParams.delete("code"); changed = true; }
        if (url.searchParams.has("confirmed")) { url.searchParams.delete("confirmed"); changed = true; }
        if (changed) window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }

      const initiated =
        typeof window !== "undefined" && localStorage.getItem("clipr_login_active") === "true";

      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user?.email && initiated) {
        setStatus("entering");
        setMessage(`Welcome back, ${session.user.email} — taking you in…`);
        setTimeout(() => enterStudio(session.user!.email!), 700);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value || !password) return;
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(value)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setMessage("");
    try { localStorage.removeItem("clipr_login_active"); } catch { /* ignore */ }

    if (!isSupabaseConfigured || !supabase) {
      setStatus("entering");
      setMessage("Welcome back — taking you to your studio…");
      setTimeout(() => enterStudio(value), 700);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: value,
        password,
      });
      if (error) {
        setStatus("error");
        setMessage(
          /email not confirmed/i.test(error.message)
            ? "Confirm your email first — check your inbox for the link."
            : /invalid login credentials/i.test(error.message)
              ? "Wrong email or password."
              : error.message
        );
        return;
      }
      setStatus("entering");
      setMessage("Welcome back — taking you to your studio…");
      setTimeout(() => enterStudio(data.user?.email || value), 600);
    } catch {
      setStatus("error");
      setMessage("Couldn't log in. Please try again.");
    }
  };

  const handleGoogle = async () => {
    setStatus("loading");
    setMessage("");
    try {
      localStorage.setItem("clipr_login_active", "true");
    } catch {
      /* ignore */
    }

    if (!isSupabaseConfigured || !supabase) {
      setStatus("entering");
      setMessage("Welcome back — taking you to your studio…");
      setTimeout(() => enterStudio(), 700);
      return;
    }

    try {
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${origin}/login?confirmed=1` },
      });
      if (error) {
        try { localStorage.removeItem("clipr_login_active"); } catch { /* ignore */ }
        setStatus("error");
        setMessage(error.message);
      }
    } catch {
      try { localStorage.removeItem("clipr_login_active"); } catch { /* ignore */ }
      setStatus("error");
      setMessage("Failed to start Google sign in.");
    }
  };

  const busy = status === "loading" || status === "entering";

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-[#050505] text-white font-sans antialiased overflow-x-hidden selection:bg-[#51E0CF] selection:text-[#0A0F0F]">
      
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

      {/* Soft Radial Glow Top */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#51E0CF]/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Header Logo */}
      <header className="relative z-10 max-w-[1216px] mx-auto w-full px-6 md:px-8 py-6 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
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
      </header>

      {/* Main Form container */}
      <main className="relative z-10 flex-grow flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[420px] bg-white/[0.01] border border-white/[0.06] rounded-[28px] p-8 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative overflow-hidden"
        >
          {/* Inner Glow Border */}
          <div className="absolute inset-0 border border-white/[0.03] rounded-[28px] pointer-events-none" />

          <AnimatePresence mode="wait">
            {status === "entering" ? (
              <motion.div
                key="entering"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-4 py-8 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-[#51E0CF]/10 text-[#51E0CF] flex items-center justify-center border border-[#51E0CF]/20">
                  <CheckCircle2 size={24} />
                </div>
                <p className="text-base text-white/80 font-sans">{message}</p>
                <Loader2 className="h-5 w-5 text-[#51E0CF] animate-spin mt-2" />
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Titles */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#51E0CF] font-bold">
                    Welcome Back
                  </span>
                  <h1 className="text-3xl font-bold font-display text-white tracking-tight">Log in to Clipr</h1>
                  <p className="text-sm text-white/50 font-sans">Pick up right where you left off.</p>
                </div>

                {justConfirmed && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-[#51E0CF]/30 bg-[#51E0CF]/5 px-4 py-3">
                    <CheckCircle2 className="h-5 w-5 text-[#51E0CF] shrink-0" />
                    <p className="text-xs text-white/80 font-sans">Email confirmed — log in to continue.</p>
                  </div>
                )}

                {/* Form Fields */}
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div className="space-y-1">
                    <input
                      type="email"
                      required
                      disabled={busy}
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-5 py-3.5 bg-white/[0.02] border border-white/[0.08] rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-[#51E0CF] focus:ring-1 focus:ring-[#51E0CF] transition-all text-sm disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <input
                      type="password"
                      required
                      disabled={busy}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-5 py-3.5 bg-white/[0.02] border border-white/[0.08] rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-[#51E0CF] focus:ring-1 focus:ring-[#51E0CF] transition-all text-sm disabled:opacity-50"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={busy || !email || !password}
                    className="w-full py-4 rounded-xl font-display font-semibold bg-[#51E0CF] text-[#0A0F0F] hover:bg-[#43cdbd] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(81,224,207,0.15)] disabled:opacity-50"
                  >
                    {status === "loading" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Logging in…
                      </>
                    ) : (
                      <>
                        Log in
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>

                {/* Divider */}
                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-white/[0.08]" />
                  <span className="flex-shrink mx-4 text-white/30 text-xs font-mono uppercase">or</span>
                  <div className="flex-grow border-t border-white/[0.08]" />
                </div>

                {/* Google login */}
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={busy}
                  className="w-full py-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-white transition-all text-sm flex items-center justify-center gap-3 font-semibold disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.77 14.97.68 12 .68 7.7.68 3.99 3.15 2.18 6.74l3.66 2.84c.87-2.6 3.3-4.54 6.16-4.54z" />
                    <path fill="#4285F4" d="M22.56 11.93c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 22.68c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84c1.81 3.59 5.51 6.06 9.82 6.06z" />
                    <path fill="#FBBC05" d="M5.84 13.77c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V6.74H2.18C1.43 8.23 1 9.9 1 11.68s.43 3.45 1.18 4.94l3.66-2.85z" />
                  </svg>
                  Continue with Google
                </button>

                {status === "error" && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-2 text-red-400 text-xs mt-2"
                  >
                    <AlertCircle size={14} />
                    <span>{message}</span>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      {/* Footer Navigation */}
      <footer className="relative z-10 px-4 pb-12 flex flex-col items-center gap-3">
        <p className="text-sm text-white/50">
          New to Clipr?{" "}
          <a href="/signup" className="text-[#51E0CF] font-semibold hover:underline">
            Create an account
          </a>
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </a>
      </footer>

    </div>
  );
}
