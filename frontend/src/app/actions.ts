"use server";

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type ActionResponse = {
  success: boolean;
  message: string;
  isDemo?: boolean;
};

export async function submitWaitlist(formData: FormData): Promise<ActionResponse> {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString().trim();

  // Basic email validation
  if (!email) {
    return { success: false, message: "Email is required." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, message: "Please enter a valid email address." };
  }

  // Password validation if provided
  if (password !== undefined) {
    if (password.length < 6) {
      return { success: false, message: "Password must be at least 6 characters." };
    }
    // English keyboard characters only (letters, numbers, symbols, spaces)
    const englishRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':",./<>?\|`~ ]+$/;
    if (!englishRegex.test(password)) {
      return { success: false, message: "Password must use English letters and symbols only." };
    }
  }

  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (!isSupabaseConfigured || !supabase) {
    console.log(`[Demo Mode] Email: ${email}, Password: ${password ? "***" : "None"}`);
    return {
      success: true,
      message: password
        ? "Account created! Please check your inbox to confirm your email. (Demo Mode) ✉️"
        : "Please check your inbox to confirm your spot! (Demo Mode) ✉️",
      isDemo: true,
    };
  }

  try {
    // 1. If password is provided, create the user in Supabase Authentication
    if (password) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        console.error("Supabase Auth signUp error:", signUpError);
        return {
          success: false,
          message: signUpError.message,
        };
      }
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
      message: password
        ? "Account created! Please check your email to confirm registration. ✉️"
        : "Please check your inbox! We've sent a verification link to confirm your spot. ✉️",
    };
  } catch (err) {
    console.error("Waitlist submission exception:", err);
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}
