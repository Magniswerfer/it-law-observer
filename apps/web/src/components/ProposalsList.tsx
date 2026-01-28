'use client';

import Link from 'next/link';

import type { ProposalWithLabel } from '@/types';

export type DashboardState = {
  proposals: ProposalWithLabel[];
  loading: boolean;
  error: string | null;
};

export default function ProposalsList({
  state,
  page,
  pageSize,
  canPrevPage,
  canNextPage,
  onPrevPage,
  onNextPage,
}: {
  state: DashboardState;
  page: number;
  pageSize: number;
  canPrevPage: boolean;
  canNextPage: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
}) {
  const { proposals, loading, error } = state;

  if (loading) {
    return (
      <div className="rounded-3xl border border-[color:var(--line)] bg-white/55 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="h-5 w-56 rounded bg-black/5" />
          <div className="h-8 w-24 rounded-full bg-black/5" />
        </div>
        <div className="mt-5 space-y-3">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-black/5 bg-white/50 p-4 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 rounded-full bg-black/5" />
                <div className="h-5 w-28 rounded-full bg-black/5" />
                <div className="ml-auto h-4 w-24 rounded bg-black/5" />
              </div>
              <div className="mt-3 h-6 w-11/12 rounded bg-black/5" />
              <div className="mt-2 h-4 w-9/12 rounded bg-black/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-[color:color-mix(in_oklab,var(--rose)_40%,transparent)] bg-[color:color-mix(in_oklab,var(--rose)_10%,white)] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.06)]">
        <div className="text-sm font-medium text-[color:var(--ink)]">Couldn’t load proposals</div>
        <div className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[color:var(--muted)]">
          {error}
        </div>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="rounded-3xl border border-[color:var(--line)] bg-white/55 p-10 text-center shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto max-w-md">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper-2)_65%,white)]">
            <span className="font-[family-name:var(--font-mono)] text-sm text-[color:var(--muted)]">∅</span>
          </div>
          <h3 className="mt-4 font-[family-name:var(--font-serif)] text-2xl tracking-tight text-[color:var(--ink)]">
            No matches
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
            Try clearing “Topic” or “Search”, or jump back a page.
          </p>
        </div>
      </div>
    );
  }

  const pageStart = (page - 1) * pageSize + 1;
  const pageEnd = (page - 1) * pageSize + proposals.length;

  return (
    <div className="rounded-3xl border border-[color:var(--line)] bg-white/55 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur">
      <div className="flex items-center justify-between gap-4 border-b border-[color:var(--line)] px-6 py-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Results</div>
          <h2 className="mt-1 font-[family-name:var(--font-serif)] text-2xl tracking-tight text-[color:var(--ink)]">
            Proposals
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden rounded-full border border-[color:var(--line)] bg-white/60 px-3 py-1.5 font-[family-name:var(--font-mono)] text-xs text-[color:var(--muted)] shadow-sm sm:inline-flex">
            {pageStart}–{pageEnd}
          </div>
          <div className="rounded-full border border-[color:var(--line)] bg-white/60 px-3 py-1.5 font-[family-name:var(--font-mono)] text-xs text-[color:var(--muted)] shadow-sm">
            Page {page}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onPrevPage}
              disabled={!canPrevPage}
              className="rounded-full border border-[color:var(--line)] bg-white/60 px-3 py-1.5 text-xs font-medium text-[color:var(--ink-2)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={onNextPage}
              disabled={!canNextPage}
              className="rounded-full border border-[color:var(--line)] bg-white/60 px-3 py-1.5 text-xs font-medium text-[color:var(--ink-2)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="divide-y divide-[color:var(--line)]">
        {proposals.map((proposal) => (
          <ProposalItem key={proposal.id} proposal={proposal} />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[color:var(--line)] px-6 py-5">
        <div className="text-xs text-[color:var(--muted)]">
          Showing <span className="font-[family-name:var(--font-mono)]">{pageStart}–{pageEnd}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevPage}
            disabled={!canPrevPage}
            className="rounded-full border border-[color:var(--line)] bg-white/60 px-3 py-1.5 text-xs font-medium text-[color:var(--ink-2)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            Prev page
          </button>
          <button
            type="button"
            onClick={onNextPage}
            disabled={!canNextPage}
            className="rounded-full border border-[color:var(--line)] bg-white/60 px-3 py-1.5 text-xs font-medium text-[color:var(--ink-2)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            Next page
          </button>
        </div>
      </div>
    </div>
  );
}

