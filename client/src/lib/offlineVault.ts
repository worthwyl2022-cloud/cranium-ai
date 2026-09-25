export type OfflineSyncPolicy = "local-only" | "opt-in-encrypted-sync";

export type PersonalMemoryRecord = {
  id: string;
  personId: string;
  kind: "episodic" | "emotional" | "preference" | "fact" | "relationship" | "milestone";
  content: string;
  emotionalContext: string[];
  importance: number;
  confidence: number;
  referenceCount: number;
  createdAt: string;
  lastReferencedAt: string;
  sourceMessageIds: string[];
};

export type OfflineVaultMetadata = {
  version: 1;
  syncPolicy: OfflineSyncPolicy;
  updatedAt: string;
};

const DB_NAME = "cranium-personal-vault";
const DB_VERSION = 1;
const MEMORY_STORE = "memories";
const META_STORE = "metadata";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function memorySalience(memory: Pick<PersonalMemoryRecord, "importance" | "confidence" | "referenceCount"> & { emotionalIntensity?: number; relationshipRelevance?: number }) {
  const repetition = 1 - Math.exp(-Math.max(0, memory.referenceCount) / 3);
  return clamp(
    memory.importance * 0.35 +
      memory.confidence * 0.15 +
      repetition * 0.15 +
      clamp(memory.emotionalIntensity ?? 0) * 0.2 +
      clamp(memory.relationshipRelevance ?? 0) * 0.15,
  );
}

export function rankOfflineMemories(memories: PersonalMemoryRecord[], limit = 12) {
  return [...memories]
    .sort((a, b) => {
      const scoreA = memorySalience(a);
      const scoreB = memorySalience(b);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return Date.parse(b.lastReferencedAt) - Date.parse(a.lastReferencedAt);
    })
    .slice(0, Math.max(0, limit));
}

export function createMemoryId(personId: string, content: string, createdAt: string) {
  const seed = `${personId}\n${createdAt}\n${content}`;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `mem_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function openVault(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable; Cranium offline vault requires browser storage support."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Unable to open Cranium offline vault"));
    request.onupgradeneeded = () => {
      const db = request.result;
      const memories = db.objectStoreNames.contains(MEMORY_STORE)
        ? request.transaction!.objectStore(MEMORY_STORE)
        : db.createObjectStore(MEMORY_STORE, { keyPath: "id" });
      if (!memories.indexNames.contains("personId")) memories.createIndex("personId", "personId", { unique: false });
      if (!memories.indexNames.contains("lastReferencedAt")) memories.createIndex("lastReferencedAt", "lastReferencedAt", { unique: false });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export class OfflinePersonalVault {
  async put(memory: PersonalMemoryRecord): Promise<void> {
    const db = await openVault();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MEMORY_STORE, "readwrite");
      tx.objectStore(MEMORY_STORE).put(memory);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Unable to store offline memory"));
      tx.onabort = () => reject(tx.error ?? new Error("Offline memory transaction aborted"));
    });
    db.close();
  }

  async putMany(memories: PersonalMemoryRecord[]): Promise<void> {
    const db = await openVault();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MEMORY_STORE, "readwrite");
      const store = tx.objectStore(MEMORY_STORE);
      memories.forEach(memory => store.put(memory));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Unable to store offline memories"));
      tx.onabort = () => reject(tx.error ?? new Error("Offline memory transaction aborted"));
    });
    db.close();
  }

  async get(id: string): Promise<PersonalMemoryRecord | undefined> {
    const db = await openVault();
    const value = await new Promise<PersonalMemoryRecord | undefined>((resolve, reject) => {
      const request = db.transaction(MEMORY_STORE, "readonly").objectStore(MEMORY_STORE).get(id);
      request.onsuccess = () => resolve(request.result as PersonalMemoryRecord | undefined);
      request.onerror = () => reject(request.error ?? new Error("Unable to read offline memory"));
    });
    db.close();
    return value;
  }

  async listPerson(personId: string): Promise<PersonalMemoryRecord[]> {
    const db = await openVault();
    const values = await new Promise<PersonalMemoryRecord[]>((resolve, reject) => {
      const request = db.transaction(MEMORY_STORE, "readonly").objectStore(MEMORY_STORE).index("personId").getAll(personId);
      request.onsuccess = () => resolve(request.result as PersonalMemoryRecord[]);
      request.onerror = () => reject(request.error ?? new Error("Unable to read offline person memories"));
    });
    db.close();
    return values;
  }

  async recall(personId: string, limit = 12): Promise<PersonalMemoryRecord[]> {
    return rankOfflineMemories(await this.listPerson(personId), limit);
  }

  async remove(id: string): Promise<void> {
    const db = await openVault();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MEMORY_STORE, "readwrite");
      tx.objectStore(MEMORY_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Unable to delete offline memory"));
    });
    db.close();
  }

  async clearPerson(personId: string): Promise<void> {
    const memories = await this.listPerson(personId);
    const db = await openVault();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MEMORY_STORE, "readwrite");
      const store = tx.objectStore(MEMORY_STORE);
      memories.forEach(memory => store.delete(memory.id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Unable to clear offline person memory"));
    });
    db.close();
  }

  async getMetadata(): Promise<OfflineVaultMetadata> {
    const db = await openVault();
    const value = await new Promise<OfflineVaultMetadata | undefined>((resolve, reject) => {
      const request = db.transaction(META_STORE, "readonly").objectStore(META_STORE).get("vault");
      request.onsuccess = () => resolve((request.result as { key: string } & OfflineVaultMetadata | undefined));
      request.onerror = () => reject(request.error ?? new Error("Unable to read offline vault metadata"));
    });
    db.close();
    return value ?? { version: 1, syncPolicy: "local-only", updatedAt: new Date().toISOString() };
  }

  async setSyncPolicy(syncPolicy: OfflineSyncPolicy): Promise<void> {
    const db = await openVault();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readwrite");
      tx.objectStore(META_STORE).put({ key: "vault", version: 1, syncPolicy, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Unable to update offline vault policy"));
    });
    db.close();
  }
}
