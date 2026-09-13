export type GroundingSource = {
  repo: string;
  file: string;
  url: string;
  authority: "canonical" | "supporting" | "non-authority";
  excerpt: string;
};

type GroundingTarget = Omit<GroundingSource, "excerpt"> & { keywords: string[] };

const targets: GroundingTarget[] = [
  {
    repo: "cranium-kernel",
    file: "README.md",
    url: "https://github.com/worthwyl2022-cloud/cranium-kernel/blob/main/README.md",
    authority: "canonical",
    keywords: ["cranium", "kernel", "substrate", "authority", "canonical", "governance", "worthwyl"],
  },
  {
    repo: "cranium-canonlane-contracts",
    file: "README.md",
    url: "https://github.com/worthwyl2022-cloud/cranium-canonlane-contracts/blob/main/README.md",
    authority: "canonical",
    keywords: ["canonlane", "contract", "semantic", "conformance", "governance", "cranium"],
  },
  {
    repo: "cranium-synapse",
    file: "README.md",
    url: "https://github.com/worthwyl2022-cloud/cranium-synapse/blob/main/README.md",
    authority: "supporting",
    keywords: ["synapse", "evidence", "attestation", "trust", "ring", "proof"],
  },
  {
    repo: "cranium-cognitive-core",
    file: "README.md",
    url: "https://github.com/worthwyl2022-cloud/cranium-cognitive-core/blob/main/README.md",
    authority: "supporting",
    keywords: ["cognitive", "memory", "research", "data model", "reasoning"],
  },
  {
    repo: "cranium-operator-os",
    file: "README.md",
    url: "https://github.com/worthwyl2022-cloud/cranium-operator-os/blob/main/README.md",
    authority: "supporting",
    keywords: ["operator", "creative", "workflow", "metacognition", "worthwyl", "memory"],
  },
  {
    repo: "cranium-provider-integrations",
    file: "README.md",
    url: "https://github.com/worthwyl2022-cloud/cranium-provider-integrations/blob/main/README.md",
    authority: "non-authority",
    keywords: ["provider", "model", "anthropic", "perplexity", "routing", "integration"],
  },
  {
    repo: "cranium-substrate-reference",
    file: "README.md",
    url: "https://github.com/worthwyl2022-cloud/cranium-substrate-reference/blob/main/README.md",
    authority: "supporting",
    keywords: ["reference", "epistemic", "substrate", "cognition", "source"],
  },
];

export function getGroundingTargets(query: string, limit = 3): GroundingTarget[] {
  const normalized = query.toLowerCase();
  const scored = targets.map((target, index) => ({
    target,
    score: target.keywords.reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0),
    index,
  }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const matched = scored.filter(item => item.score > 0).slice(0, limit).map(item => item.target);
  return matched.length ? matched : targets.slice(0, limit);
}

const rawUrl = (repo: string, file: string) => `https://raw.githubusercontent.com/worthwyl2022-cloud/${repo}/main/${file}`;

export async function retrieveGrounding(query: string): Promise<GroundingSource[]> {
  const selected = getGroundingTargets(query);
  const results = await Promise.all(
    selected.map(async target => {
      try {
        const response = await fetch(rawUrl(target.repo, target.file), {
          headers: { Accept: "text/plain" },
          signal: AbortSignal.timeout(4500),
        });
        if (!response.ok) return null;
        const text = (await response.text()).replace(/\u0000/g, "").trim();
        if (!text) return null;
        const { keywords: _keywords, ...sourceMeta } = target;
        return { ...sourceMeta, excerpt: text.slice(0, 4500) } satisfies GroundingSource;
      } catch {
        return null;
      }
    })
  );
  return results.filter((source): source is GroundingSource => Boolean(source));
}

export function formatGroundingContext(sources: GroundingSource[]) {
  if (!sources.length) return "";
  return sources
    .map(source => `SOURCE: ${source.repo}/${source.file}\nAUTHORITY: ${source.authority}\nURL: ${source.url}\nEXCERPT:\n${source.excerpt}`)
    .join("\n\n---\n\n");
}
