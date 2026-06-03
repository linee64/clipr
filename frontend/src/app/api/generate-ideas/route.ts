import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key is not configured in .env.local" }, { status: 500 });
    }

    const body = await req.json();
    const { product, audience, tone, platform, prompt } = body;

    const systemInstruction = `You are an expert short-form video content strategist. 
Your goal is to generate exactly 4 unique, creative content ideas for short-form videos (TikTok, Instagram Reels, YouTube Shorts, or LinkedIn posts).

Each idea must be:
- Unique in angle and approach
- Relevant to the product/topic and target audience
- Designed for the specified platform
- Written in the same language as the user prompt (if Russian/Cyrillic, write in Russian; otherwise English)

For each idea, you must provide:
- id: a unique identifier string (e.g. "ai-idea-1", "ai-idea-2", etc.)
- title: a catchy, compelling title for the content piece (max 60 chars)
- hook: a short engaging hook sentence that captures attention (max 120 chars)
- tags: an array of exactly 2 strings — [content format type, platform name]. Format types can be: "Советы", "История", "Списки", "Мнение", "Туториал", "Разбор", "Тренд", "Кейс" (for Russian) or "Tips", "Story", "List", "Hot Take", "Tutorial", "Breakdown", "Trend", "Case Study" (for English)
- estimate: a short engagement potential label. Use one of: "Высокий потенциал", "Трендовый формат", "Вирусный хук", "Горячая тема" (for Russian) or "High potential", "Trending topic", "Viral format", "Hot topic" (for English)

Return the output ONLY as a JSON array of exactly 4 objects matching this schema:
[
  {
    "id": "ai-idea-1",
    "title": "string",
    "hook": "string",
    "tags": ["string", "string"],
    "estimate": "string"
  },
  ...
]

Make the ideas diverse — mix different content formats (tips, stories, lists, hot takes, tutorials, breakdowns).
Each idea should feel distinct and approach the topic from a different angle.
Do not add markdown formatting or wrappers (like \`\`\`json) around the JSON output. Return only the raw JSON array.`;

    const userPrompt = `Generate 4 content ideas based on:
User Prompt: ${prompt}
Product/Topic: ${product}
Target Audience: ${audience}
Tone: ${tone}
Platform: ${platform}`;

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
                  text: userPrompt,
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
            temperature: 0.9,
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

    const ideas = JSON.parse(textContent.trim());
    return NextResponse.json(ideas);
  } catch (error) {
    console.error("Error generating ideas:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
