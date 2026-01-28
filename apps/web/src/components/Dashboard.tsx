'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import Filters, { DashboardFilters } from '@/components/Filters';
import ProposalsList, { DashboardState } from '@/components/ProposalsList';
import { getProposals } from '@/lib/api';
import type { ProposalWithLabel, ProposalsQuery } from '@/types';

type SortKey =
  | 'updated_desc'
  | 'updated_asc'
  | 'confidence_desc'
  | 'confidence_asc'
  | 'title_asc'
  | 'title_desc';

function safeSort(value: string | null): SortKey {
  const allowed: SortKey[] = [
    'updated_desc',
    'updated_asc',
    'confidence_desc',
    'confidence_asc',
    'title_asc',
    'title_desc',
  ];
  return allowed.includes(value as SortKey) ? (value as SortKey) : 'updated_desc';
}

function safePage(value: string | null): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 1;
  if (num < 1) return 1;
  if (num > 5000) return 5000;
  return Math.floor(num);
}

function bySort(sort: SortKey) {
  return (a: ProposalWithLabel, b: ProposalWithLabel) => {
    const aTime = new Date(a.opdateringsdato).getTime();
    const bTime = new Date(b.opdateringsdato).getTime();
    const aConf = a.label?.confidence ?? -1;
    const bConf = b.label?.confidence ?? -1;

    switch (sort) {
      case 'updated_asc':
        return aTime - bTime;
      case 'confidence_desc':
        return bConf - aConf || bTime - aTime;
      case 'confidence_asc':
        return aConf - bConf || bTime - aTime;
      case 'title_asc':
        return a.titel.localeCompare(b.titel, 'da-DK');
      case 'title_desc':
        return b.titel.localeCompare(a.titel, 'da-DK');
      case 'updated_desc':
      default:
        return bTime - aTime;
    }
  };
}

const PAGE_SIZE = 10;

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [serverProposals, setServerProposals] = useState<ProposalWithLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = safePage(searchParams.get('page'));
  const filters: DashboardFilters = {
    topic: searchParams.get('topic') ?? '',
    q: searchParams.get('q') ?? '',
    sort: safeSort(searchParams.get('sort')),
  };

  const setFilters = (next: Partial<DashboardFilters>) => {
    const params = new URLSearchParams(searchParams.toString());

    // Any scope change resets pagination.
    params.delete('page');
    // These controls were removed from the UI, so keep the URL clean.
    params.delete('type');
    params.delete('limit');

    const merged: DashboardFilters = { ...filters, ...next };

    const setOrDelete = (key: string, value: string) => {
      if (value.trim()) params.set(key, value);
      else params.delete(key);
    };

    setOrDelete('topic', merged.topic);
    setOrDelete('q', merged.q);

    if (merged.sort !== 'updated_desc') params.set('sort', merged.sort);
    else params.delete('sort');

    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : '/', { scroll: false });
  };

  const setPage = (nextPage: number) => {
    const safe = Math.max(1, Math.floor(nextPage));
    const params = new URLSearchParams(searchParams.toString());
    if (safe === 1) params.delete('page');
    else params.set('page', String(safe));
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : '/', { scroll: false });
  };

  const fetchSeq = useRef(0);

  useEffect(() => {
    const load = async () => {
      const seq = (fetchSeq.current += 1);
      setLoading(true);
      setError(null);

      try {
        const offset = (page - 1) * PAGE_SIZE;
        const query: ProposalsQuery = { limit: PAGE_SIZE, offset };
        if (filters.topic.trim()) query.topic = filters.topic.trim();
        if (filters.q.trim()) query.q = filters.q.trim();

        const data = await getProposals(query);
        if (fetchSeq.current !== seq) return;
        setServerProposals(data);
      } catch (err) {
        if (fetchSeq.current !== seq) return;
        setError(err instanceof Error ? err.message : 'Failed to load proposals');
        setServerProposals([]);
      } finally {
        if (fetchSeq.current === seq) setLoading(false);
      }
    };

    load();
  }, [filters.q, filters.topic, page]);

  const topicSuggestions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of serverProposals) {
      for (const t of p.label?.it_topics ?? []) {
        const key = t.trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'da-DK'))
      .slice(0, 24)
      .map(([t]) => t);
  }, [serverProposals]);

  const proposals = useMemo(() => {
    const list = [...serverProposals];
    list.sort(bySort(filters.sort));
    return list;
  }, [filters.sort, serverProposals]);

  const stats = useMemo(() => {
    const total = proposals.length;
    const labeled = proposals.filter((p) => p.label).length;
    const avgConfidence =
      labeled > 0
        ? Math.round(
            (proposals.reduce((acc, p) => acc + (p.label?.confidence ?? 0), 0) / labeled) * 100,
          )
        : 0;

    const topicCounts = new Map<string, number>();
    for (const p of proposals) {
      for (const t of p.label?.it_topics ?? []) {
        topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
      }
    }
    const topTopics = [...topicCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'da-DK'))
      .slice(0, 6);

    return { total, labeled, avgConfidence, topTopics };
  }, [proposals]);

  const dashboardState: DashboardState = useMemo(
    () => ({ proposals, loading, error }),
    [proposals, loading, error],
  );

  const canNextPage = !loading && serverProposals.length === PAGE_SIZE;
  const canPrevPage = page > 1;

  return (
    <main className="min-h-screen">
      <header className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white/55 px-3 py-1.5 text-xs text-[color:var(--muted)] shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur">
              Folketingets forslag • IT-politisk fokus
            </div>
            <h1 className="mt-4 font-[family-name:var(--font-serif)] text-4xl leading-[1.05] tracking-tight text-[color:var(--ink)] sm:text-5xl">
              IT-politisk radar
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--muted)] sm:text-base">
              Et samlet overblik over lov- og beslutningsforslag med betydning for data og digitalisering.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {stats.topTopics.length > 0 ? (
            <>
              <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Emner i denne visning
              </div>
              <div className="h-4 w-px bg-[color:var(--line)]" />
              {stats.topTopics.map(([topic, count]) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setFilters({ topic })}
                  className="group inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white/55 px-3 py-1 text-xs text-[color:var(--ink-2)] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <span className="font-medium">{topic}</span>
                  <span className="rounded-full bg-[color:var(--paper-2)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--muted)]">
                    {count}
                  </span>
                </button>
              ))}
            </>
          ) : (
            <div className="text-sm text-[color:var(--muted)]">
              Tip: skriv et emne (fx “gdpr”, “cyber”, “digitalisering”) for at afgrænse visningen.
            </div>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="lg:sticky lg:top-8 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-auto">
            <Filters value={filters} onChange={setFilters} topicSuggestions={topicSuggestions} />
          </div>
          <ProposalsList
            state={dashboardState}
            page={page}
            pageSize={PAGE_SIZE}
            canPrevPage={canPrevPage}
            canNextPage={canNextPage}
            onPrevPage={() => setPage(page - 1)}
            onNextPage={() => setPage(page + 1)}
          />
        </div>
      </section>
    </main>
  );
}
