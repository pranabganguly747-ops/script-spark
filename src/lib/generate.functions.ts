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

type GenerateResult = {
  hook: string;
  fullScript: string;
  titles: string[];
  ctas: string[];
  thumbnailTexts: string[];
  contentAngles: { title: string; description: string }[];
  talkingPoints: string[];
  viralitySuggestions: string[];
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
You analyze research material (screenshots/text) and produce viral-ready scripts.

ALWAYS respond with STRICT JSON matching this schema exactly:
{
  "extractedInsights": "string — bullet-style summary of key insights from sources, deduplicated",
  "creatorDNA": null | { "hookStyle": "string", "storytellingStyle": "string", "energyLevel": "string", "ctaStyle": "string", "pacing": "string", "audienceType": "string" },
  "result": {
    "hook": "string — first 3 seconds, retention-engineered",
    "fullScript": "string — complete script with [VISUAL], [B-ROLL], and pacing cues",
    "titles": ["10 distinct title variations"],
    "ctas": ["5 distinct CTA variations"],
    "thumbnailTexts": ["10 short, punchy thumbnail text options"],
    "contentAngles": [{"title":"string","description":"string"}, "...5 angles"],
    "talkingPoints": ["key bullet points"],
    "viralitySuggestions": ["specific actionable virality tactics"]
  }
}

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

    // Load user settings (optional OpenRouter override)
    const { data: settings } = await supabase
      .from("user_settings")
      .select("openrouter_api_key, primary_model, fallback_model")
      .eq("user_id", userId)
      .maybeSingle();

    const useOpenRouter = !!settings?.openrouter_api_key;
    // Both models are FREE on Lovable AI Gateway and multimodal (text + image).
    // gemini-2.5-flash = primary (balanced, very low failure rate)
    // gemini-2.5-flash-lite = fallback (fastest, lowest server load)
    const primaryModel = settings?.primary_model || "google/gemini-2.5-flash";
    const fallbackModel = settings?.fallback_model || "google/gemini-2.5-flash-lite";

    // Create generation row
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
      // Download images from storage via admin client (private bucket)
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
        imageBlocks.length ? `Analyze the ${imageBlocks.length} attached image(s). Extract all text, charts, quotes, ideas. Deduplicate. Identify key insights.` : "No images provided — base script on the reference material above.",
        `Now produce a ${data.duration} ${data.mood} script for ${data.platform}. Be specific, energetic, and engineered for retention.`,
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
        // Custom OpenRouter path
        const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${settings!.openrouter_api_key}`,
          },
          body: JSON.stringify({
            model: primaryModel,
            messages,
            response_format: { type: "json_object" },
          }),
        });
        if (!orRes.ok) {
          // try fallback
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

      // Extract JSON (model sometimes wraps in ```json)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as {
        extractedInsights: string;
        creatorDNA: CreatorDNA | null;
        result: GenerateResult;
      };

      // Persist
      const title = parsed.result.titles?.[0]?.slice(0, 120) || "Untitled Script";
      await supabase
        .from("generations")
        .update({
          status: "ready",
          title,
          extracted_insights: parsed.extractedInsights,
          result: parsed.result as any,
          creator_dna: parsed.creatorDNA as any,
        })
        .eq("id", gen.id);

      return { id: gen.id, ...parsed };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      await supabase
        .from("generations")
        .update({ status: "error", error: msg })
        .eq("id", gen.id);
      throw new Error(msg);
    }
  });
