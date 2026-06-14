import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Wand2, Upload, Zap, Brain, TrendingUp, Quote, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ScriptDNA AI — Turn Research Into Viral Content" },
      { name: "description", content: "Upload screenshots, choose a mood, and generate creator-ready scripts in seconds." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="absolute inset-0 grid-bg pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">ScriptDNA <span className="text-gradient">AI</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/auth" className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition">Sign in</Link>
          <Link to="/auth" className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:scale-105">
            Launch app
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-muted-foreground animate-fade-up">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-violet" />
          </span>
          Powered by next-gen multimodal AI
        </div>
        <h1 className="mt-6 font-display text-5xl sm:text-7xl font-black leading-[1.05] tracking-tighter animate-fade-up" style={{ animationDelay: "60ms" }}>
          Turn Research Into
          <br />
          <span className="text-gradient">Viral Content</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground animate-fade-up" style={{ animationDelay: "120ms" }}>
          Upload screenshots, choose a mood, and generate creator-ready scripts in seconds.
          It's like having a senior content strategist in your pocket.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 animate-fade-up" style={{ animationDelay: "180ms" }}>
          <Link to="/auth" className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-glow transition hover:scale-105">
            Start creating — it's free
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
          <a href="#how" className="rounded-2xl glass px-6 py-3.5 text-base font-medium hover:bg-white/10 transition">
            See how it works
          </a>
        </div>

        {/* Floating preview */}
        <div className="relative mx-auto mt-20 max-w-3xl animate-fade-up" style={{ animationDelay: "260ms" }}>
          <div className="absolute -inset-4 bg-gradient-primary opacity-30 blur-3xl" />
          <div className="relative glass-strong rounded-3xl p-6 shadow-elegant animate-float">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-3 w-3 rounded-full bg-red-500/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <div className="h-3 w-3 rounded-full bg-green-500/70" />
            </div>
            <div className="space-y-3 text-left">
              <div className="rounded-xl bg-white/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-violet mb-1">Hook</div>
                <div className="text-sm">"You're not lazy. You're just running on a 1990s operating system."</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["YouTube Shorts", "60s", "Educational"].map(t => (
                  <div key={t} className="rounded-lg glass px-3 py-2 text-xs text-center text-muted-foreground">{t}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <h2 className="text-center font-display text-4xl sm:text-5xl font-black tracking-tight">Built for serious creators</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">Every output engineered for retention, virality, and your unique voice.</p>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            { icon: Brain, title: "Multimodal intelligence", desc: "Drop in screenshots, articles, or charts. AI reads, analyzes, and synthesizes them all." },
            { icon: Wand2, title: "Creator DNA cloning", desc: "Paste a reference video URL — we decode their hook style, pacing, and energy." },
            { icon: TrendingUp, title: "10 angles per topic", desc: "Hooks, CTAs, titles, thumbnail text — never stare at a blank page again." },
          ].map((f, i) => (
            <div key={f.title} className="group relative glass-strong rounded-2xl p-7 transition hover:scale-[1.02] hover:shadow-glow animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary shadow-glow">
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="mt-5 text-xl font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How */}
      <section id="how" className="relative z-10 mx-auto max-w-5xl px-6 py-24">
        <h2 className="text-center font-display text-4xl sm:text-5xl font-black tracking-tight">From idea to script in <span className="text-gradient">60 seconds</span></h2>
        <div className="mt-14 space-y-6">
          {[
            { n: "01", icon: Upload, title: "Upload your research", desc: "Drag in up to 10 screenshots — tweets, articles, charts, transcripts." },
            { n: "02", icon: Wand2, title: "Pick your vibe", desc: "Choose mood, duration, and platform. Optionally paste a creator reference." },
            { n: "03", icon: Zap, title: "Get the full package", desc: "Hook, script, 10 titles, 5 CTAs, 10 thumbnail texts, virality notes." },
          ].map((s) => (
            <div key={s.n} className="group flex items-start gap-6 rounded-2xl glass-strong p-6 transition hover:shadow-glow">
              <div className="font-display text-5xl font-black text-gradient leading-none">{s.n}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2"><s.icon className="h-5 w-5 text-violet" /><h3 className="text-xl font-bold">{s.title}</h3></div>
                <p className="mt-1 text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <h2 className="text-center font-display text-4xl sm:text-5xl font-black tracking-tight">Creators are shipping faster</h2>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            { q: "I went from 2 scripts a week to 12. The Creator DNA feature is unreal.", a: "Maya R.", t: "1.2M YouTube" },
            { q: "Finally, an AI tool that actually understands hooks. Game-changer.", a: "Devon K.", t: "Shorts creator" },
            { q: "I research, drop screenshots, ship. It's that simple now.", a: "Priya S.", t: "Newsletter & TikTok" },
          ].map((t, i) => (
            <div key={i} className="glass-strong rounded-2xl p-7 animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
              <Quote className="h-6 w-6 text-violet/60" />
              <p className="mt-3 text-base">{t.q}</p>
              <div className="mt-5 text-sm"><div className="font-semibold">{t.a}</div><div className="text-muted-foreground">{t.t}</div></div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-24 text-center">
        <div className="relative overflow-hidden rounded-3xl glass-strong p-12 shadow-elegant">
          <div className="absolute -inset-1 bg-gradient-primary opacity-30 blur-3xl" />
          <div className="relative">
            <h2 className="font-display text-4xl sm:text-5xl font-black tracking-tight">Ready to <span className="text-gradient">go viral</span>?</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Join creators turning research into retention-tested scripts. No credit card needed.</p>
            <Link to="/auth" className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-7 py-4 text-base font-semibold text-primary-foreground shadow-glow transition hover:scale-105">
              Open the workspace <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} ScriptDNA AI — Built for creators.
      </footer>
    </div>
  );
}
