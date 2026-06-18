"use server";

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type ActionResponse = {
  success: boolean;
  message: string;
  isDemo?: boolean;
  /** true when a confirmation email was sent and the user must confirm before logging in */
  needsConfirmation?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

/**
 * Sign up a new account.
 *
 * With a `password` this is a real email+password registration that REQUIRES email
 * confirmation (Supabase sends the confirm link; no session until it's clicked) —
 * the caller shows a "check your inbox" state and does NOT enter the studio. Without
 * a password (e.g. the Google path) we just record the waitlist row.
 */
export async function submitWaitlist(formData: FormData): Promise<ActionResponse> {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString() ?? "";
  const origin = (
    formData.get("origin")?.toString() ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://clipr-ai.xyz"
  ).replace(/\/+$/, "");

  if (!email) return { success: false, message: "Email is required." };
  if (!EMAIL_RE.test(email)) {
    return { success: false, message: "Please enter a valid email address." };
  }

  if (!isSupabaseConfigured || !supabase) {
    // Demo mode: pretend we registered; the caller routes to /login.
    return { success: true, isDemo: true, needsConfirmation: false, message: "Account created (demo)." };
  }

  // Email + password registration → confirmation required.
  if (password) {
    if (password.length < MIN_PASSWORD) {
      return { success: false, message: `Password must be at least ${MIN_PASSWORD} characters.` };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // After clicking the confirm link, land on the login page to sign in.
      options: { emailRedirectTo: `${origin}/login?confirmed=1` },
    });
    if (error) {
      // Supabase returns this when the email already has an account.
      if (/already registered|already exists|user.*exists/i.test(error.message)) {
        return { success: false, message: "That email already has an account — try logging in." };
      }
      return { success: false, message: error.message };
    }

    // Best-effort waitlist row (ignore duplicates / RLS hiccups).
    try {
      await supabase.from("waitlist").insert([{ email }]);
    } catch {
      /* non-fatal */
    }

    // With confirmations ON, no session is returned and a confirm email is sent.
    const needsConfirmation = !data.session;
    return {
      success: true,
      needsConfirmation,
      message: needsConfirmation
        ? "Check your inbox to confirm your account, then log in."
        : "Account created — you can log in now.",
    };
  }

  // No password (e.g. Google): just record the waitlist email.
  try {
    const { error: dbError } = await supabase.from("waitlist").insert([{ email }]);
    if (dbError && !(dbError.code === "23505" || dbError.message?.includes("unique"))) {
      console.error("Waitlist insert error:", dbError);
    }
  } catch (err) {
    console.error("Waitlist insert exception:", err);
  }
  return { success: true, needsConfirmation: false, message: "You're in!" };
}
