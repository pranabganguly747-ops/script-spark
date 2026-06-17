import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GenerateInput = z.object({
  imagePaths: z.array(z.string()).max(10),
  mood: z.string().min(1),
  duration: z.string().min(1),
  platform: z.string().min(1),
  referenceUrl: z.string().optional().default(""),
  referenceTranscript: z.string().optional().default(""),
});

export type ScriptVariant = {
  title: string;
  hook: string;
  fullScript: string;
  cta: string;
  talkingPoints: string[];
};

export type Variants = {
  roast: ScriptVariant;
  storytelling: ScriptVariant;
  punchy: ScriptVariant;
};

type CreatorDNA = {
  hookStyle: string;
  storytellingStyle: string;
  energyLevel: string;
  ctaStyle: string;
  pacing: string;
  audienceType: string;
};

const SYSTEM_PROMPT = `You are ScriptDNA — a world-class AI script strategist for top creators (MrBeast, Ali Abdaal, Alex Hormozi calibre).
You analyze research material (screenshots/text) and produce viral-ready scripts in THREE distinct tones simultaneously.

ALWAYS respond with STRICT JSON matching this schema exactly:
{
  "extractedInsights": "string — deduped bullet summary of insights from sources",
  "creatorDNA": null | { "hookStyle": "string", "storytellingStyle": "string", "energyLevel": "string", "ctaStyle": "string", "pacing": "string", "audienceType": "string" },
  "variants": {
    "roast":        { "title": "string", "hook": "string", "fullScript": "string with [VISUAL] cues", "cta": "string", "talkingPoints": ["..."] },
    "storytelling": { "title": "string", "hook": "string", "fullScript": "string with [VISUAL] cues", "cta": "string", "talkingPoints": ["..."] },
    "punchy":       { "title": "string", "hook": "string", "fullScript": "string with [VISUAL] cues", "cta": "string", "talkingPoints": ["..."] }
  }
}

The three variants MUST be highly distinct, not paraphrases of one another:
- roast: 💀 Edgy, funny, sharp, slightly controversial, high-retention. Punchy roasts with bite.
- storytelling: 📖 Hook-driven narrative arc, emotional build-up, characters/scenes/turn.
- punchy: ⚡ Direct, educational, value-packed, no fluff, fast cuts.

Only include creatorDNA if reference material was provided. Otherwise null.
No markdown, no commentary — JSON only.`;

async function callGateway(messages: any[], apiKey: string, model: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI Gateway ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content as string;
}

export const generateScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service not configured");

    const { data: settings } = await supabase
      .from("user_settings")
      .select("openrouter_api_key, primary_model, fallback_model")
      .eq("user_id", userId)
      .maybeSingle();

    const useOpenRouter = !!settings?.openrouter_api_key;
    const primaryModel = settings?.primary_model || "google/gemini-2.5-flash";
    const fallbackModel = settings?.fallback_model || "google/gemini-2.5-flash-lite";

    const { data: gen, error: insErr } = await supabase
      .from("generations")
      .insert({
        user_id: userId,
        mood: data.mood,
        duration: data.duration,
        platform: data.platform,
        reference_url: data.referenceUrl || null,
        reference_transcript: data.referenceTranscript || null,
        image_paths: data.imagePaths,
        status: "processing",
      })
      .select()
      .single();
    if (insErr || !gen) throw new Error(insErr?.message || "Failed to create generation");

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const imageBlocks: any[] = [];
      for (const path of data.imagePaths) {
        const { data: blob, error } = await supabaseAdmin.storage.from("script-uploads").download(path);
        if (error || !blob) continue;
        const buf = Buffer.from(await blob.arrayBuffer());
        const b64 = buf.toString("base64");
        const mime = blob.type || "image/jpeg";
        imageBlocks.push({
          type: "image_url",
          image_url: { url: `data:${mime};base64,${b64}` },
        });
      }

      const userText = [
        `MOOD: ${data.mood}`,
        `DURATION: ${data.duration}`,
        `PLATFORM: ${data.platform}`,
        data.referenceUrl ? `REFERENCE VIDEO URL: ${data.referenceUrl}` : "",
        data.referenceTranscript ? `REFERENCE TRANSCRIPT:\n${data.referenceTranscript.slice(0, 8000)}` : "",
        imageBlocks.length ? `Analyze the ${imageBlocks.length} attached image(s). Extract all text, charts, quotes, ideas. Deduplicate. Identify key insights.` : "No images provided — base scripts on the reference material above.",
        `Now produce THREE distinct ${data.duration} scripts for ${data.platform}: a roast variant, a storytelling variant, and a punchy/informative variant. Each must be unique in voice and structure.`,
      ].filter(Boolean).join("\n\n");

      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            ...imageBlocks,
          ],
        },
      ];

      let raw: string;
      if (useOpenRouter) {
        const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${settings!.openrouter_api_key}`,
          },
          body: JSON.stringify({ model: primaryModel, messages, response_format: { type: "json_object" } }),
        });
        if (!orRes.ok) {
          const fbRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${settings!.openrouter_api_key}`,
            },
            body: JSON.stringify({ model: fallbackModel, messages, response_format: { type: "json_object" } }),
          });
          if (!fbRes.ok) throw new Error(`OpenRouter ${fbRes.status}: ${(await fbRes.text()).slice(0, 300)}`);
          const j = await fbRes.json();
          raw = j.choices?.[0]?.message?.content;
        } else {
          const j = await orRes.json();
          raw = j.choices?.[0]?.message?.content;
        }
      } else {
        try {
          raw = await callGateway(messages, apiKey, primaryModel);
        } catch (err) {
          console.warn("Primary model failed, falling back:", err);
          raw = await callGateway(messages, apiKey, fallbackModel);
        }
      }

      if (!raw) throw new Error("Empty AI response");

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as {
        extractedInsights: string;
        creatorDNA: CreatorDNA | null;
        variants: Variants;
      };

      if (!parsed.variants?.roast || !parsed.variants?.storytelling || !parsed.variants?.punchy) {
        throw new Error("AI returned incomplete variants");
      }

      const title =
        parsed.variants.roast.title?.slice(0, 120) ||
        parsed.variants.storytelling.title?.slice(0, 120) ||
        "Untitled Script";

      await supabase
        .from("generations")
        .update({
          status: "ready",
          title,
          extracted_insights: parsed.extractedInsights,
          variants: parsed.variants as any,
          creator_dna: parsed.creatorDNA as any,
        })
        .eq("id", gen.id);

      return {
        id: gen.id,
        title,
        extractedInsights: parsed.extractedInsights,
        creatorDNA: parsed.creatorDNA,
        variants: parsed.variants,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      await supabase
        .from("generations")
        .update({ status: "error", error: msg })
        .eq("id", gen.id);
      throw new Error(msg);
    }
  });

export const listGenerations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("generations")
      .select("id, title, platform, duration, mood, created_at, status")
      .eq("user_id", userId)
      .eq("status", "ready")
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
      .select("id, title, platform, duration, mood, variants, creator_dna, extracted_insights, reference_url, reference_transcript")
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
