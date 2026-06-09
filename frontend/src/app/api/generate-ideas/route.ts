import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured in .env.local" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { product, audience, tone, platform, prompt } = body;

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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.9,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error response:", errText);
      return NextResponse.json(
        { error: "Gemini API call failed", details: errText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      return NextResponse.json({ error: "No response text from Gemini" }, { status: 500 });
    }

    let cleanedText = textContent.trim();
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    const ideas = JSON.parse(cleanedText);
    return NextResponse.json(ideas);
  } catch (error) {
    console.error("Error generating ideas:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
