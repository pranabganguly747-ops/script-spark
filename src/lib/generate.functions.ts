import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ==================== Types ====================

export type InteractivePointer = {
  id: number;
  pointer_text: string;
  why_it_matters: string;
  hook_potential: "HIGH" | "MEDIUM";
  category_tag: "STATISTIC" | "CONTRARIAN" | "CASE STUDY" | "TACTICAL STEP" | "QUOTABLE";
  default_checked: boolean;
};

export type ResearchPayload = {
  ui_render_type: "url_research_summary";
  source_metadata: {
    title: string;
    estimated_read_time: string;
    core_thesis: string;
    sentiment_vibe: string;
  };
  interactive_pointers: InteractivePointer[];
  recommended_angle: string;
};

export type CreatorDNA = {
  name?: string;
  hookStyle?: string;
  storytellingStyle?: string;
  energyLevel?: string;
  ctaStyle?: string;
  pacing?: string;
  audienceType?: string;
};

// ==================== Prompts ====================

const STAGE1_SYSTEM = `You are the ScriptDNA research analyst. Ingest raw text and extract verifiable, high-leverage script pointers.

STRICT RULES:
- Never hallucinate. Only extract facts, stats, quotes, and arguments PRESENT in the raw content.
- Never write conversational preambles. Output STRICT JSON matching the schema. No markdown fences, no commentary.
- Extract 5-8 standalone, script-worthy pointers. Mark the top 4 as default_checked=true.

JSON SCHEMA:
{
  "ui_render_type": "url_research_summary",
  "source_metadata": {
    "title": "string",
    "estimated_read_time": "e.g. 4 min read",
    "core_thesis": "strict 2-sentence executive summary",
    "sentiment_vibe": "Analytical & Data-Driven" | "Urgent & Breaking" | "Educational & Tactical" | "Contrarian & Debated" | "Inspiring & Story-Driven"
  },
  "interactive_pointers": [
    {
      "id": 1,
      "pointer_text": "string (<=150 chars, the exact fact/stat/insight)",
      "why_it_matters": "string (<=100 chars, why it retains attention)",
      "hook_potential": "HIGH" | "MEDIUM",
      "category_tag": "STATISTIC" | "CONTRARIAN" | "CASE STUDY" | "TACTICAL STEP" | "QUOTABLE",
      "default_checked": true|false
    }
  ],
  "recommended_angle": "1-sentence recommendation on the most viral narrative framing"
}

If the content is empty/unparseable/paywalled, return: { "error": true, "message": "Unable to extract content. Please ensure the URL is publicly accessible or paste the raw markdown/text directly." }`;

const STAGE2_SYSTEM = `You are ScriptDNA's executive script producer and retention psychologist. Ingest APPROVED pointers only and synthesize a retention-engineered production package that clones the target Creator DNA.

STRICT RULES:
- Ignore any fact not in the approved pointers list.
- Match Creator DNA vocabulary, sentence length, signature hooks, and pacing.
- Insert pattern interrupts every 10-15s for short-form (<=90s) or every 30-45s for long-form (>=3min).
- Output ONLY the exact Markdown structure below. No preambles. No postscript.

# 🧬 SCRIPT DNA PRODUCTION PACKAGE

**Platform:** {platform} | **Target Pacing:** {mood} / {duration} | **Voice Model:** {dnaName}

---

## 🔥 THE HOOK SUITE (First 5 Seconds)

* **Option A (Visual Pattern Interrupt):** "..." + *[Visual: ...] | [SFX: ...]*
* **Option B (The Contrarian Statement):** "..." + *[Visual: ...] | [SFX: ...]*
* **Option C (The Open Curiosity Loop):** "..." + *[Visual: ...] | [SFX: ...]*

---

## 🎬 MASTER TWO-COLUMN PRODUCTION SCRIPT

| Timestamp / Segment | Spoken Dialogue (Cloning Creator DNA Tone) | Visual B-Roll, SFX, On-Screen Text & Cues | Retention Risk & Psychology |
| :--- | :--- | :--- | :--- |
| **0:00 - 0:05** *(Hook)* | ... | *[Visual: ...]* <br> *[SFX: ...]* <br> **[Text Overlay: ...]** | 🟢 **HIGH:** ... |
| ... continue rows covering every approved pointer ... |

---

## 🚀 THE VIRALITY & PACKAGING ENGINE

### 📢 5 High-CTR Title Options
1. **[Curiosity Gap]:** ...
2. **[Negativity / Warning Bias]:** ...
3. **[Extreme Data / Authority]:** ...
4. **[Direct Challenge]:** ...
5. **[FOMO / Time-Sensitive]:** ...

### 🖼️ Thumbnail Wireframe Concepts

* **Concept 1 (High-Contrast Shock):**
  * **Visual Focal Point:** ...
  * **Text Overlay:** "..." (Font style: ...)
  * **Psychological Trigger:** ...
* **Concept 2 (The Data / Proof Point):**
  * **Visual Focal Point:** ...
  * **Text Overlay:** "..."
  * **Psychological Trigger:** ...

### 🎯 Conversion-Optimized CTAs
* **Soft Engagement CTA:** "..."
* **Direct Growth CTA:** "..."
* **Seamless Loop CTA:** "..."`;

