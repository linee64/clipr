"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { submitWaitlist } from "@/app/actions";
import { Button } from "./ui/button";
import { ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "confirm" | "error">("idle");
  const [message, setMessage] = useState("");
  const [dbCount, setDbCount] = useState(17);

  // After a successful sign-up, mark the user registered and send them into the
  // app. There's no real auth gate yet — the dashboard runs onboarding for any
  // user without a saved brand DNA.
  const goToDashboard = (userEmail?: string) => {
    try {
      localStorage.setItem("clipr_registered", "1");
      if (userEmail) localStorage.setItem("clipr_email", userEmail);
    } catch {
      /* ignore */
    }
    window.location.href = "/dashboard";
  };

  useEffect(() => {
    async function fetchCount() {
      if (!isSupabaseConfigured || !supabase) return;
      try {
        const { count, error } = await supabase
          .from("waitlist")
          .select("*", { count: "exact", head: true });
        if (!error && count !== null) {
          setDbCount(count);
        }
      } catch (err) {
        console.error("Error fetching waitlist count:", err);
      }
    }
    fetchCount();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    // Listen for auth state changes (e.g. returning from Google OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Clean up auth parameters from URL (hash and query code) to prevent Next.js HMR disconnect / CSS breaks
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        let updated = false;
        
        if (url.hash && (url.hash.includes("access_token") || url.hash.includes("error"))) {
          url.hash = "";
          updated = true;
        }
        
        if (url.searchParams.has("code")) {
          url.searchParams.delete("code");
          updated = true;
        }
        
        if (updated) {
          window.history.replaceState(null, "", url.pathname + url.search + url.hash);
        }
      }

      // Only register automatically if we explicitly initiated a Google sign-in redirect in this session
      const wasInitiated = localStorage.getItem("clipr_google_signin_active") === "true";

      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user?.email && wasInitiated) {
        localStorage.removeItem("clipr_google_signin_active");
        handleGoogleUserRegistered(session.user.email);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleGoogleUserRegistered = async (userEmail: string) => {
    setStatus("loading");
    const formData = new FormData();
    formData.append("email", userEmail);
    try {
      const response = await submitWaitlist(formData);
      if (response.success) {
        setStatus("success");
        setMessage(`Welcome, ${userEmail} — taking you in…`);
        setDbCount((prev) => prev + 1);
        setTimeout(() => goToDashboard(userEmail), 900);
      } else {
        setStatus("error");
        setMessage(response.message);
      }
    } catch {
      setStatus("error");
      setMessage("An unexpected error occurred during Google registration.");
    }
  };

  const handleGoogleLogin = async () => {
    setStatus("loading");
    setMessage("");

    // Set flag so only this active flow registers the email when redirected back
    localStorage.setItem("clipr_google_signin_active", "true");

    if (!isSupabaseConfigured || !supabase) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      localStorage.removeItem("clipr_google_signin_active");
      setStatus("success");
      setMessage("Welcome — taking you to your studio…");
      setTimeout(() => goToDashboard(), 900);
      return;
    }

    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${siteUrl}/?confirmed=1`,
        },
      });

      if (error) {
        localStorage.removeItem("clipr_google_signin_active");
        setStatus("error");
        setMessage(error.message);
      }
    } catch {
      localStorage.removeItem("clipr_google_signin_active");
      setStatus("error");
      setMessage("Failed to initiate Google sign in.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 8) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);
    formData.append("origin", window.location.origin);

    try {
      const response = await submitWaitlist(formData);
      if (!response.success) {
        setStatus("error");
        setMessage(response.message);
        return;
      }
      setDbCount((prev) => prev + 1);
      const captured = email;
      setPassword("");
      if (response.needsConfirmation) {
        // Real sign-up with confirmation: do NOT enter the studio — they must
        // confirm via email, then log in with their new password.
        setStatus("confirm");
        setMessage(captured);
      } else {
        // Demo / confirmations off — send them to the login page to sign in.
        setStatus("success");
        setMessage("Account created — taking you to log in…");
        setEmail("");
        setTimeout(() => { window.location.href = "/login"; }, 900);
      }
    } catch {
      setStatus("error");
      setMessage("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="p-4 rounded-2xl border border-[#10B981]/30 bg-zinc-950/60 backdrop-blur-md flex flex-row items-center gap-3 w-full text-left"
          >
            <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0" />
            <div className="min-w-0 leading-tight flex-1">
              <p className="text-[9px] uppercase font-mono tracking-widest text-[#10B981] font-bold">Welcome to Clipr</p>
              <p className="text-xs text-zinc-200 mt-1 leading-normal">{message}</p>
            </div>
            <Loader2 className="w-4 h-4 text-[#10B981] animate-spin shrink-0" />
          </motion.div>
        ) : status === "confirm" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="p-5 rounded-2xl border border-[#10B981]/30 bg-zinc-950/60 backdrop-blur-md w-full text-center space-y-3"
          >
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#10B981]/12 border border-[#10B981]/30">
              <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
            </div>
            <div className="space-y-1">
              <p className="text-[9px] uppercase font-mono tracking-widest text-[#10B981] font-bold">Confirm your email</p>
              <p className="text-sm text-zinc-200 leading-relaxed">
                We sent a confirmation link to{" "}
                <span className="font-medium text-white">{message}</span>. Click it, then{" "}
                <a href="/login" className="text-[#10B981] font-semibold hover:underline">log in</a>{" "}
                with your password.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setStatus("idle"); setMessage(""); }}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Use a different email
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left"
          >
            <form onSubmit={handleSubmit} className="space-y-3 w-full">
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "loading"}
                className="w-full px-5 py-3 rounded-full bg-zinc-950/60 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] transition-all text-base md:text-sm disabled:opacity-50"
                required
              />
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="Create a password (8+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={status === "loading"}
                minLength={8}
                className="w-full px-5 py-3 rounded-full bg-zinc-950/60 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] transition-all text-base md:text-sm disabled:opacity-50"
                required
              />
              <Button
                type="submit"
                disabled={status === "loading" || !email || !password}
                className="w-full py-3 rounded-full"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-zinc-800/80"></div>
              <span className="flex-shrink mx-4 text-zinc-500 text-xs font-mono uppercase">or</span>
              <div className="flex-grow border-t border-zinc-800/80"></div>
            </div>

            <Button
              type="button"
              onClick={handleGoogleLogin}
              disabled={status === "loading"}
              variant="glass"
              className="w-full py-3 rounded-full flex items-center justify-center space-x-2 text-sm border border-zinc-800/85 bg-zinc-900/40 hover:bg-zinc-900/80 text-zinc-200"
            >
              <svg className="w-4 h-4 mr-2 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.77 14.97.68 12 .68 7.7.68 3.99 3.15 2.18 6.74l3.66 2.84c.87-2.6 3.3-4.54 6.16-4.54z"
                />
                <path
                  fill="#4285F4"
                  d="M22.56 11.93c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 22.68c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84c1.81 3.59 5.51 6.06 9.82 6.06z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 13.77c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V6.74H2.18C1.43 8.23 1 9.9 1 11.68s.43 3.45 1.18 4.94l3.66-2.85z"
                />
              </svg>
              <span>Continue with Google</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {status === "error" && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-500 text-xs mt-3 text-center"
        >
          {message}
        </motion.p>
      )}

      <div className="space-y-3 pt-4 border-t border-zinc-900/60 mt-4">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] font-mono text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            {200 + dbCount} creators on board
          </span>
          <span className="text-zinc-800">•</span>
          <span>Free 7-day trial · No card</span>
        </div>
        <p className="text-xs text-zinc-400 text-center">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => { window.location.href = "/login"; }}
            className="text-[#10B981] font-semibold hover:underline"
          >
            Log in
          </button>
        </p>
      </div>
    </div>
  );
}
