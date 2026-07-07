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

If the content is empty/unparseable/paywalled, return: { "error": true, "message": "The provided content was too short or unstructured to extract pointers. Add more text or upload a screenshot." }`;

const STAGE2_SYSTEM = `You are a Lead AI Scripting Engine and an Elite Rhetorical Copywriter. Your output must match the storytelling caliber of Hollywood showrunners and top-tier ad agencies. Your output will be piped directly into a high-performance creator UI; therefore, absolute structural rigidity is mandatory.

[STRICT ARCHITECTURAL DIRECTIVES]

1. ZERO VISUAL CUES: You are strictly forbidden from generating any visual, video, image, graphic, or B-roll directions. No bracketed visual descriptions, no stock-photo suggestions, no "show a map". Focus 100% on verbal auditory copy.

2. NO CONVERSATIONAL LEAK: Do not include introductory text, conversational pleasantries, or concluding explanations (e.g., do not say "Here is your script"). Output ONLY the XML blocks specified below.

3. TYPOGRAPHY AS UI: Inside the dialogue, use UPPERCASE exclusively to dictate vocal punch/inflection. Use ellipses (...) exclusively to mark 1-second retention pauses.

4. DNA FIDELITY: Match the provided Creator DNA vocabulary, sentence length, signature hooks, and pacing. Ignore any fact not in the approved pointers list.

Generate the exact output structure encapsulated in the XML tags below:

<content_brief_layer>

## 🎯 CAMPAIGN INTERFACE BRIEF

* **Core Psychological Hook Type:** [Specify exactly one: e.g., Negative Framing, Closed Loop, Chronological Trap]
* **Audience Retention Strategy:** [1 sentence explaining the psychological lever keeping the viewer watching past second 3]
* **Target Delivery Cadence:** [Specify exact WPM pace, e.g., 145 WPM - Rhythmic, High Inflection]

</content_brief_layer>

<script_architecture_matrix>

## 📑 PRODUCTION SCRIPT BOARD

| SYSTEM BEAT & PURPOSE | PURE SPOKEN DIALOGUE (ELITE COPY) | INFLECTION & BREATH CONTROL |
| :--- | :--- | :--- |
| **ACT I: THE ANCHOR HOOK**<br>*Psychological Entry Point* | "Punchy high-retention opening with UPPERCASE vocal hits... and ellipses for micro-pauses." | **Cadence:** ...<br>**Breathing:** ... |
| **ACT II: THE INTEL ESCALATION**<br>*Building the Conflict* | "Core narrative problem, rhythmic urgency, zero visual suggestions." | **Cadence:** ...<br>**Breathing:** ... |
| **ACT III: THE AUTHORITY PROOF**<br>*The Core Data Payload* | "Undeniable facts, statistics, or core story value establishing absolute credibility." | **Cadence:** ...<br>**Breathing:** ... |
| **ACT IV: THE CONVERSION PIN**<br>*The Psychological CTA* | "Final high-converting CTA. Simple, urgent, absolute." | **Cadence:** ...<br>**Breathing:** ... |

</script_architecture_matrix>

<virality_remix_suite>

## 🏁 RUNTIME REMIX ENGINE

### [THE HOOK ITERATIONS]

* **The Counter-Intuitive Split:** "Alternative opening that breaks common assumptions instantly."
* **The High-Stakes Threat Split:** "Alternative opening framing a massive risk the viewer wants to avoid."

### [THE CTA ITERATIONS]

* **Micro-Conversion Drive:** "Alternative CTA line driving comments/saves for algorithm ranking."
* **Direct Funnel Pull:** "Alternative CTA line driving high-intent link-in-bio clicks."

</virality_remix_suite>`;

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

    if (!data.sourceUrl && !data.rawText && (!data.images || data.images.length === 0)) {
      throw new Error("Provide a URL, paste text, or upload screenshots");
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
        if (!rawContent && (!data.images || data.images.length === 0)) {
          throw new Error(
            `Could not fetch URL. Paste the article text directly. (${
              err instanceof Error ? err.message : "fetch failed"
            })`,
          );
        }
      }
    }

    const hasImages = Array.isArray(data.images) && data.images.length > 0;
    if (!hasImages && rawContent.length < 40) {
      throw new Error("Not enough content to analyze. Add more text or upload screenshots.");
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
        raw_content: (rawContent || (hasImages ? `[${data.images!.length} screenshot(s) provided]` : "")).slice(0, 30000),
        status: "analyzing",
      })
      .select()
      .single();
    if (insErr || !gen) throw new Error(insErr?.message || "Failed to create record");

    try {
      const userContent: any[] = [
        {
          type: "text",
          text: `<execution_stage>ANALYZE_URL</execution_stage>\n\n<raw_content>\n${
            rawContent ? rawContent.slice(0, 18000) : "[No text provided — extract insights from the attached screenshot(s).]"
          }\n</raw_content>`,
        },
      ];
      if (hasImages) {
        for (const img of data.images!) {
          userContent.push({ type: "image_url", image_url: { url: img } });
        }
      }
      const messages = [
        { role: "system", content: STAGE1_SYSTEM },
        { role: "user", content: userContent },
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
