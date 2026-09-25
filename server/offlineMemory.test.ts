import { describe, expect, it } from "vitest";
import {
  buildMemoryIndex,
  compressMemoryBundle,
  decompressMemoryBundle,
  memorySalience,
  mergeMemory,
  selectOfflineRecall,
  type MemoryBundle,
  type OfflineMemory,
} from "./offlineMemory";

const base = (overrides: Partial<OfflineMemory> = {}): OfflineMemory => ({
  id: "memory-1",
  personId: "person-1",
  createdAt: "2026-09-25T00:00:00.000Z",
  lastReferencedAt: "2026-09-25T00:00:00.000Z",
  kind: "episodic",
  content: "A meaningful conversation that should remain available offline.",
  emotionalContext: ["relief", "trust"],
  importance: 0.8,
  confidence: 0.95,
  referenceCount: 2,
  sourceMessageIds: ["msg-1"],
  ...overrides,
});

const bundle: MemoryBundle = {
  version: 1,
  personId: "person-1",
  generatedAt: "2026-09-25T00:00:00.000Z",
  memories: [base()],
};

describe("offline personal memory", () => {
  it("round-trips compressed memory without a server", () => {
    const compressed = compressMemoryBundle(bundle);
    const restored = decompressMemoryBundle(compressed);
    expect(restored).toEqual(bundle);
    expect(compressed.byteLength).toBeLessThan(
      Buffer.byteLength(JSON.stringify(bundle), "utf8")
    );
  });

  it("preserves emotional context as first-class memory data", () => {
    const restored = decompressMemoryBundle(compressMemoryBundle(bundle));
    expect(restored.memories[0]?.emotionalContext).toEqual(["relief", "trust"]);
  });

  it("ranks emotionally salient and important memories for offline recall", () => {
    const ordinary = base({
      id: "ordinary",
      importance: 0.3,
      emotionalContext: [],
      referenceCount: 0,
    });
    const emotionallyImportant = base({
      id: "important",
      importance: 0.95,
      emotionalContext: ["grief", "love"],
      referenceCount: 8,
    });
    expect(
      selectOfflineRecall([ordinary, emotionallyImportant], 1)[0]?.id
    ).toBe("important");
    expect(memorySalience(emotionallyImportant)).toBeGreaterThan(
      memorySalience(ordinary)
    );
  });

  it("merges repeated memories without discarding emotional context", () => {
    const merged = mergeMemory(
      base({ referenceCount: 2, emotionalContext: ["trust"] }),
      base({
        importance: 0.9,
        referenceCount: 3,
        emotionalContext: ["love"],
        sourceMessageIds: ["msg-2"],
      })
    );
    expect(merged.referenceCount).toBe(5);
    expect(merged.emotionalContext).toEqual(["trust", "love"]);
    expect(merged.sourceMessageIds).toEqual(["msg-1", "msg-2"]);
  });

  it("builds a compact local index for fast recall", () => {
    const compressed = compressMemoryBundle(bundle);
    const index = buildMemoryIndex(bundle, compressed.byteLength);
    expect(index).toHaveLength(1);
    expect(index[0]?.personId).toBe("person-1");
    expect(index[0]?.contentHash).toHaveLength(64);
  });
});
