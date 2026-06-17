import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Sparkles, Upload, X, Settings, LogOut, Loader2, Wand2, ChevronRight,
  Copy, Check, Image as ImageIcon, Zap, FileText, Brain, Plus, Trash2,
  PanelLeftClose, PanelLeftOpen, Youtube, Instagram, Music2, Linkedin, Film,
  Skull, BookOpen, Bolt,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  generateScript, listGenerations, getGeneration, deleteGeneration,
  type Variants,
} from "@/lib/generate.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Workspace — ScriptDNA AI" }] }),
  component: Dashboard,
});

const MOODS = ["Educational","Motivation","Roast","Criticism","Storytelling","Business","Documentary","News","Analytical","Humorous"];
const DURATIONS = ["30 Seconds","60 Seconds","90 Seconds","3 Minutes","5 Minutes","10 Minutes"];
const PLATFORMS = ["YouTube Shorts","Instagram Reels","TikTok","YouTube Long Form","LinkedIn"];

type UploadedImg = { id: string; file: File; preview: string; path?: string; uploading: boolean };

type CreatorDNA = {
  hookStyle: string; storytellingStyle: string; energyLevel: string;
  ctaStyle: string; pacing: string; audienceType: string;
};

type ActiveGen = {
  id: string;
  title: string;
  extractedInsights: string;
  creatorDNA: CreatorDNA | null;
  variants: Variants;
};

type HistoryItem = {
  id: string; title: string; platform: string; duration: string; mood: string;
  created_at: string; status: string;
};

type VariantKey = "roast" | "storytelling" | "punchy";

const VARIANT_META: Record<VariantKey, { label: string; icon: any; color: string; emoji: string }> = {
  roast: { label: "Roast", icon: Skull, color: "from-rose-500 to-orange-500", emoji: "💀" },
  storytelling: { label: "Storytelling", icon: BookOpen, color: "from-violet-500 to-fuchsia-500", emoji: "📖" },
  punchy: { label: "Punchy", icon: Bolt, color: "from-cyan-400 to-blue-500", emoji: "⚡" },
};

function platformIcon(p: string) {
  if (/youtube short/i.test(p)) return Youtube;
  if (/youtube/i.test(p)) return Youtube;
  if (/instagram/i.test(p)) return Instagram;
  if (/tiktok/i.test(p)) return Music2;
  if (/linkedin/i.test(p)) return Linkedin;
  return Film;
}

function groupByDate(items: HistoryItem[]) {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const yesterday = today - 86400000;
  const week = today - 7 * 86400000;
  const month = today - 30 * 86400000;

  const groups: Record<string, HistoryItem[]> = {
    "Today": [], "Yesterday": [], "Previous 7 Days": [], "Previous 30 Days": [], "Older": [],
  };
  for (const it of items) {
    const t = new Date(it.created_at).getTime();
    if (t >= today) groups["Today"].push(it);
    else if (t >= yesterday) groups["Yesterday"].push(it);
    else if (t >= week) groups["Previous 7 Days"].push(it);
    else if (t >= month) groups["Previous 30 Days"].push(it);
    else groups["Older"].push(it);
  }
  return groups;
}

