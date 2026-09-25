import {
  brotliCompressSync,
  brotliDecompressSync,
  constants as zlibConstants,
} from "node:zlib";
import { createHash } from "node:crypto";

export type MemoryKind =
  | "episodic"
  | "emotional"
  | "preference"
  | "fact"
  | "relationship"
  | "milestone";

export type OfflineMemory = {
  id: string;
  personId: string;
  createdAt: string;
  lastReferencedAt: string;
  kind: MemoryKind;
  content: string;
  emotionalContext?: string[];
  importance: number;
  confidence: number;
  referenceCount: number;
  sourceMessageIds: string[];
};

export type MemoryIndexEntry = Pick<
  OfflineMemory,
  | "id"
  | "personId"
  | "createdAt"
  | "lastReferencedAt"
  | "kind"
  | "importance"
  | "confidence"
  | "referenceCount"
> & { byteLength: number; contentHash: string };

export type MemoryBundle = {
  version: 1;
  personId: string;
  generatedAt: string;
  memories: OfflineMemory[];
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function memorySalience(
  input: Pick<OfflineMemory, "importance" | "confidence" | "referenceCount"> & {
    emotionalIntensity?: number;
    relationshipRelevance?: number;
  }
) {
  const repetition = 1 - Math.exp(-Math.max(0, input.referenceCount) / 3);
  return clamp(
    input.importance * 0.35 +
      input.confidence * 0.15 +
      repetition * 0.15 +
      clamp(input.emotionalIntensity ?? 0) * 0.2 +
      clamp(input.relationshipRelevance ?? 0) * 0.15
  );
}

export function compressMemoryBundle(bundle: MemoryBundle): Buffer {
  const payload = Buffer.from(JSON.stringify(bundle), "utf8");
  return brotliCompressSync(payload, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 5,
    },
  });
}

export function decompressMemoryBundle(payload: Buffer): MemoryBundle {
  const bundle = JSON.parse(
    brotliDecompressSync(payload).toString("utf8")
  ) as MemoryBundle;
  if (bundle.version !== 1)
    throw new Error(
      `Unsupported offline memory version: ${String(bundle.version)}`
    );
  if (!bundle.personId.trim())
    throw new Error("Offline memory bundle personId is required");
  return bundle;
}

export function buildMemoryIndex(
  bundle: MemoryBundle,
  compressedByteLength: number
): MemoryIndexEntry[] {
  return bundle.memories
    .map(memory => ({
      id: memory.id,
      personId: memory.personId,
      createdAt: memory.createdAt,
      lastReferencedAt: memory.lastReferencedAt,
      kind: memory.kind,
      importance: memory.importance,
      confidence: memory.confidence,
      referenceCount: memory.referenceCount,
      byteLength: Buffer.byteLength(JSON.stringify(memory), "utf8"),
      contentHash: createHash("sha256")
        .update(memory.content, "utf8")
        .digest("hex"),
    }))
    .map(entry => ({
      ...entry,
      byteLength: Math.max(
        1,
        Math.round(
          entry.byteLength *
            (compressedByteLength /
              Math.max(1, Buffer.byteLength(JSON.stringify(bundle), "utf8")))
        )
      ),
    }));
}

export function selectOfflineRecall(
  memories: OfflineMemory[],
  limit = 12
): OfflineMemory[] {
  return [...memories]
    .sort((a, b) => {
      const aScore = memorySalience(a);
      const bScore = memorySalience(b);
      if (bScore !== aScore) return bScore - aScore;
      return Date.parse(b.lastReferencedAt) - Date.parse(a.lastReferencedAt);
    })
    .slice(0, Math.max(0, limit));
}

export function mergeMemory(
  existing: OfflineMemory | undefined,
  incoming: OfflineMemory
): OfflineMemory {
  if (!existing) return incoming;
  const sources = Array.from(
    new Set([...existing.sourceMessageIds, ...incoming.sourceMessageIds])
  );
  const emotionalContext = Array.from(
    new Set([
      ...(existing.emotionalContext ?? []),
      ...(incoming.emotionalContext ?? []),
    ])
  );
  return {
    ...existing,
    content:
      incoming.importance >= existing.importance
        ? incoming.content
        : existing.content,
    lastReferencedAt:
      Date.parse(incoming.lastReferencedAt) >=
      Date.parse(existing.lastReferencedAt)
        ? incoming.lastReferencedAt
        : existing.lastReferencedAt,
    kind:
      incoming.importance >= existing.importance
        ? incoming.kind
        : existing.kind,
    emotionalContext,
    importance: Math.max(existing.importance, incoming.importance),
    confidence: Math.max(existing.confidence, incoming.confidence),
    referenceCount: existing.referenceCount + incoming.referenceCount,
    sourceMessageIds: sources,
  };
}
