/** Content strategy modes for idea + storyboard generation. */
export type ContentVariation = "organic" | "digital" | "ads";

export const CONTENT_VARIATIONS: {
  id: ContentVariation;
  label: string;
  shortLabel: string;
  hint: string;
}[] = [
  {
    id: "organic",
    label: "Organic",
    shortLabel: "Organic",
    hint: "Viral creator angles — takes, stories, how-tos",
  },
  {
    id: "digital",
    label: "Digital creating",
    shortLabel: "Digital",
    hint: "Craft, process, aesthetics of making digital work",
  },
  {
    id: "ads",
    label: "Product ads",
    shortLabel: "Ads",
    hint: "Sales & image spots — proof, contrast, punch CTA",
  },
];

export function isContentVariation(v: unknown): v is ContentVariation {
  return v === "organic" || v === "digital" || v === "ads";
}

/** Mode-specific block injected into the ideas system prompt. */
export function ideasVariationBlock(variation: ContentVariation): string {
  if (variation === "digital") {
    return `CONTENT MODE: Digital creating
Focus on the craft of making digital work — design, editing, code, branding, tooling, aesthetics, process reveals.
Angles to rotate across the 6 ideas (never repeat):
- Tool / workflow reveal — a specific step that changes the output
- Before → after craft transformation (raw → polished)
- Aesthetic / mood piece about digital craft
- Common creative mistake + the sharp fix
- Speed vs quality tension ("done ugly" vs intentional)
- Behind-the-scenes of a digital piece being born
- Mini tutorial: one technique, taught fast
- Inspiration → execution gap that creators feel

Hard bias: every idea is about MAKING something digital. Stay in craft/process/aesthetic land.`;
  }

  if (variation === "ads") {
    return `CONTENT MODE: Product advertising / image spots
You write short-form ad & image video concepts for Reels / TikTok / YouTube Shorts.

Overall arc (spread across the 6 ideas so they don't all feel the same):
1. Hook (0–3s) — a blunt scroll-stop claim
2. Proof — numbers, facts, years, tech, social proof
3. Amplify — competitor contrast, emotion, recognition, wins
4. Punch — short conclusion + slogan + CTA when it fits

If an idea is proof-heavy, isolate ONE fact/benefit per concept — don't mash everything into one clip.

Copy rules for titles and hooks:
- Short chopped lines, 3–7 words of energy
- No fluff, no ad clichés ("game-changer", "revolutionary", "unlock your potential")
- Punchline energy; confident, bold, on-point
- Contrast is welcome ("not just X — it's Y")
- Speak as a sharp brand voice, still human — never corporate buzzword soup

Angles to rotate (never repeat):
- Scroll-stop claim about the product's core outcome
- Proof drop (a specific number, result, or proof point)
- Competitor contrast / "most people do X wrong"
- Emotional recognition ("you've been solving this the hard way")
- Transformation / before-after of using the product
- Soft image spot — prestige, silence, brand punch without hard sell

Every idea MUST center the product/offer the user described.`;
  }

  // organic (default)
  return `CONTENT MODE: Organic creator content
Content angles — pick 6 DIFFERENT ones from this list (never repeat):
- "Hot take / controversial opinion" — a bold claim that sparks comments
- "Quick transformation / before-after" — visible change in 15-30 seconds
- "Behind the scenes / process" — show how something is made or done
- "Relatable moment" — "it's not just me, right?" content people tag friends in
- "Myth busting / common mistake" — "stop doing X, do Y instead"
- "Story / personal experience" — a micro-story with a payoff at the end
- "Educational / how-to" — teach one specific thing, fast
- "Trend commentary / reaction" — piggyback on a current conversation
- "Aesthetic / vibe" — visually satisfying, mood-driven, minimal text
- "Challenge / dare" — "can you do X in 10 seconds?"`;
}
