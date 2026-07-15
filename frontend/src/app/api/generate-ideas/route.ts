import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/apiRateLimit";
import {
  ideasVariationBlock,
  isContentVariation,
  type ContentVariation,
} from "@/lib/contentVariations";

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
    const variation: ContentVariation = isContentVariation(body.variation)
      ? body.variation
      : "organic";

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

    const hasCyrillic = /[а-яА-ЯёЁ]/.test(`${prompt} ${product || ""} ${audience || ""} ${tone || ""}`);
    const language = hasCyrillic ? "Russian" : "English";

    const metaRule =
      variation === "digital"
        ? `- Meta about "being a content creator" is ONLY allowed when it serves digital craft (tools, process, aesthetics). Still no "founder grind" or "2am hustle" filler.`
        : variation === "ads"
          ? `- Every idea must sell or image the product/offer. Soft image spots are fine; vague lifestyle content with no product link is not.`
          : `- NEVER generate ideas about "being a content creator", "the creator struggle", or "making videos" unless the user literally asked about content creation itself.`;

    const systemInstruction = `You are Clipr's short-form video idea strategist for TikTok, Reels, and YouTube Shorts.
Your audience: digital creators — people who make content, build audiences, sell products, teach skills, or share their craft online. They want videos that entertain, educate, and hook viewers in the first 3 seconds.

Your job: generate exactly 6 scroll-stopping video ideas based ENTIRELY on what the user typed. The user's input IS the topic. Your ideas must feel native to that topic — not generic, not repurposed from another niche.

CRITICAL: Read the user's input carefully. If they ask about cooking → ideas about cooking, food hacks, kitchen tips. If about travel → travel stories, hidden spots, travel hacks. If about fitness → workouts, mindset, progress. If about their SaaS → product demos, user stories, industry takes. If about fashion → styling tips, outfit transformations, trend commentary. MATCH THE DOMAIN THEY GAVE YOU.

${ideasVariationBlock(variation)}

Hard rules:
- NEVER default to "founder life", "building solo", "2am grind", "hustle culture", or "startup struggle" unless the user EXPLICITLY asked about those topics.
${metaRule}
- Stay in the user's domain. If they say "cooking" — every idea is about food. If "AI tool for designers" — every idea is about design workflow, not about being a founder.
- Each idea MUST be a clearly different angle from the rest. No two ideas should feel like variations of the same concept.
- Every title and hook must be specific and concrete — no vague statements.
- Language: write EVERYTHING in ${language}. All JSON string values (title, hook, vibe, estimate) in ${language}.

For each idea provide:
- id: unique string (e.g. "idea-1")
- title: short punchy title, max 6 words, lowercase preferred
- hook: the first text on screen — specific, curiosity-driving, scroll-stopping
- vibe: 2-3 word mood/style that fits THIS specific idea (e.g. "clean and uplifting", "raw and honest", "dark and intriguing", "fun and playful" — match the idea's tone)
- tags: [vibe, platform]
- estimate: one of "High potential" | "Trending topic" | "Viral format" (Russian: "Высокий потенциал" | "Трендовая тема" | "Вирусный формат")

Return ONLY a JSON array of exactly 6 objects. No markdown, no commentary.`;

    const modeLabel =
      variation === "digital"
        ? "Digital creating"
        : variation === "ads"
          ? "Product ads"
          : "Organic";

    const userPrompt = `TOPIC: "${prompt}"

This is what the user wants content about. Every idea must be directly about this topic — don't drift into unrelated niches.

CONTENT VARIATION: ${modeLabel}

CONTEXT (use as flavor, not to override the topic):
- What they do: ${product || "digital creator"}
- Who watches: ${audience || "general audience"}
- Vibe: ${tone || "authentic and engaging"}
- Platform: ${platform || "TikTok"}

Generate 6 wildly different ideas. Each idea should feel like a different creator made it — vary the angle, energy, and approach. The user should see 6 genuinely different directions they could take.`;

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
