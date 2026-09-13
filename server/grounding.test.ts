import { afterEach, describe, expect, it, vi } from "vitest";
import { formatGroundingContext, getGroundingTargets, retrieveGrounding } from "./grounding";

afterEach(() => vi.unstubAllGlobals());

describe("Cranium GitHub grounding", () => {
  it("prioritizes canonical kernel sources for substrate questions", () => {
    const targets = getGroundingTargets("How does Cranium authority work in the substrate?");
    expect(targets[0]).toMatchObject({ repo: "cranium-kernel", authority: "canonical" });
  });

  it("preserves authority labels in the model context", () => {
    const context = formatGroundingContext([
      {
        repo: "cranium-kernel",
        file: "README.md",
        url: "https://github.com/worthwyl2022-cloud/cranium-kernel/blob/main/README.md",
        authority: "canonical",
        excerpt: "Authority can be acquired only through Cranium.",
      },
    ]);
    expect(context).toContain("AUTHORITY: canonical");
    expect(context).toContain("Authority can be acquired only through Cranium.");
  });

  it("collects readable excerpts and preserves source URLs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("# Cranium\nAuthority is governed.", { status: 200 })));
    const sources = await retrieveGrounding("Explain the Cranium substrate authority model.");
    expect(sources).toHaveLength(3);
    expect(sources[0]?.url).toContain("github.com/worthwyl2022-cloud");
    expect(sources[0]?.excerpt).toContain("Authority is governed");
  });
});
