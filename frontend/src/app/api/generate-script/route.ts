import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key is not configured in .env.local" }, { status: 500 });
    }

    const body = await req.json();
    const { product, audience, tone, samplePost, platform, ideaTitle, ideaHook } = body;

    const systemInstruction = `You are an expert short-form video content strategist and scriptwriter. 
Your goal is to generate 3 script variants for a short-form video (TikTok, Instagram Reels, YouTube Shorts, or LinkedIn post) based on the user's idea, product, target audience, tone of voice, and platform.

The 3 variants must be:
1. "Aggressive Hook" (Starts with a shocking, pattern-interrupting statement. Strong, bold, and direct.)
2. "Storytelling" (Starts with a narrative, relatable personal anecdote or hypothetical situation.)
3. "Educational" (Starts with a valuable tips, checklist, or how-to hook. Clear and instructive.)

For each variant, you must provide:
- hook (0-3 sec: short, engaging hook sentence)
- problem (3-15 sec: array of exactly 3 concise problem points)
- solution (15-45 sec: array of exactly 3 concise solution/action points)
- cta (45-60 sec: short call to action sentence matching the style)

Return the output ONLY as a JSON object matching this schema:
{
  "Aggressive Hook": {
    "hook": "string",
    "problem": ["string", "string", "string"],
    "solution": ["string", "string", "string"],
    "cta": "string"
  },
  "Storytelling": {
    "hook": "string",
    "problem": ["string", "string", "string"],
    "solution": ["string", "string", "string"],
    "cta": "string"
  },
  "Educational": {
    "hook": "string",
    "problem": ["string", "string", "string"],
    "solution": ["string", "string", "string"],
    "cta": "string"
  }
}

Language Constraint: Write the response scripts in Russian if the product, audience, or ideaTitle is primarily in Russian or cyrillic. Otherwise, write them in English.
Make sure the scripts match the Tone of Voice constraint: "${tone}" and reflect the voice style reference post: "${samplePost || 'none'}".
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
                  text: `Generate 3 script variants for this video idea:
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
      const errText = await response.text();
      console.error("Gemini API error response:", errText);
      return NextResponse.json({ error: "Gemini API call failed", details: errText }, { status: response.status });
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      return NextResponse.json({ error: "No response text from Gemini" }, { status: 500 });
    }

    const scripts = JSON.parse(textContent.trim());
    return NextResponse.json(scripts);
  } catch (error) {
    console.error("Error generating script:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
