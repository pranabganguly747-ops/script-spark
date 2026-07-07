import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Sparkles, Settings, LogOut, Loader2, Wand2, ChevronRight,
  Link2, FileText, Plus, Trash2, PanelLeftClose, PanelLeftOpen,
  Youtube, Instagram, Music2, Linkedin, Film, Search, Zap,
  CheckCircle2, Circle, AlertCircle, Copy, Check,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  analyzeContent, generateScriptPackage, listGenerations, getGeneration, deleteGeneration,
  type ResearchPayload, type InteractivePointer, type CreatorDNA,
} from "@/lib/generate.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Workspace — ScriptDNA AI" }] }),
  component: Dashboard,
});

const MOODS = ["Educational","Motivation","Roast","Storytelling","Business","Documentary","Analytical","Humorous"];
const DURATIONS = ["30 Seconds","60 Seconds","90 Seconds","3 Minutes","5 Minutes","10 Minutes"];
const PLATFORMS = ["YouTube Shorts","Instagram Reels","TikTok","YouTube Long Form","LinkedIn"];

const CATEGORY_STYLE: Record<string, string> = {
  "STATISTIC": "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  "CONTRARIAN": "bg-rose-500/15 text-rose-300 border-rose-500/30",
  "CASE STUDY": "bg-violet-500/15 text-violet-300 border-violet-500/30",
  "TACTICAL STEP": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "QUOTABLE": "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

type HistoryItem = { id: string; title: string; platform: string; duration: string; mood: string; created_at: string; status: string };

function platformIcon(p: string) {
  if (/youtube/i.test(p)) return Youtube;
  if (/instagram/i.test(p)) return Instagram;
  if (/tiktok/i.test(p)) return Music2;
  if (/linkedin/i.test(p)) return Linkedin;
  return Film;
}

function groupByDate(items: HistoryItem[]) {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now); const yesterday = today - 86400000;
  const week = today - 7 * 86400000; const month = today - 30 * 86400000;
  const groups: Record<string, HistoryItem[]> = { "Today": [], "Yesterday": [], "Previous 7 Days": [], "Previous 30 Days": [], "Older": [] };
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
  const analyzeFn = useServerFn(analyzeContent);
  const generateFn = useServerFn(generateScriptPackage);
  const listFn = useServerFn(listGenerations);
  const getFn = useServerFn(getGeneration);
  const deleteFn = useServerFn(deleteGeneration);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Stage 1 inputs
  const [inputMode, setInputMode] = useState<"url" | "text">("url");
  const [sourceUrl, setSourceUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [mood, setMood] = useState(MOODS[0]);
  const [duration, setDuration] = useState(DURATIONS[1]);
  const [platform, setPlatform] = useState(PLATFORMS[0]);

  // Creator DNA
  const [showDna, setShowDna] = useState(false);
  const [dna, setDna] = useState<CreatorDNA>({});

  // State
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [research, setResearch] = useState<ResearchPayload | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<number>>(new Set());
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState<string>("");

  const refreshHistory = useCallback(async () => {
    try { setHistory((await listFn()) as HistoryItem[]); }
    catch (e) { console.warn("history load failed", e); }
  }, [listFn]);
  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  function newSession() {
    setActiveId(null);
    setSourceUrl(""); setRawText("");
    setResearch(null); setMarkdown(null);
    setApprovedIds(new Set());
    setTitle("");
  }

  async function loadHistoryItem(id: string) {
    try {
      setActiveId(id);
      const row: any = await getFn({ data: { id } });
      if (row.mood) setMood(row.mood);
      if (row.duration) setDuration(row.duration);
      if (row.platform) setPlatform(row.platform);
      setSourceUrl(row.source_url ?? "");
      setRawText(row.raw_content ?? "");
      setTitle(row.title ?? "");
      if (row.research) {
        const r = row.research as ResearchPayload;
        setResearch(r);
        const defaultIds = new Set<number>(
          (Array.isArray(row.approved_pointers) && row.approved_pointers.length
            ? (row.approved_pointers as InteractivePointer[])
            : r.interactive_pointers.filter(p => p.default_checked)
          ).map(p => p.id),
        );
        setApprovedIds(defaultIds);
      } else setResearch(null);
      if (row.creator_dna) setDna(row.creator_dna);
      setMarkdown(row.package_markdown ?? null);
      setTimeout(() => document.getElementById("workspace-top")?.scrollIntoView({ behavior: "smooth" }), 60);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
  }

  async function removeHistoryItem(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await deleteFn({ data: { id } });
      setHistory(prev => prev.filter(h => h.id !== id));
      if (activeId === id) newSession();
      toast.success("Deleted");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  async function handleAnalyze() {
    if (analyzing) return;
    if (!sourceUrl.trim() && !rawText.trim()) {
      return toast.error("Add a URL or paste some research text");
    }
    setAnalyzing(true); setMarkdown(null); setResearch(null); setApprovedIds(new Set());
    try {
      const res: any = await analyzeFn({
        data: { sourceUrl: sourceUrl.trim(), rawText: rawText.trim(), mood, duration, platform },
      });
      const r = res.research as ResearchPayload;
      setResearch(r);
      setActiveId(res.id);
      setTitle(r.source_metadata.title);
      setApprovedIds(new Set(r.interactive_pointers.filter(p => p.default_checked).map(p => p.id)));
      toast.success(`Extracted ${r.interactive_pointers.length} pointers`);
      refreshHistory();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Analysis failed"); }
    finally { setAnalyzing(false); }
  }

  async function handleGenerate() {
    if (!activeId || !research || generating) return;
    if (approvedIds.size === 0) return toast.error("Check at least one pointer");
    setGenerating(true); setMarkdown(null);
    try {
      const res: any = await generateFn({
        data: { id: activeId, approvedPointerIds: Array.from(approvedIds), creatorDna: dna },
      });
      setMarkdown(res.markdown);
      toast.success("Production package ready ✨");
      refreshHistory();
      setTimeout(() => document.getElementById("package-view")?.scrollIntoView({ behavior: "smooth" }), 80);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Generation failed"); }
    finally { setGenerating(false); }
  }

  function togglePointer(id: number) {
    setApprovedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function copyMarkdown() {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
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
      <aside className={`relative z-20 shrink-0 border-r border-border/50 backdrop-blur-xl bg-background/70 transition-all duration-300 overflow-hidden ${sidebarOpen ? "w-[260px]" : "w-0"}`}>
        <div className="h-screen sticky top-0 w-[260px] flex flex-col">
          <div className="p-3 border-b border-border/50">
            <button onClick={newSession} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:scale-[1.01] transition">
              <Plus className="h-4 w-4" /> New Script
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
            {history.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">No scripts yet.</div>
            )}
            {Object.entries(grouped).map(([group, items]) => items.length > 0 && (
              <div key={group}>
                <div className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group}</div>
                <div className="space-y-0.5">
                  {items.map(item => {
                    const PIcon = platformIcon(item.platform);
                    const isActive = activeId === item.id;
                    return (
                      <button key={item.id} onClick={() => loadHistoryItem(item.id)}
                        className={`group w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition ${isActive ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`}>
                        <PIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        <span className="flex-1 truncate">{item.title || "Untitled"}</span>
                        {item.status === "analyzed" && <span title="Draft" className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                        <span onClick={(e) => removeHistoryItem(item.id, e)} className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-rose-500/20 hover:text-rose-400 transition" role="button" aria-label="Delete">
                          <Trash2 className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-border/50 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-xs font-semibold">
              <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-primary shadow-glow">
                <Sparkles className="h-3 w-3 text-primary-foreground" />
              </div>
              ScriptDNA <span className="text-gradient">AI</span>
            </Link>
            <div className="flex items-center gap-1">
              <Link to="/settings" className="rounded-md glass p-1.5 hover:bg-white/10 transition" title="Settings"><Settings className="h-3.5 w-3.5" /></Link>
              <button onClick={handleSignOut} className="rounded-md glass p-1.5 hover:bg-white/10 transition" title="Sign out"><LogOut className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="relative z-10 flex-1 min-w-0">
        <header className="border-b border-border/50 backdrop-blur-xl bg-background/40 sticky top-0 z-10">
          <div className="px-6 py-3 flex items-center gap-3">
            <button onClick={() => setSidebarOpen(s => !s)} className="rounded-lg glass p-2 hover:bg-white/10 transition" title={sidebarOpen ? "Collapse history" : "Open history"}>
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            <div className="text-xs text-muted-foreground truncate">
              {title ? <>Viewing: <span className="text-foreground font-medium">{title}</span></> : "New workspace"}
            </div>
          </div>
        </header>

        <main id="workspace-top" className="px-6 py-8 max-w-6xl mx-auto">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <section className="space-y-6 min-w-0">
              <div>
                <h1 className="font-display text-3xl font-black tracking-tight">Research → Script</h1>
                <p className="mt-1 text-muted-foreground">Ingest a source → pick verified pointers → ship a retention-engineered production package.</p>
              </div>

              {/* Stage 1: Source input */}
              <div className="glass-strong rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-primary text-primary-foreground text-xs font-bold shadow-glow">1</span>
                  <h2 className="font-display text-lg font-bold">Source material</h2>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setInputMode("url")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold border transition ${inputMode === "url" ? "bg-white/10 border-violet text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    <Link2 className="h-3.5 w-3.5 inline mr-1.5" /> URL
                  </button>
                  <button onClick={() => setInputMode("text")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold border transition ${inputMode === "text" ? "bg-white/10 border-violet text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    <FileText className="h-3.5 w-3.5 inline mr-1.5" /> Paste text
                  </button>
                </div>
                {inputMode === "url" ? (
                  <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
                    placeholder="https://article-or-blog-post.com/…"
                    className="w-full rounded-lg bg-white/5 border border-border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
                ) : (
                  <textarea value={rawText} onChange={e => setRawText(e.target.value)}
                    placeholder="Paste article body, notes, transcript, or research…"
                    rows={8}
                    className="w-full rounded-lg bg-white/5 border border-border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
                )}
                <button onClick={handleAnalyze} disabled={analyzing}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-border px-4 py-3 font-semibold transition disabled:opacity-60">
                  {analyzing ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing source…</> : <><Search className="h-4 w-4" /> Analyze content</>}
                </button>
              </div>

              {analyzing && <PointerSkeleton />}

              {/* Stage 1 result: pointers */}
              {research && !analyzing && (
                <div className="glass-strong rounded-2xl p-5 space-y-4 animate-fade-up">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-primary text-primary-foreground text-xs font-bold shadow-glow">2</span>
                    <h2 className="font-display text-lg font-bold">Approve pointers</h2>
                    <span className="ml-auto text-xs text-muted-foreground">{approvedIds.size} / {research.interactive_pointers.length} selected</span>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-1.5">{research.source_metadata.sentiment_vibe} · {research.source_metadata.estimated_read_time}</div>
                    <div className="font-display text-base font-bold mb-2">{research.source_metadata.title}</div>
                    <div className="text-sm text-muted-foreground">{research.source_metadata.core_thesis}</div>
                  </div>

                  <div className="space-y-2">
                    {research.interactive_pointers.map(p => {
                      const checked = approvedIds.has(p.id);
                      return (
                        <button key={p.id} onClick={() => togglePointer(p.id)}
                          className={`w-full text-left rounded-xl border p-3.5 transition ${checked ? "border-violet bg-violet/10" : "border-border bg-white/5 hover:bg-white/10"}`}>
                          <div className="flex gap-3">
                            <div className="pt-0.5">
                              {checked ? <CheckCircle2 className="h-5 w-5 text-violet" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap gap-1.5 mb-1.5">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${CATEGORY_STYLE[p.category_tag] ?? "bg-white/10 border-border"}`}>{p.category_tag}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${p.hook_potential === "HIGH" ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-amber-500/40 bg-amber-500/15 text-amber-300"}`}>
                                  {p.hook_potential} HOOK
                                </span>
                              </div>
                              <div className="text-sm font-medium">{p.pointer_text}</div>
                              <div className="mt-1 text-xs text-muted-foreground italic">Why: {p.why_it_matters}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-violet/30 bg-violet/5 p-3 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-violet shrink-0 mt-0.5" />
                    <div className="text-xs"><span className="font-bold text-violet">Recommended angle: </span><span className="text-muted-foreground">{research.recommended_angle}</span></div>
                  </div>

                  <button onClick={handleGenerate} disabled={generating || approvedIds.size === 0}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-3.5 font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed">
                    {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Producing package…</> : <><Zap className="h-4 w-4" /> Generate script package</>}
                  </button>
                </div>
              )}

              {generating && <PackageSkeleton />}

              {/* Stage 2 result */}
              {markdown && !generating && (
                <div id="package-view" className="glass-strong rounded-2xl p-5 animate-fade-up">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-primary text-primary-foreground text-xs font-bold shadow-glow">3</span>
                    <h2 className="font-display text-lg font-bold">Production package</h2>
                    <button onClick={copyMarkdown} className="ml-auto inline-flex items-center gap-1.5 rounded-lg glass px-3 py-1.5 text-xs font-semibold hover:bg-white/10 transition">
                      {copied ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy MD</>}
                    </button>
                  </div>
                  <article className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:font-bold prose-table:text-xs prose-th:bg-white/5 prose-td:align-top prose-a:text-violet">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
                  </article>
                </div>
              )}

              {!research && !markdown && !analyzing && !generating && (
                <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
                  <Sparkles className="mx-auto h-8 w-8 opacity-40" />
                  <p className="mt-2">Analyze a source above to get verified script pointers.</p>
                </div>
              )}
            </section>

            {/* Right settings panel */}
            <aside className="lg:sticky lg:top-20 h-fit space-y-4">
              <div className="glass-strong rounded-2xl p-5">
                <h2 className="font-display text-lg font-bold flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-violet" /> Script settings
                </h2>
                <FieldGroup label="Mood"><ChipGrid options={MOODS} value={mood} onChange={setMood} /></FieldGroup>
                <FieldGroup label="Duration"><ChipGrid options={DURATIONS} value={duration} onChange={setDuration} /></FieldGroup>
                <FieldGroup label="Platform"><ChipGrid options={PLATFORMS} value={platform} onChange={setPlatform} /></FieldGroup>

                <button onClick={() => setShowDna(s => !s)} className="mt-4 flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                  <ChevronRight className={`h-3 w-3 transition ${showDna ? "rotate-90" : ""}`} />
                  Creator DNA (optional)
                </button>
                {showDna && (
                  <div className="mt-3 space-y-2 animate-fade-up">
                    <DnaInput label="Creator name" value={dna.name} onChange={v => setDna(d => ({ ...d, name: v }))} placeholder="e.g. Alex Hormozi" />
                    <DnaInput label="Hook style" value={dna.hookStyle} onChange={v => setDna(d => ({ ...d, hookStyle: v }))} placeholder="e.g. Direct challenge" />
                    <DnaInput label="Energy level" value={dna.energyLevel} onChange={v => setDna(d => ({ ...d, energyLevel: v }))} placeholder="e.g. High, punchy" />
                    <DnaInput label="Pacing" value={dna.pacing} onChange={v => setDna(d => ({ ...d, pacing: v }))} placeholder="e.g. Fast cuts every 3s" />
                    <DnaInput label="CTA style" value={dna.ctaStyle} onChange={v => setDna(d => ({ ...d, ctaStyle: v }))} placeholder="e.g. Subscribe for weekly" />
                  </div>
                )}
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
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}
function ChipGrid({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)}
          className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${value === o ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow" : "border-border bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}
function DnaInput({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <input value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg bg-white/5 border border-border px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}
function PointerSkeleton() {
  return (
    <div className="glass-strong rounded-2xl p-5 space-y-3 animate-pulse">
      <div className="h-5 w-40 rounded bg-white/10" />
      <div className="h-16 rounded-xl bg-white/5" />
      {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl bg-white/5" />)}
    </div>
  );
}
function PackageSkeleton() {
  return (
    <div className="glass-strong rounded-2xl p-5 space-y-3 animate-pulse">
      <div className="h-6 w-64 rounded bg-white/10" />
      <div className="h-4 w-full rounded bg-white/5" />
      <div className="h-4 w-5/6 rounded bg-white/5" />
      <div className="h-40 rounded-xl bg-white/5" />
      <div className="h-4 w-3/4 rounded bg-white/5" />
    </div>
  );
}
