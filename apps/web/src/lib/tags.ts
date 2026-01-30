import type { ProposalWithLabel } from '@/types';

type TagInfo = { label: string; count: number };
export type TagFrequency = Map<string, TagInfo>;

const normalizeTag = (value: string) => value.trim().toLowerCase();

function pushTag(out: string[], value: unknown) {
  if (typeof value === 'string' && value.trim()) out.push(value);
}

export function extractAnalysisTags(analysis: unknown): string[] {
  if (!analysis || typeof analysis !== 'object') return [];

  const out: string[] = [];
  const rawTags = (analysis as Record<string, unknown>).tags;
  if (Array.isArray(rawTags)) {
    for (const item of rawTags) {
      if (typeof item === 'string') {
        out.push(item);
        continue;
      }
      if (item && typeof item === 'object' && 'tag' in item) {
        const tag = (item as Record<string, unknown>).tag;
        if (typeof tag === 'string') out.push(tag);
      }
    }
  }

  if (!out.length) {
    const rawHooks = (analysis as Record<string, unknown>).it_hooks;
    if (Array.isArray(rawHooks)) {
      for (const item of rawHooks) {
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;
        const dataTypes = record.likely_data_types;
        if (Array.isArray(dataTypes)) {
          for (const entry of dataTypes) pushTag(out, entry);
        }
        if (!out.length && 'hook' in record) {
          pushTag(out, record.hook);
        }
      }
    }
  }

  if (!out.length) {
    const rawConcerns = (analysis as Record<string, unknown>).democratic_it_concerns;
    if (Array.isArray(rawConcerns)) {
      for (const item of rawConcerns) {
        if (typeof item === 'string') {
          out.push(item);
          continue;
        }
        if (item && typeof item === 'object' && 'topic' in item) {
          const topic = (item as Record<string, unknown>).topic;
          if (typeof topic === 'string') out.push(topic);
        }
      }
    }
  }

  return out
    .map((tag) => tag.trim())
    .filter((tag) => tag && tag.toLowerCase() !== 'not_applicable');
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