// ==================== Gateway helpers ====================

async function callGateway(
  messages: any[],
  apiKey: string,
  model: string,
  jsonMode: boolean,
) {
  const body: any = { model, messages };
  if (jsonMode) body.response_format = { type: "json_object" };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI Gateway ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content as string;
}

async function callWithFailover(messages: any[], apiKey: string, jsonMode: boolean) {
  const primary = "google/gemini-2.5-flash";
  const fallback = "google/gemini-2.5-flash-lite";
  try {
    return await callGateway(messages, apiKey, primary, jsonMode);
  } catch (err) {
    console.warn("Primary model failed, falling back:", err);
    return await callGateway(messages, apiKey, fallback, jsonMode);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; ScriptDNA/1.0; +https://scriptdna.ai/bot)",
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch URL (${res.status})`);
  const html = await res.text();
  return stripHtml(html).slice(0, 20000);
}

// ==================== Stage 1: Analyze ====================

const AnalyzeInput = z.object({
  sourceUrl: z.string().optional().default(""),
  rawText: z.string().optional().default(""),
  images: z.array(z.string()).optional().default([]), // data:image/...;base64,... URLs
  mood: z.string().min(1),
  duration: z.string().min(1),
  platform: z.string().min(1),
});

export const analyzeContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AnalyzeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service not configured");

    if (!data.sourceUrl && !data.rawText) {
      throw new Error("Provide a URL or paste raw content");
    }

    // Gather raw content
    let rawContent = data.rawText.trim();
    if (data.sourceUrl) {
      try {
        const fetched = await fetchUrlText(data.sourceUrl);
        rawContent = rawContent
          ? `${rawContent}\n\n---\n\n[Fetched from ${data.sourceUrl}]\n${fetched}`
          : fetched;
      } catch (err) {
        if (!rawContent) {
          throw new Error(
            `Could not fetch URL. Paste the article text directly. (${
              err instanceof Error ? err.message : "fetch failed"
            })`,
          );
        }
      }
    }

    if (rawContent.length < 40) {
      throw new Error("Not enough content to analyze. Add more text.");
    }

    // Create pending row
    const { data: gen, error: insErr } = await supabase
      .from("generations")
      .insert({
        user_id: userId,
        mood: data.mood,
        duration: data.duration,
        platform: data.platform,
        source_url: data.sourceUrl || null,
        raw_content: rawContent.slice(0, 30000),
        status: "analyzing",
      })
      .select()
      .single();
    if (insErr || !gen) throw new Error(insErr?.message || "Failed to create record");

    try {
      const messages = [
        { role: "system", content: STAGE1_SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `<execution_stage>ANALYZE_URL</execution_stage>\n\n<raw_content>\n${rawContent.slice(
                0,
                18000,
              )}\n</raw_content>`,
            },
          ],
        },
      ];

      const raw = await callWithFailover(messages, apiKey, true);
      if (!raw) throw new Error("Empty AI response");

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

      if (parsed.error) {
        throw new Error(parsed.message || "Content unparseable");
      }

      if (!Array.isArray(parsed.interactive_pointers) || !parsed.source_metadata) {
        throw new Error("AI returned malformed research payload");
      }

      const research = parsed as ResearchPayload;

      await supabase
        .from("generations")
        .update({
          status: "analyzed",
          title: research.source_metadata.title.slice(0, 200),
          research: research as any,
          extracted_insights: research.source_metadata.core_thesis,
        })
        .eq("id", gen.id);

      return { id: gen.id, research };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      await supabase
        .from("generations")
        .update({ status: "error", error: msg })
        .eq("id", gen.id);
      throw new Error(msg);
    }
  });

// ==================== Stage 2: Generate ====================

const GenerateInput = z.object({
  id: z.string().uuid(),
  approvedPointerIds: z.array(z.number()).min(1),
  creatorDna: z
    .object({
      name: z.string().optional(),
      hookStyle: z.string().optional(),
      storytellingStyle: z.string().optional(),
      energyLevel: z.string().optional(),
      ctaStyle: z.string().optional(),
      pacing: z.string().optional(),
      audienceType: z.string().optional(),
    })
    .optional(),
});

export const generateScriptPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service not configured");

    const { data: row, error } = await supabase
      .from("generations")
      .select("id, research, mood, duration, platform")
      .eq("user_id", userId)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.research) throw new Error("Run analysis first");

    const research = row.research as unknown as ResearchPayload;
    let approved = research.interactive_pointers.filter((p) =>
      data.approvedPointerIds.includes(p.id),
    );
    // Fallback per spec: if empty, use default_checked top 3
    if (!approved.length) {
      approved = research.interactive_pointers.filter((p) => p.default_checked).slice(0, 3);
    }

    const dna = data.creatorDna ?? {};
    const dnaBlock = Object.entries(dna).filter(([, v]) => v).length
      ? Object.entries(dna).map(([k, v]) => `${k}: ${v}`).join("\n")
      : "No specific creator provided. Use a versatile, high-retention modern creator voice.";

    const approvedBlock = approved
      .map(
        (p) =>
          `- [${p.category_tag} · ${p.hook_potential}] ${p.pointer_text} — WHY: ${p.why_it_matters}`,
      )
      .join("\n");

    const userMsg = `<execution_stage>GENERATE_SCRIPT</execution_stage>

<creator_dna>
${dnaBlock}
</creator_dna>

<script_parameters>
Mood: ${row.mood}
Duration: ${row.duration}
Platform: ${row.platform}
</script_parameters>

<approved_pointers>
${approvedBlock}
</approved_pointers>

<recommended_angle>${research.recommended_angle}</recommended_angle>

Produce the full production package now using the exact Markdown structure specified.`;

    try {
      const messages = [
        { role: "system", content: STAGE2_SYSTEM },
        { role: "user", content: userMsg },
      ];
      const markdown = await callWithFailover(messages, apiKey, false);
      if (!markdown || markdown.trim().length < 50) throw new Error("Empty AI response");

      await supabase
        .from("generations")
        .update({
          status: "ready",
          approved_pointers: approved as any,
          creator_dna: (dna as any) ?? null,
          package_markdown: markdown,
        })
        .eq("id", data.id);

      return { id: data.id, markdown };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      await supabase
        .from("generations")
        .update({ status: "error", error: msg })
        .eq("id", data.id);
      throw new Error(msg);
    }
  });

// ==================== History ====================

export const listGenerations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("generations")
      .select("id, title, platform, duration, mood, created_at, status")
      .eq("user_id", userId)
      .in("status", ["analyzed", "ready"])
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("generations")
      .select(
        "id, title, platform, duration, mood, research, approved_pointers, creator_dna, package_markdown, source_url, raw_content, status",
      )
      .eq("user_id", userId)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    return row;
  });

export const deleteGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("generations")
      .delete()
      .eq("user_id", userId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