function Dashboard() {
  const navigate = useNavigate();
  const generateFn = useServerFn(generateScript);
  const listFn = useServerFn(listGenerations);
  const getFn = useServerFn(getGeneration);
  const deleteFn = useServerFn(deleteGeneration);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [images, setImages] = useState<UploadedImg[]>([]);
  const [mood, setMood] = useState(MOODS[0]);
  const [duration, setDuration] = useState(DURATIONS[1]);
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [refUrl, setRefUrl] = useState("");
  const [refTranscript, setRefTranscript] = useState("");
  const [showRef, setShowRef] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [active, setActive] = useState<ActiveGen | null>(null);
  const [tab, setTab] = useState<VariantKey>("roast");
  const [dragOver, setDragOver] = useState(false);

  const refreshHistory = useCallback(async () => {
    try {
      const rows = await listFn();
      setHistory(rows as HistoryItem[]);
    } catch (e) {
      console.warn("history load failed", e);
    }
  }, [listFn]);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

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

  function newScript() {
    setActive(null);
    setActiveId(null);
    setImages([]);
    setRefUrl("");
    setRefTranscript("");
    setShowRef(false);
    setTab("roast");
  }

  async function loadHistoryItem(id: string) {
    try {
      setActiveId(id);
      const row: any = await getFn({ data: { id } });
      setActive({
        id: row.id,
        title: row.title,
        extractedInsights: row.extracted_insights ?? "",
        creatorDNA: row.creator_dna ?? null,
        variants: row.variants as Variants,
      });
      if (row.mood) setMood(row.mood);
      if (row.duration) setDuration(row.duration);
      if (row.platform) setPlatform(row.platform);
      if (row.reference_url) setRefUrl(row.reference_url);
      if (row.reference_transcript) setRefTranscript(row.reference_transcript);
      setTab("roast");
      setTimeout(() => document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth" }), 80);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    }
  }

  async function removeHistoryItem(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await deleteFn({ data: { id } });
      setHistory(prev => prev.filter(h => h.id !== id));
      if (activeId === id) newScript();
      toast.success("Deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleGenerate() {
    if (generating) return;
    const ready = images.filter(i => i.path && !i.uploading);
    if (!ready.length && !refTranscript && !refUrl) {
      return toast.error("Add at least one image or reference content");
    }
    if (images.some(i => i.uploading)) return toast.error("Wait for uploads to finish");

    setGenerating(true);
    setActive(null);

    try {
      const data: any = await generateFn({
        data: {
          imagePaths: ready.map(i => i.path!),
          mood, duration, platform,
          referenceUrl: refUrl,
          referenceTranscript: refTranscript,
        },
      });
      setActive(data as ActiveGen);
      setActiveId(data.id);
      setTab("roast");
      toast.success("3 script variants ready ✨");
      await refreshHistory();
      setTimeout(() => document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const grouped = groupByDate(history);

  return (
    <div className="relative min-h-screen flex">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />

      {/* Sidebar */}
      <aside
        className={`relative z-20 shrink-0 border-r border-border/50 backdrop-blur-xl bg-background/70 transition-all duration-300 overflow-hidden
          ${sidebarOpen ? "w-[260px]" : "w-0"}`}
      >
        <div className="h-screen sticky top-0 w-[260px] flex flex-col">
          <div className="p-3 border-b border-border/50">
            <button
              onClick={newScript}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:scale-[1.01] transition"
            >
              <Plus className="h-4 w-4" /> New Script
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
            {history.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                No scripts yet. Generate one to start your history.
              </div>
            )}
            {Object.entries(grouped).map(([group, items]) =>
              items.length > 0 ? (
                <div key={group}>
                  <div className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group}</div>
                  <div className="space-y-0.5">
                    {items.map(item => {
                      const PIcon = platformIcon(item.platform);
                      const isActive = activeId === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => loadHistoryItem(item.id)}
                          className={`group w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition
                            ${isActive ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`}
                        >
                          <PIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          <span className="flex-1 truncate">{item.title || "Untitled"}</span>
                          <span
                            onClick={(e) => removeHistoryItem(item.id, e)}
                            className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-rose-500/20 hover:text-rose-400 transition"
                            role="button"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null
            )}
          </div>

          <div className="p-3 border-t border-border/50 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-xs font-semibold">
              <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-primary shadow-glow">
                <Sparkles className="h-3 w-3 text-primary-foreground" />
              </div>
              ScriptDNA <span className="text-gradient">AI</span>
            </Link>
            <div className="flex items-center gap-1">
              <Link to="/settings" className="rounded-md glass p-1.5 hover:bg-white/10 transition" title="Settings">
                <Settings className="h-3.5 w-3.5" />
              </Link>
              <button onClick={handleSignOut} className="rounded-md glass p-1.5 hover:bg-white/10 transition" title="Sign out">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="relative z-10 flex-1 min-w-0">
        <header className="border-b border-border/50 backdrop-blur-xl bg-background/40">
          <div className="px-6 py-3 flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(s => !s)}
              className="rounded-lg glass p-2 hover:bg-white/10 transition"
              title={sidebarOpen ? "Collapse history" : "Open history"}
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            <div className="text-xs text-muted-foreground truncate">
              {active ? <>Viewing: <span className="text-foreground font-medium">{active.title}</span></> : "New workspace"}
            </div>
          </div>
        </header>

        <main className="px-6 py-8 max-w-6xl mx-auto">
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <section className="space-y-6 min-w-0">
              <div>
                <h1 className="font-display text-3xl font-black tracking-tight">Your creator workspace</h1>
                <p className="mt-1 text-muted-foreground">Drop research → pick a vibe → ship 3 variants.</p>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`relative rounded-3xl border-2 border-dashed p-8 transition-all
                  ${dragOver ? "border-violet bg-violet/5 scale-[1.01]" : "border-border bg-card/30"}`}
              >
                <input
                  type="file" multiple accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={e => e.target.files && handleFiles(e.target.files)}
                  className="absolute inset-0 opacity-0 cursor-pointer" disabled={images.length >= 10}
                />
                <div className="text-center pointer-events-none">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
                    <Upload className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <p className="mt-3 font-semibold">Drop screenshots or click to browse</p>
                  <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP · up to 10 · {images.length}/10</p>
                </div>
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {images.map(img => (
                    <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl glass-strong">
                      <img src={img.preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      {img.uploading && (
                        <div className="absolute inset-0 grid place-items-center bg-background/70">
                          <Loader2 className="h-5 w-5 animate-spin text-violet" />
                        </div>
                      )}
                      <button onClick={() => removeImage(img.id)} className="absolute top-1.5 right-1.5 rounded-full bg-background/80 backdrop-blur p-1 opacity-0 group-hover:opacity-100 transition">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Result section */}
              <div id="result-section">
                {generating && <ResultSkeleton />}
                {!generating && active && <ResultView data={active} tab={tab} setTab={setTab} />}
                {!generating && !active && (
                  <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
                    <Sparkles className="mx-auto h-8 w-8 opacity-40" />
                    <p className="mt-2">Your 3 generated script variants will appear here.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Right settings panel */}
            <aside className="lg:sticky lg:top-20 h-fit space-y-4">
              <div className="glass-strong rounded-2xl p-5">
                <h2 className="font-display text-lg font-bold flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-violet" /> Script settings
                </h2>

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
                  {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating 3 variants...</> : <><Zap className="h-4 w-4" /> Generate scripts</>}
                </button>
              </div>
            </aside>
          </div>
        </main>
      </div>
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

function ResultSkeleton() {
  return (
    <div className="mt-8 space-y-4 animate-pulse">
      <div className="flex gap-2">
        {[0,1,2].map(i => <div key={i} className="h-10 flex-1 rounded-xl bg-white/5" />)}
      </div>
      <div className="glass-strong rounded-2xl p-6 space-y-3">
        <div className="h-5 w-1/3 rounded bg-white/10" />
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="h-4 w-5/6 rounded bg-white/5" />
        <div className="h-4 w-4/6 rounded bg-white/5" />
      </div>
      <div className="glass-strong rounded-2xl p-6 space-y-3">
        <div className="h-5 w-1/4 rounded bg-white/10" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-3.5 rounded bg-white/5" style={{ width: `${60 + (i*5) % 35}%` }} />
        ))}
      </div>
    </div>
  );
}

function ResultView({ data, tab, setTab }: { data: ActiveGen; tab: VariantKey; setTab: (t: VariantKey) => void }) {
  const variant = data.variants[tab];
  const meta = VARIANT_META[tab];

  return (
    <div className="mt-8 space-y-6">
      <div className="animate-fade-up">
        <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs font-medium text-emerald-400">
          <Check className="h-3 w-3" /> 3 variants ready
        </div>
        <h2 className="mt-3 font-display text-3xl font-black tracking-tight">
          Your scripts are <span className="text-gradient">ready</span>
        </h2>
      </div>

      {/* Tab Switcher */}
      <div className="relative grid grid-cols-3 gap-2 p-1.5 rounded-2xl glass-strong">
        {(Object.keys(VARIANT_META) as VariantKey[]).map(key => {
          const m = VARIANT_META[key];
          const isActive = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative z-10 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-300
                ${isActive
                  ? `bg-gradient-to-r ${m.color} text-white shadow-glow scale-[1.02]`
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
            >
              <span className="text-base">{m.emoji}</span>
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Active variant content */}
      <div key={tab} className="space-y-5 animate-fade-up">
        <Card icon={meta.icon} title={`${meta.emoji} ${meta.label} — Title`} delay={0}>
          <div className="flex items-start gap-2">
            <p className="flex-1 text-lg font-bold leading-snug">{variant.title}</p>
            <CopyBtn text={variant.title} />
          </div>
        </Card>

        <Card icon={Zap} title="Hook (first 3 seconds)" delay={60}>
          <div className="flex items-start gap-2">
            <p className="flex-1 text-base font-medium leading-relaxed">{variant.hook}</p>
            <CopyBtn text={variant.hook} />
          </div>
        </Card>

        <Card icon={FileText} title="Full Script" delay={120}>
          <div className="flex items-start gap-2">
            <pre className="flex-1 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">{variant.fullScript}</pre>
            <CopyBtn text={variant.fullScript} />
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-5">
          <Card icon={ImageIcon} title="CTA" delay={180}>
            <div className="flex items-start gap-2">
              <p className="flex-1 text-sm leading-relaxed">{variant.cta}</p>
              <CopyBtn text={variant.cta} />
            </div>
          </Card>

          <Card icon={FileText} title="Key Talking Points" delay={220}>
            <ul className="space-y-2">
              {(variant.talkingPoints ?? []).map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {data.creatorDNA && (
          <Card icon={Brain} title="Creator DNA Analysis" delay={280}>
            <div className="grid sm:grid-cols-2 gap-3">
              {Object.entries(data.creatorDNA).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-white/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-cyan">{k.replace(/([A-Z])/g, " $1").trim()}</div>
                  <div className="mt-1 text-sm">{v as string}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, children, delay = 0 }: any) {
  return (
    <div className="glass-strong rounded-2xl p-5 animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-primary shadow-glow">
          <Icon className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <h3 className="font-display font-bold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}
