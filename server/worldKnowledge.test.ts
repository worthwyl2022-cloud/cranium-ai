import { afterEach, describe, expect, it, vi } from "vitest";
import { formatWorldKnowledgeContext, retrieveWorldKnowledge } from "./worldKnowledge";

afterEach(() => vi.unstubAllGlobals());

describe("Cranium world knowledge", () => {
  it("combines current news with reference results", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("wikipedia.org")) {
        return new Response(JSON.stringify({ query: { search: [{ title: "Artificial intelligence", pageid: 1164, snippet: "A reference overview of AI.", timestamp: "2026-09-12T00:00:00Z" }] } }), { status: 200 });
      }
      return new Response("<rss><item><title>AI market update</title><link>https://example.com/ai</link><description>Reported market update.</description><pubDate>Sat, 12 Sep 2026 00:00:00 GMT</pubDate></item></rss>", { status: 200 });
    }));

    const sources = await retrieveWorldKnowledge("artificial intelligence latest");
    expect(sources.map(source => source.kind)).toEqual(["news", "reference"]);
    expect(sources[0]?.domain).toBe("example.com");
  });

  it("formats freshness and source metadata for the model", () => {
    const context = formatWorldKnowledgeContext([{ kind: "news", title: "AI market update", url: "https://example.com/ai", domain: "example.com", snippet: "Reported market update.", publishedAt: "Sat, 12 Sep 2026 00:00:00 GMT" }]);
    expect(context).toContain("TYPE: news");
    expect(context).toContain("PUBLISHED: Sat, 12 Sep 2026 00:00:00 GMT");
  });
});
