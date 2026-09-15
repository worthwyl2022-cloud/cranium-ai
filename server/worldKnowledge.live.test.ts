import { describe, expect, it } from "vitest";
import { retrieveWorldKnowledge } from "./worldKnowledge";

describe("Cranium live world knowledge", () => {
  it("retrieves real current news or reference sources", async () => {
    const sources = await retrieveWorldKnowledge("artificial intelligence governance");
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.title.trim().length).toBeGreaterThan(0);
      expect(source.snippet.trim().length).toBeGreaterThan(0);
      expect(["news", "reference"]).toContain(source.kind);
    }
  }, 15000);
});
