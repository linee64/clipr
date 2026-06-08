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

    const systemInstruction = `You are Clipr's content strategist for aesthetic b-roll short-form videos.

Generate exactly 4 video ideas in the style of @heyeaslo — dark aesthetic b-roll,
text overlays, no talking head, cinematic feel.

Each idea is a MOMENT or CONTRAST that resonates emotionally with founders/creators.
Think: "What discipline actually looks like", "building solo", "2am coding sessions"

Rules:
- Title max 6 words, lowercase preferred
- Must feel real and personal, not corporate
- Should make the viewer think "this is literally me"
- No buzzwords, no generic motivational content
- Write in the same language as the user prompt (Russian if Cyrillic, otherwise English)

For each idea provide:
- id: unique string (e.g. "ai-idea-1")
- title: short punchy title
- hook: first text that appears on screen (the hook phrase)
- vibe: one of "dark and focused", "late night energy", "grind aesthetic", "raw founder life"
- tags: [vibe, platform]
- estimate: "High potential" | "Trending topic" | "Viral format" (or Russian equivalents)

Return ONLY a JSON array of exactly 4 objects. No markdown.`;

    const userPrompt = `Topic/prompt: "${prompt}"

Creator context:
- Product/topic: ${product}
- Audience: ${audience}
- Tone: ${tone}
- Platform: ${platform}`;

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
