import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles, Upload, X, Settings, LogOut, Loader2, Wand2, ChevronRight,
  Copy, Check, Image as ImageIcon, Zap, FileText, Type, Target, Lightbulb, TrendingUp, Brain,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateScript } from "@/lib/generate.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Workspace — ScriptDNA AI" }] }),
  component: Dashboard,
});

const MOODS = ["Educational","Motivation","Roast","Criticism","Storytelling","Business","Documentary","News","Analytical","Humorous"];
const DURATIONS = ["30 Seconds","60 Seconds","90 Seconds","3 Minutes","5 Minutes","10 Minutes"];
const PLATFORMS = ["YouTube Shorts","Instagram Reels","TikTok","YouTube Long Form","LinkedIn"];

type UploadedImg = { id: string; file: File; preview: string; path?: string; uploading: boolean };

type GenResult = {
  id: string;
  extractedInsights: string;
  creatorDNA: null | {
    hookStyle: string; storytellingStyle: string; energyLevel: string;
    ctaStyle: string; pacing: string; audienceType: string;
  };
  result: {
    hook: string;
    fullScript: string;
    titles: string[];
    ctas: string[];
    thumbnailTexts: string[];
    contentAngles: { title: string; description: string }[];
    talkingPoints: string[];
    viralitySuggestions: string[];
  };
};

