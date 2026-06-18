import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/apiRateLimit";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key is not configured in .env.local" }, { status: 500 });
    }

    // This route spends the server's Gemini budget. Throttle per-IP (best-effort).
    if (!rateLimit(`script:${clientIp(req)}`, 30, 60_000)) {
      return NextResponse.json(
        { error: "Too many requests — please slow down and try again shortly." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { product, audience, tone, samplePost, platform, ideaTitle, ideaHook } = body;

    // Need at least an idea title to generate a script; reject before spending a call.
    if (typeof ideaTitle !== "string" || !ideaTitle.trim()) {
      return NextResponse.json({ error: "An idea title is required." }, { status: 400 });
    }

    const systemInstruction = `You are an expert short-form video content strategist and scriptwriter.
Your goal is to generate one viral short-form video script (TikTok, Instagram Reels, YouTube Shorts, or LinkedIn post) based on the user's idea, product, target audience, tone of voice, and platform.

The script must have a strong pattern-interrupting hook, clear problem/solution structure, and a compelling CTA.

You must provide:
- hook (0-3 sec: short, engaging hook sentence)
- problem (3-15 sec: array of exactly 3 concise problem points)
- solution (15-45 sec: array of exactly 3 concise solution/action points)
- cta (45-60 sec: short call to action sentence)

Return the output ONLY as a JSON object matching this schema:
{
  "hook": "string",
  "problem": ["string", "string", "string"],
  "solution": ["string", "string", "string"],
  "cta": "string"
}

Language Constraint: Write the response script in Russian if the product, audience, or ideaTitle is primarily in Russian or cyrillic. Otherwise, write it in English.
Make sure the script matches the Tone of Voice constraint: "${tone}" and reflects the voice style reference post: "${samplePost || 'none'}".
Do not add markdown formatting or wrappers (like \`\`\`json) around the JSON output. Return only the raw JSON.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Generate a script for this video idea:
Title: ${ideaTitle}
Initial Hook Concept: ${ideaHook}
Product/Context: ${product}
Target Audience: ${audience}
Platform: ${platform}`,
                },
              ],
            },
          ],
          systemInstruction: {
            parts: [
              {
                text: systemInstruction,
              },
            ],
          },
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      // Log upstream detail server-side only; don't forward Google's verbatim error body.
      const errText = await response.text();
      console.error("Gemini API error response:", errText);
      return NextResponse.json(
        { error: "Script generation is temporarily unavailable." },
        { status: 502 }
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

    const script = JSON.parse(cleanedText);
    return NextResponse.json(script);
  } catch (error) {
    console.error("Error generating script:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
