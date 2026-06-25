import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/apiRateLimit";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "DeepSeek API key is not configured in .env.local" },
        { status: 500 }
      );
    }

    // This route spends the server's DeepSeek budget. Throttle per-IP so an anonymous
    // caller can't drain it (best-effort; see lib/apiRateLimit).
    if (!rateLimit(`ideas:${clientIp(req)}`, 20, 60_000)) {
      return NextResponse.json(
        { error: "Too many requests — please slow down and try again shortly." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { product, audience, tone, platform, prompt } = body;

    // Validate before spending an API call, and bound the prompt size so a huge body
    // can't be used to amplify cost.
    if (typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "A prompt is required." }, { status: 400 });
    }
    if (prompt.length > 2000) {
      return NextResponse.json({ error: "Prompt is too long." }, { status: 400 });
    }
    // Bound the other forwarded fields too — they're all interpolated into the
    // prompt, so an oversized value is the same cost-amplification vector as `prompt`.
    for (const v of [product, audience, tone, platform]) {
      if (typeof v === "string" && v.length > 2000) {
        return NextResponse.json({ error: "Input is too long." }, { status: 400 });
      }
    }

    const systemInstruction = `You are Clipr's short-form video idea strategist for TikTok, Reels, and YouTube Shorts.

Your job: generate exactly 6 distinct, scroll-stopping video ideas that directly PROMOTE and SHOWCASE the specific product/topic the user gives you. Every idea must be about THAT product — what it does, the problem it solves, its standout features, the transformation it gives the user, or real scenarios where someone would use it.

Hard rules:
- Stay strictly on-topic. The ideas must clearly be about the user's actual product. For example, if the product is an AI outfit try-on / styling app, every idea must be about trying on clothes, picking looks, or styling with AI — NOT about founder life, coding, hustle, loneliness, or generic motivation.
- Never default to moody "building solo / 2am grind / founder life" content unless the product is literally about that.
- Make each of the 6 ideas a clearly DIFFERENT angle, e.g.: problem → solution, before/after transformation, a quick "watch this" demo, a relatable everyday scenario, myth-busting, a bold claim/result, a "how it works" reveal, or a common mistake.
- Each idea needs a strong first-line hook that stops the scroll and is specific to the product.
- Be concrete and specific. No vague buzzwords, no corporate fluff.
- Write everything in the same language as the user's request (Russian if it contains Cyrillic, otherwise English).

For each idea provide:
- id: unique string (e.g. "ai-idea-1")
- title: short punchy title, max 6 words
- hook: the first text shown on screen — specific to the product
- vibe: a 2-3 word style/mood that fits THIS idea and product (e.g. "clean and aspirational", "fun try-on", "bold reveal")
- tags: [vibe, platform]
- estimate: one of "High potential", "Trending topic", "Viral format" (use the Russian equivalent if writing in Russian)

Return ONLY a JSON array of exactly 6 objects. No markdown, no commentary.`;

    const userPrompt = `The user wants short-form videos about this:
"${prompt}"

This request is the PRIMARY subject — every one of the 6 ideas must be directly about it.

Extra context (use only if relevant, never let it override the request above):
- Product/topic: ${product}
- Audience: ${audience}
- Tone: ${tone}
- Platform: ${platform}

Generate the 6 ideas now.`;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.9,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      // Log upstream detail server-side only — never forward DeepSeek's verbatim
      // error body to an untrusted caller.
      const errText = await response.text();
      console.error("DeepSeek API error response:", errText);
      return NextResponse.json(
        { error: "Idea generation is temporarily unavailable." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content;
    if (!textContent) {
      return NextResponse.json({ error: "No response text from DeepSeek" }, { status: 500 });
    }

    let cleanedText = textContent.trim();
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(cleanedText);
    // DeepSeek with response_format json_object may wrap the array in an object
    const ideas = Array.isArray(parsed) ? parsed : parsed.ideas || parsed.data || parsed;
    return NextResponse.json(ideas);
  } catch (error) {
    console.error("Error generating ideas:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