function Dashboard() {
  const navigate = useNavigate();
  const generateFn = useServerFn(generateScript);

  const [images, setImages] = useState<UploadedImg[]>([]);
  const [mood, setMood] = useState(MOODS[0]);
  const [duration, setDuration] = useState(DURATIONS[1]);
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [refUrl, setRefUrl] = useState("");
  const [refTranscript, setRefTranscript] = useState("");
  const [showRef, setShowRef] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Auto-save settings to localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sdna_settings");
    if (saved) {
      try {
        const s = JSON.parse(saved);
        s.mood && setMood(s.mood);
        s.duration && setDuration(s.duration);
        s.platform && setPlatform(s.platform);
      } catch {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("sdna_settings", JSON.stringify({ mood, duration, platform }));
  }, [mood, duration, platform]);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(f => /^image\/(jpeg|png|webp|jpg)$/i.test(f.type));
    if (!files.length) return toast.error("Only JPG, PNG, or WEBP");
    if (images.length + files.length > 10) return toast.error("Max 10 images");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newOnes: UploadedImg[] = files.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      preview: URL.createObjectURL(f),
      uploading: true,
    }));
    setImages(prev => [...prev, ...newOnes]);

    for (const img of newOnes) {
      const ext = img.file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${img.id}.${ext}`;
      const { error } = await supabase.storage.from("script-uploads").upload(path, img.file, { upsert: false });
      if (error) {
        toast.error(`Upload failed: ${img.file.name}`);
        setImages(prev => prev.filter(i => i.id !== img.id));
      } else {
        setImages(prev => prev.map(i => i.id === img.id ? { ...i, path, uploading: false } : i));
      }
    }
  }, [images.length]);

  const removeImage = async (id: string) => {
    const img = images.find(i => i.id === id);
    if (img?.path) {
      await supabase.storage.from("script-uploads").remove([img.path]);
    }
    setImages(prev => prev.filter(i => i.id !== id));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  async function handleGenerate() {
    if (generating) return;
    const ready = images.filter(i => i.path && !i.uploading);
    if (!ready.length && !refTranscript && !refUrl) {
      return toast.error("Add at least one image or reference content");
    }
    if (images.some(i => i.uploading)) return toast.error("Wait for uploads to finish");

    setGenerating(true);
    setResult(null);
    setProgress(5); setStep("Extracting text from images...");

    const steps = [
      { p: 20, s: "Extracting text from images..." },
      { p: 38, s: "Combining and deduplicating insights..." },
      { p: 55, s: "Identifying key angles..." },
      { p: 72, s: "Analyzing reference material..." },
      { p: 88, s: "Generating your script..." },
    ];
    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        setProgress(steps[stepIdx].p);
        setStep(steps[stepIdx].s);
        stepIdx++;
      }
    }, 1800);

    try {
      const data = await generateFn({
        data: {
          imagePaths: ready.map(i => i.path!),
          mood, duration, platform,
          referenceUrl: refUrl,
          referenceTranscript: refTranscript,
        },
      });
      clearInterval(interval);
      setProgress(100); setStep("Done!");
      setResult(data as GenResult);
      toast.success("Your script is ready ✨");
      // scroll to result
      setTimeout(() => document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      clearInterval(interval);
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />

      <header className="relative z-10 border-b border-border/50 backdrop-blur-xl bg-background/60">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold">ScriptDNA <span className="text-gradient">AI</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/settings" className="rounded-lg glass p-2 hover:bg-white/10 transition" title="Settings">
              <Settings className="h-4 w-4" />
            </Link>
            <button onClick={handleSignOut} className="rounded-lg glass p-2 hover:bg-white/10 transition" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Upload */}
          <section className="space-y-6">
            <div>
              <h1 className="font-display text-3xl font-black tracking-tight">Your creator workspace</h1>
              <p className="mt-1 text-muted-foreground">Drop research → pick a vibe → ship.</p>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`relative rounded-3xl border-2 border-dashed p-10 transition-all
                ${dragOver ? "border-violet bg-violet/5 scale-[1.01]" : "border-border bg-card/30"}
              `}
            >
              <input
                type="file" multiple accept="image/jpeg,image/png,image/webp,image/jpg"
                onChange={e => e.target.files && handleFiles(e.target.files)}
                className="absolute inset-0 opacity-0 cursor-pointer" disabled={images.length >= 10}
              />
              <div className="text-center pointer-events-none">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
                  <Upload className="h-6 w-6 text-primary-foreground" />
                </div>
                <p className="mt-4 font-semibold">Drop screenshots here or click to browse</p>
                <p className="mt-1 text-sm text-muted-foreground">JPG, PNG, WEBP · up to 10 images · {images.length}/10 added</p>
              </div>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map(img => (
                  <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl glass-strong">
                    <img src={img.preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    {img.uploading && (
                      <div className="absolute inset-0 grid place-items-center bg-background/70">
                        <Loader2 className="h-6 w-6 animate-spin text-violet" />
                      </div>
                    )}
                    <button onClick={() => removeImage(img.id)} className="absolute top-2 right-2 rounded-full bg-background/80 backdrop-blur p-1 opacity-0 group-hover:opacity-100 transition">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {images.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                <ImageIcon className="mx-auto h-8 w-8 opacity-40" />
                <p className="mt-2">No images yet — your uploads will appear here as cards.</p>
              </div>
            )}
          </section>

          {/* Settings panel */}
          <aside className="lg:sticky lg:top-6 h-fit space-y-4">
            <div className="glass-strong rounded-2xl p-5">
              <h2 className="font-display text-lg font-bold flex items-center gap-2"><Wand2 className="h-4 w-4 text-violet" /> Script settings</h2>

              <FieldGroup label="Mood">
                <ChipGrid options={MOODS} value={mood} onChange={setMood} />
              </FieldGroup>

              <FieldGroup label="Duration">
                <ChipGrid options={DURATIONS} value={duration} onChange={setDuration} />
              </FieldGroup>

              <FieldGroup label="Platform">
                <ChipGrid options={PLATFORMS} value={platform} onChange={setPlatform} />
              </FieldGroup>

              <button
                onClick={() => setShowRef(s => !s)}
                className="mt-4 flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className={`h-3 w-3 transition ${showRef ? "rotate-90" : ""}`} />
                Reference creator (optional)
              </button>
              {showRef && (
                <div className="mt-3 space-y-2 animate-fade-up">
                  <input
                    value={refUrl} onChange={e => setRefUrl(e.target.value)}
                    placeholder="YouTube video URL"
                    className="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <textarea
                    value={refTranscript} onChange={e => setRefTranscript(e.target.value)}
                    placeholder="Or paste transcript..."
                    rows={4}
                    className="w-full rounded-lg bg-white/5 border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-3.5 font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Zap className="h-4 w-4" /> Generate script</>}
              </button>

              {generating && (
                <div className="mt-4 space-y-2 animate-fade-up">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full bg-gradient-primary transition-all duration-700" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground animate-pulse">{step}</p>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Result */}
        {result && <ResultView id="result-section" data={result} />}
      </main>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function ChipGrid({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition
            ${value === o
              ? "bg-gradient-primary text-primary-foreground shadow-glow"
              : "glass hover:bg-white/10 text-muted-foreground"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast.success("Copied"); setTimeout(() => setCopied(false), 1500); }}
      className="rounded-md glass p-1.5 opacity-60 hover:opacity-100 transition"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function Card({ icon: Icon, title, children, delay = 0 }: any) {
  return (
    <div className="glass-strong rounded-2xl p-6 animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
          <Icon className="h-4 w-4 text-primary-foreground" />
        </div>
        <h3 className="font-display font-bold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ResultView({ id, data }: { id: string; data: GenResult }) {
  const r = data.result;
  return (
    <div id={id} className="mt-16 space-y-6">
      <div className="text-center animate-fade-up">
        <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-emerald-400">
          <Check className="h-3 w-3" /> Generation complete
        </div>
        <h2 className="mt-4 font-display text-4xl font-black tracking-tight">Your script is <span className="text-gradient">ready</span></h2>
      </div>

      {data.creatorDNA && (
        <Card icon={Brain} title="Creator DNA Analysis" delay={50}>
          <div className="grid sm:grid-cols-2 gap-3">
            {Object.entries(data.creatorDNA).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white/5 p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-cyan">{k.replace(/([A-Z])/g, " $1").trim()}</div>
                <div className="mt-1 text-sm">{v}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card icon={Zap} title="Hook" delay={100}>
        <div className="flex items-start gap-2">
          <p className="flex-1 text-lg font-medium leading-relaxed">{r.hook}</p>
          <CopyBtn text={r.hook} />
        </div>
      </Card>

      <Card icon={FileText} title="Full Script" delay={150}>
        <div className="flex items-start gap-2">
          <pre className="flex-1 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">{r.fullScript}</pre>
          <CopyBtn text={r.fullScript} />
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card icon={Type} title="10 Title Variations" delay={200}>
          <ol className="space-y-2">
            {r.titles.map((t, i) => (
              <li key={i} className="group flex items-start gap-2 rounded-lg p-2 hover:bg-white/5 transition">
                <span className="text-xs text-muted-foreground mt-0.5 w-5">{i+1}.</span>
                <span className="flex-1 text-sm">{t}</span>
                <CopyBtn text={t} />
              </li>
            ))}
          </ol>
        </Card>

        <Card icon={Target} title="5 CTAs" delay={250}>
          <ol className="space-y-2">
            {r.ctas.map((t, i) => (
              <li key={i} className="group flex items-start gap-2 rounded-lg p-2 hover:bg-white/5 transition">
                <span className="text-xs text-muted-foreground mt-0.5 w-5">{i+1}.</span>
                <span className="flex-1 text-sm">{t}</span>
                <CopyBtn text={t} />
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card icon={ImageIcon} title="10 Thumbnail Text Options" delay={300}>
        <div className="grid sm:grid-cols-2 gap-2">
          {r.thumbnailTexts.map((t, i) => (
            <div key={i} className="group flex items-center gap-2 rounded-lg bg-white/5 p-3">
              <span className="flex-1 text-sm font-semibold">{t}</span>
              <CopyBtn text={t} />
            </div>
          ))}
        </div>
      </Card>

      <Card icon={Lightbulb} title="5 Content Angles" delay={350}>
        <div className="space-y-3">
          {r.contentAngles.map((a, i) => (
            <div key={i} className="rounded-xl bg-white/5 p-4">
              <div className="font-semibold text-violet">{a.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{a.description}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card icon={FileText} title="Key Talking Points" delay={400}>
          <ul className="space-y-2">
            {r.talkingPoints.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card icon={TrendingUp} title="Virality Suggestions" delay={450}>
          <ul className="space-y-2">
            {r.viralitySuggestions.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
