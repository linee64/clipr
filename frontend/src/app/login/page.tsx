"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Dedicated Log In page. Email + PASSWORD sign-in (no email confirmation step at
// login — that happens once, at sign-up). You only land in the studio AFTER an
// explicit login. Google OAuth is gated by `clipr_login_active` so that merely
// opening /login — or returning here from a sign-up confirmation link — never
// auto-bounces you in. Identity is the email (clipr_email), the key billing and
// the dashboard use.
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
    // Surface "email confirmed" when arriving from a sign-up confirmation link,
    // BEFORE the auth handler below strips the query param.
    try {
      if (new URLSearchParams(window.location.search).get("confirmed") === "1") {
        setJustConfirmed(true);
      }
    } catch {
      /* ignore */
    }

    if (!isSupabaseConfigured || !supabase) return;

    // Only used to finish a Google OAuth round-trip (gated by clipr_login_active).
    // A confirm-link session does NOT set that flag, so it won't auto-enter.
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
    // Password login enters directly; make sure a stale Google flag can't also fire.
    try { localStorage.removeItem("clipr_login_active"); } catch { /* ignore */ }

    // No Supabase (local/demo) — treat the email as the identity and go in.
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
    <div className="relative min-h-screen flex flex-col overflow-hidden selection:bg-[#10B981]">
      {/* Ambient mint glow, echoing the landing hero */}
      <div className="pointer-events-none absolute top-[-12%] left-1/2 -translate-x-1/2 w-[420px] md:w-[680px] h-[420px] md:h-[680px] rounded-full bg-gradient-to-tr from-[#10B981] to-blue-900 blur-[120px] opacity-[0.14] animate-pulseSlow z-0" />
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(16,185,129,0.10) 0%, rgba(7,11,13,0) 70%)",
        }}
      />

      {/* Minimal top bar: just the logo, back to home */}
      <header className="relative z-10 px-6 md:px-8 py-6">
        <a href="/" className="inline-flex items-center gap-2 group w-fit">
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
        </a>
      </header>

      {/* Centered auth card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-[420px] rounded-[24px] border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl p-7 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.03)]"
        >
          <AnimatePresence mode="wait">
            {status === "entering" ? (
              <motion.div
                key="entering"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-3 py-6 text-center"
              >
                <CheckCircle2 className="h-6 w-6 text-[#10B981]" />
                <p className="text-sm text-zinc-300">{message}</p>
                <Loader2 className="h-4 w-4 text-[#10B981] animate-spin" />
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#10B981]">
                    Welcome back
                  </span>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Log in to Clipr</h1>
                  <p className="text-sm text-zinc-400">Pick up right where you left off.</p>
                </div>

                {justConfirmed && (
                  <div className="flex items-center gap-2 rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 px-3.5 py-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" />
                    <p className="text-xs text-zinc-200">Email confirmed — log in to continue.</p>
                  </div>
                )}

                <form onSubmit={handlePasswordLogin} className="space-y-3">
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="you@studio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                    className="w-full px-5 py-3 rounded-full bg-zinc-950/70 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] transition-all text-base md:text-sm disabled:opacity-50"
                    required
                  />
                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                    className="w-full px-5 py-3 rounded-full bg-zinc-950/70 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] transition-all text-base md:text-sm disabled:opacity-50"
                    required
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={busy || !email || !password}
                    className="w-full py-3 rounded-full"
                  >
                    {status === "loading" ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Logging in…
                      </>
                    ) : (
                      <>
                        Log in
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-zinc-800/80" />
                  <span className="flex-shrink mx-4 text-zinc-500 text-xs font-mono uppercase">or</span>
                  <div className="flex-grow border-t border-zinc-800/80" />
                </div>

                <Button
                  type="button"
                  onClick={handleGoogle}
                  disabled={busy}
                  variant="glass"
                  className="w-full py-3 rounded-full flex items-center justify-center space-x-2 text-sm border border-zinc-800/85 bg-zinc-900/40 hover:bg-zinc-900/80 text-zinc-200"
                >
                  <svg className="w-4 h-4 mr-2 shrink-0" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.77 14.97.68 12 .68 7.7.68 3.99 3.15 2.18 6.74l3.66 2.84c.87-2.6 3.3-4.54 6.16-4.54z" />
                    <path fill="#4285F4" d="M22.56 11.93c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 22.68c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84c1.81 3.59 5.51 6.06 9.82 6.06z" />
                    <path fill="#FBBC05" d="M5.84 13.77c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V6.74H2.18C1.43 8.23 1 9.9 1 11.68s.43 3.45 1.18 4.94l3.66-2.85z" />
                  </svg>
                  <span>Continue with Google</span>
                </Button>

                {status === "error" && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-xs text-center"
                  >
                    {message}
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      {/* Footer: route to signup, and back home */}
      <footer className="relative z-10 px-4 pb-10 text-center space-y-3">
        <p className="text-sm text-zinc-400">
          New to Clipr?{" "}
          <a href="/" className="text-[#10B981] font-semibold hover:underline">
            Create an account
          </a>
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </a>
      </footer>
    </div>
  );
}