function ProposalItem({ proposal }: { proposal: ProposalWithLabel }) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('da-DK');
  };

  const getTypeLabel = (prefix: 'L' | 'B') => {
    return prefix === 'L' ? 'Lovforslag' : 'Beslutningsforslag';
  };

  const signalTone = !proposal.label
    ? 'bg-black/10'
    : proposal.label.it_relevant
      ? 'bg-[color:var(--teal)]'
      : 'bg-[color:var(--rose)]';

  const confidencePct =
    proposal.label?.confidence != null ? Math.round(proposal.label.confidence * 100) : null;

  const summary =
    proposal.label?.it_summary_da?.trim() ||
    proposal.resume?.trim() ||
    '';

  const mainPdfUrl = proposal.mainPdfUrl ?? proposal.pdfUrls?.[0] ?? null;

  return (
    <div className="group relative overflow-hidden px-6 py-5 transition hover:bg-white/40">
      <div className={`absolute left-0 top-0 h-full w-1.5 ${signalTone}`} />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-white/60 px-2.5 py-1 text-[11px] font-medium text-[color:var(--ink-2)] shadow-sm">
              {getTypeLabel(proposal.nummerprefix as 'L' | 'B')}
            </span>

            <span className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-white/60 px-2.5 py-1 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--muted)] shadow-sm">
              {proposal.nummer}
            </span>

            {proposal.label ? (
              <span
                className={[
                  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm',
                  proposal.label.it_relevant
                    ? 'border-[color:color-mix(in_oklab,var(--teal)_38%,transparent)] bg-[color:color-mix(in_oklab,var(--teal)_12%,white)] text-[color:var(--ink)]'
                    : 'border-[color:color-mix(in_oklab,var(--rose)_38%,transparent)] bg-[color:color-mix(in_oklab,var(--rose)_10%,white)] text-[color:var(--ink)]',
                ].join(' ')}
              >
                {proposal.label.it_relevant ? 'IT relevant' : 'Not IT'}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-white/40 px-2.5 py-1 text-[11px] font-medium text-[color:var(--muted)] shadow-sm">
                Unlabeled
              </span>
            )}

            {proposal.label?.model && (
              <span className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-white/40 px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--muted)] shadow-sm">
                {proposal.label.model}
              </span>
            )}
          </div>

          <h3 className="mt-3 min-w-0">
            <Link
              href={`/proposal/${proposal.id}`}
              className="block font-[family-name:var(--font-serif)] text-xl tracking-tight text-[color:var(--ink)] underline decoration-transparent transition group-hover:decoration-[color:color-mix(in_oklab,var(--teal)_45%,transparent)]"
            >
              {proposal.titel}
            </Link>
          </h3>

          {summary ? (
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
              {summary}
            </p>
          ) : null}

          {proposal.label?.it_topics && proposal.label.it_topics.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {proposal.label.it_topics.slice(0, 4).map((topic) => (
                <span
                  key={topic}
                  className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper-2)_55%,white)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--ink-2)]"
                >
                  {topic}
                </span>
              ))}
              {proposal.label.it_topics.length > 4 ? (
                <span className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-white/40 px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--muted)]">
                  +{proposal.label.it_topics.length - 4}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Updated</div>
          <div className="mt-1 font-[family-name:var(--font-mono)] text-xs text-[color:var(--ink-2)]">
            {formatDate(proposal.opdateringsdato)}
          </div>

          {mainPdfUrl ? (
            <a
              href={mainPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--teal)_38%,transparent)] bg-[color:color-mix(in_oklab,var(--teal)_10%,white)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--ink)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
              title="Open main bill PDF (Folketinget)"
            >
              <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-wide">PDF</span>
              <span aria-hidden className="text-[10px] text-[color:var(--muted)]">
                ↗
              </span>
            </a>
          ) : null}

          {confidencePct != null ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white/60 px-3 py-1.5 shadow-sm">
              <span className={`h-2 w-2 rounded-full ${signalTone}`} />
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--muted)]">
                {confidencePct}%
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
