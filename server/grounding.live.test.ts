import { describe, expect, it } from "vitest";
import { retrieveGrounding } from "./grounding";

describe("Cranium live grounding", () => {
  it("retrieves real repository sources", async () => {
    const sources = await retrieveGrounding("Cranium content hub acquisition documentation ecosystem");
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source.url).toMatch(/^https:\/\/github\.com\/worthwyl2022-cloud\//);
      expect(source.excerpt.trim().length).toBeGreaterThan(0);
      expect(["canonical", "supporting", "non-authority"]).toContain(source.authority);
    }
  }, 15000);
});
