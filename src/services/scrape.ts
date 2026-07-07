import { supabase } from "@/integrations/supabase/client";

export type ScrapeResult = {
  markdown: string;
  title: string | null;
  url: string;
};

export class ScrapeError extends Error {
  code: string;
  constructor(message: string, code = "SCRAPE_FAILED") {
    super(message);
    this.code = code;
  }
}

/**
 * Server-side URL scraper. Bypasses browser CORS + bot-walls via the
 * `scrape-url` Edge Function (Jina Reader proxy).
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const { data, error } = await supabase.functions.invoke("scrape-url", {
    body: { url },
  });

  // Edge function returned a non-2xx — payload still lives on data OR on
  // error.context.response depending on supabase-js version. Try both.
  if (error) {
    let payload: any = data;
    try {
      const resp = (error as any)?.context?.response as Response | undefined;
      if (!payload && resp) payload = await resp.clone().json();
    } catch { /* ignore */ }
    const message = payload?.message || error.message || "Scrape failed";
    throw new ScrapeError(message, payload?.code || "EDGE_ERROR");
  }

  if (!data || data.error || !data.success) {
    throw new ScrapeError(
      data?.message ?? "Scrape returned no content",
      data?.code ?? "SCRAPE_FAILED",
    );
  }

  return {
    markdown: data.markdown as string,
    title: (data.title as string | null) ?? null,
    url: (data.url as string) ?? url,
  };
}
