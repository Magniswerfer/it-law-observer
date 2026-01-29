import type { ProposalWithLabel } from '@/types';

type TagInfo = { label: string; count: number };
export type TagFrequency = Map<string, TagInfo>;

const normalizeTag = (value: string) => value.trim().toLowerCase();

export function extractAnalysisTags(analysis: unknown): string[] {
  if (!analysis || typeof analysis !== 'object') return [];

  const tags = (analysis as Record<string, unknown>).tags;
  if (!Array.isArray(tags)) return [];

  const out: string[] = [];
  for (const item of tags) {
    if (typeof item === 'string') {
      out.push(item);
      continue;
    }
    if (item && typeof item === 'object' && 'tag' in item) {
      const tag = (item as Record<string, unknown>).tag;
      if (typeof tag === 'string') out.push(tag);
    }
  }
  return out.map((tag) => tag.trim()).filter(Boolean);
}

export function extractPolicyTags(policy: ProposalWithLabel['policy']): string[] {
  return extractAnalysisTags(policy?.analysis);
}

export function mergeTags(autoTags: string[] = [], llmTags: string[] = []): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const tag of [...autoTags, ...llmTags]) {
    const cleaned = tag.trim();
    if (!cleaned) continue;
    const key = normalizeTag(cleaned);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(cleaned);
  }

  return merged;
}

export function getMergedProposalTags(proposal: ProposalWithLabel): string[] {
  return mergeTags(proposal.label?.it_topics ?? [], extractPolicyTags(proposal.policy ?? null));
}

export function buildTagFrequency(proposals: ProposalWithLabel[]): TagFrequency {
  const freq: TagFrequency = new Map();

  for (const proposal of proposals) {
    for (const tag of getMergedProposalTags(proposal)) {
      const key = normalizeTag(tag);
      if (!key) continue;
      const existing = freq.get(key);
      if (existing) existing.count += 1;
      else freq.set(key, { label: tag.trim(), count: 1 });
    }
  }

  return freq;
}

export function sortTagsByFrequency(tags: string[], frequency?: TagFrequency): string[] {
  if (!frequency) return tags;
  return [...tags].sort((a, b) => {
    const aCount = frequency.get(normalizeTag(a))?.count ?? 0;
    const bCount = frequency.get(normalizeTag(b))?.count ?? 0;
    if (bCount !== aCount) return bCount - aCount;
    return a.localeCompare(b, 'da-DK');
  });
}

export function topTagsWithCounts(frequency: TagFrequency, limit: number): Array<[string, number]> {
  return [...frequency.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'da-DK'))
    .slice(0, limit)
    .map((entry) => [entry.label, entry.count]);
}

export function topTags(frequency: TagFrequency, limit: number): string[] {
  return topTagsWithCounts(frequency, limit).map(([label]) => label);
}
