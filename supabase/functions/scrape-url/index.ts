// Server-side URL scraper proxy powered by Jina Reader (https://r.jina.ai/).
// Bypasses browser CORS + most bot walls, and normalizes errors for the client.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: true, message: "Method not allowed" });
  }

  let payload: { url?: string };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: true, message: "Invalid JSON body" });
  }

  const raw = (payload.url ?? "").trim();
  if (!raw) return json(400, { error: true, message: "Missing url" });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return json(400, {
      error: true,
      code: "INVALID_URL",
      message: "That doesn't look like a valid URL. Include https:// prefix.",
    });
  }
  if (!/^https?:$/.test(target.protocol)) {
    return json(400, {
      error: true,
      code: "INVALID_URL",
      message: "Only http(s) URLs are supported.",
    });
  }

  const host = target.hostname.toLowerCase();

  // 🚫 YouTube guard
  if (host.includes("youtube.com") || host.includes("youtu.be")) {
    return json(400, {
      error: true,
      code: "YOUTUBE_DETECTED",
      message:
        "YouTube URLs detected! Please use our Video Transcriber input or paste a web article URL instead.",
    });
  }

  // 🚫 Google Docs guard — must be public
  if (host.includes("docs.google.com")) {
    const p = target.pathname;
    const isPublished = p.includes("/pub") || target.searchParams.has("pli");
    // We can't fully verify without fetching; give a warning-shaped error if
    // the URL clearly isn't a "published to web" link and Jina fails below.
    // Fall through, but remember the flag to enrich the error message.
    (payload as any).__isGoogleDoc = !isPublished;
  }

  // ⚡ Jina Reader proxy — strips chrome, returns clean markdown
  const jinaUrl = `https://r.jina.ai/${target.toString()}`;
  let upstream: Response;
  try {
    upstream = await fetch(jinaUrl, {
      headers: {
        Accept: "text/plain, application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; ScriptDNA/1.0; +https://scriptdna.ai/bot)",
        "X-Return-Format": "markdown",
      },
    });
  } catch (err) {
    return json(502, {
      error: true,
      code: "PROXY_FETCH_FAILED",
      message:
        "We couldn't reach the reader service. Please paste the raw text or upload a screenshot instead!",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  if (!upstream.ok) {
    const isGoogleDoc = (payload as any).__isGoogleDoc;
    return json(422, {
      error: true,
      code: isGoogleDoc ? "GDOC_PRIVATE" : "SCRAPE_BLOCKED",
      message: isGoogleDoc
        ? "This Google Doc looks private. Open it → File → Share → Publish to Web, or set 'Anyone with the link can view', then try again."
        : "We couldn't bypass the security on this link. Please paste the raw text or upload a screenshot instead!",
      status: upstream.status,
    });
  }

  const markdown = (await upstream.text()).trim();

  if (markdown.length < 100) {
    return json(422, {
      error: true,
      code: "EMPTY_CONTENT",
      message:
        "We couldn't bypass the security on this link. Please paste the raw text or upload a screenshot instead!",
    });
  }

  // Try to peel out a title from the first markdown heading, if present.
  const titleMatch = markdown.match(/^Title:\s*(.+)$/m) ||
    markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim().slice(0, 200) : null;

  return json(200, {
    success: true,
    markdown: markdown.slice(0, 30000),
    title,
    url: target.toString(),
  });
});
