"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { submitWaitlist } from "@/app/actions";
import { Button } from "./ui/button";
import { ArrowRight, Loader2, CheckCircle2, Lock } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [dbCount, setDbCount] = useState(17);

  // Determine if email is valid in real-time
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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
        setMessage(`Registered via Google: ${userEmail} 🎉`);
        setDbCount((prev) => prev + 1);
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
      setMessage("Simulated Google waitlist signup successful (Demo Mode)! 🎉");
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
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

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const englishRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':",./<>?\|`~ ]*$/;
    
    if (!englishRegex.test(val)) {
      setPasswordError("English keyboard layout only / Только английская раскладка клавиатуры.");
    } else if (val.length > 0 && val.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
    } else {
      setPasswordError("");
    }
    setPassword(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (isEmailValid && password && passwordError) return;

    setStatus("loading");
    setMessage("");

    const formData = new FormData();
    formData.append("email", email);
    if (password) {
      formData.append("password", password);
    }

    try {
      const response = await submitWaitlist(formData);
      if (response.success) {
        setStatus("success");
        setMessage(response.message);
        setEmail("");
        setPassword("");
        setDbCount((prev) => prev + 1);
      } else {
        setStatus("error");
        setMessage(response.message);
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
            className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 backdrop-blur-md flex flex-row items-center justify-between gap-4 w-full text-left"
          >
            <div className="flex items-start space-x-3 min-w-0 pl-1">
              <CheckCircle2 className="w-5 h-5 text-[#FF4D00] shrink-0 mt-0.5" />
              <div className="min-w-0 leading-tight">
                <p className="text-[9px] uppercase font-mono tracking-widest text-[#FF4D00] font-bold">Success</p>
                <p className="text-xs text-zinc-200 mt-1 leading-normal">{message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl transition-all shrink-0 active:scale-95"
            >
              Add another
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left"
          >
            <form onSubmit={handleSubmit} className="space-y-3 w-full">
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <div className="flex-1 relative">
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={status === "loading"}
                    className="w-full px-5 py-3 rounded-full bg-zinc-950/60 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF4D00] focus:ring-1 focus:ring-[#FF4D00] transition-all text-sm disabled:opacity-50"
                    required
                  />
                </div>

                {!isEmailValid && (
                  <Button
                    type="submit"
                    disabled={status === "loading" || !email}
                    className="w-full sm:w-auto shrink-0 py-3 rounded-full"
                  >
                    Get early access
                  </Button>
                )}
              </div>

              <AnimatePresence>
                {isEmailValid && (
                  <motion.div
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    className="overflow-hidden space-y-3"
                  >
                    <div className="relative">
                      <input
                        type="password"
                        name="password"
                        placeholder="Create password (min. 6 English characters)"
                        value={password}
                        onChange={handlePasswordChange}
                        disabled={status === "loading"}
                        className="w-full pl-11 pr-5 py-3 rounded-full bg-zinc-950/60 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF4D00] focus:ring-1 focus:ring-[#FF4D00] transition-all text-sm disabled:opacity-50"
                        required
                      />
                      <Lock className="w-4 h-4 text-zinc-500 absolute left-4 top-3.5" />
                    </div>

                    {passwordError && (
                      <p className="text-red-500 text-[11px] pl-4">{passwordError}</p>
                    )}

                    <Button
                      type="submit"
                      disabled={status === "loading" || !password || !!passwordError}
                      className="w-full py-3 rounded-full"
                    >
                      {status === "loading" ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        <>
                          Register & Get early access
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
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

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-mono text-zinc-500 pt-4 border-t border-zinc-900/60 mt-4">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>{200 + dbCount} founders already joined</span>
        </div>
        <span className="text-zinc-800">•</span>
        <div className="flex items-center space-x-1.5 text-[#FF4D00] font-semibold">
          <span>🚀 Launching soon</span>
        </div>
      </div>
    </div>
  );
}
