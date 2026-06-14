import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Loader2, Key, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — ScriptDNA AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [primaryModel, setPrimaryModel] = useState("");
  const [fallbackModel, setFallbackModel] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setApiKey(data.openrouter_api_key || "");
        setPrimaryModel(data.primary_model || "");
        setFallbackModel(data.fallback_model || "");
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("user_settings").upsert({
        user_id: user.id,
        openrouter_api_key: apiKey || null,
        primary_model: primaryModel || null,
        fallback_model: fallbackModel || null,
      });
      if (error) throw error;
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />

      <header className="relative z-10 border-b border-border/50 backdrop-blur-xl bg-background/60">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to workspace
          </Link>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold">ScriptDNA <span className="text-gradient">AI</span></span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-black tracking-tight">Advanced settings</h1>
        <p className="mt-1 text-muted-foreground">
          By default, ScriptDNA uses the built-in AI gateway — no key needed.
          Override with your own OpenRouter key for custom models.
        </p>

        {loading ? (
          <div className="mt-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-violet" /></div>
        ) : (
          <div className="mt-8 glass-strong rounded-2xl p-7 space-y-5">
            <div className="flex items-center gap-2 text-violet">
              <Key className="h-4 w-4" /> <span className="text-sm font-semibold">OpenRouter override (optional)</span>
            </div>

            <Field label="OpenRouter API Key" hint="Stored privately, only used for your generations.">
              <input
                type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full rounded-xl bg-white/5 border border-border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring font-mono"
              />
            </Field>

            <Field label="Primary Model" hint="e.g. anthropic/claude-3.5-sonnet or google/gemini-2.5-pro">
              <input
                value={primaryModel} onChange={e => setPrimaryModel(e.target.value)}
                placeholder="google/gemini-3-flash-preview (default)"
                className="w-full rounded-xl bg-white/5 border border-border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring font-mono"
              />
            </Field>

            <Field label="Fallback Model" hint="Used automatically if the primary fails.">
              <input
                value={fallbackModel} onChange={e => setFallbackModel(e.target.value)}
                placeholder="google/gemini-2.5-flash (default)"
                className="w-full rounded-xl bg-white/5 border border-border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring font-mono"
              />
            </Field>

            <button
              onClick={save} disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-3 font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.01] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save settings</>}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-semibold">{label}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5 mb-2">{hint}</div>}
      <div className="mt-1">{children}</div>
    </label>
  );
}
