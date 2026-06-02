"use server";

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type ActionResponse = {
  success: boolean;
  message: string;
  isDemo?: boolean;
};

export async function submitWaitlist(formData: FormData): Promise<ActionResponse> {
  const email = formData.get("email")?.toString().trim();

  // Basic email validation
  if (!email) {
    return { success: false, message: "Email is required." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, message: "Please enter a valid email address." };
  }

  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (!isSupabaseConfigured || !supabase) {
    console.log(`[Demo Mode] Email: ${email}`);
    return {
      success: true,
      message: "Please check your inbox to confirm your spot! (Demo Mode) ✉️",
      isDemo: true,
    };
  }

  try {
    // 1. Send passwordless magic link (signInWithOtp) to verify email and register user
    const { error: signUpError } = await supabase.auth.signInWithOtp({
      email,
    });

    if (signUpError) {
      console.error("Supabase Auth signInWithOtp error:", signUpError);
      return {
        success: false,
        message: signUpError.message,
      };
    }

    // 2. Also insert the email into the public waitlist database table
    const { error: dbError } = await supabase
      .from("waitlist")
      .insert([{ email }]);

    if (dbError) {
      // Check for unique violation (already registered in waitlist)
      if (dbError.code === "23505" || dbError.message?.includes("unique")) {
        return {
          success: true,
          message: "You're already on the list! We'll reach out soon 🎉",
        };
      }
      console.error("Supabase DB insert error:", dbError);
    }

    return {
      success: true,
      message: "Please check your inbox! We've sent a verification link to confirm your spot. ✉️",
    };
  } catch (err) {
    console.error("Waitlist submission exception:", err);
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}
