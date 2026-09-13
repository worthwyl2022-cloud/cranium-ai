export type WorldKnowledgeSource = {
  kind: "news" | "reference";
  title: string;
  url: string;
  domain: string;
  snippet: string;
  publishedAt?: string;
};

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
const tag = (xml: string, name: string) => {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? stripHtml(match[1]) : "";
};

async function wikipediaSearch(query: string): Promise<WorldKnowledgeSource[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`;
    const response = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (!response.ok) return [];
    const payload = (await response.json()) as { query?: { search?: Array<{ title: string; pageid: number; snippet: string; timestamp?: string }> } };
    return (payload.query?.search ?? []).map(item => ({
      kind: "reference" as const,
      title: item.title,
      url: `https://en.wikipedia.org/?curid=${item.pageid}`,
      domain: "wikipedia.org",
      snippet: stripHtml(item.snippet),
      publishedAt: item.timestamp,
    }));
  } catch {
    return [];
  }
}

async function newsSearch(query: string): Promise<WorldKnowledgeSource[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (!response.ok) return [];
    const xml = await response.text();
    return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).slice(0, 5).map(match => {
      const item = match[1];
      const link = tag(item, "link");
      return {
        kind: "news" as const,
        title: tag(item, "title"),
        url: link,
        domain: (() => { try { return new URL(link).hostname.replace(/^www\./, ""); } catch { return "news.google.com"; } })(),
        snippet: tag(item, "description"),
        publishedAt: tag(item, "pubDate"),
      };
    }).filter(source => source.title && source.url);
  } catch {
    return [];
  }
}

export async function retrieveWorldKnowledge(query: string): Promise<WorldKnowledgeSource[]> {
  const [references, news] = await Promise.all([wikipediaSearch(query), newsSearch(query)]);
  return [...news, ...references].slice(0, 8);
}

export function formatWorldKnowledgeContext(sources: WorldKnowledgeSource[]) {
  if (!sources.length) return "";
  return sources.map(source => `TYPE: ${source.kind}\nTITLE: ${source.title}\nDOMAIN: ${source.domain}\nPUBLISHED: ${source.publishedAt ?? "unknown"}\nURL: ${source.url}\nSUMMARY: ${source.snippet}`).join("\n\n---\n\n");
}
