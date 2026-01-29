import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/auth/server';
import { getLovforslagPage } from '@/lib/adminApi';
import { AdminRowActions } from '@/components/admin/AdminRowActions';
import type { ReactNode } from 'react';

type Tri = 'any' | 'yes' | 'no';

function parseTri(value: unknown): Tri {
  if (value === 'yes' || value === 'no' || value === 'any') return value;
  return 'any';
}

function triToBool(value: Tri): boolean | undefined {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return undefined;
}

function adminHref(opts: {
  page?: number;
  q?: string;
  pdf_link?: Tri;
  pdf_text?: Tri;
  analysis?: Tri;
}) {
  const params = new URLSearchParams();
  if (opts.page && opts.page > 1) params.set('page', String(opts.page));
  if (opts.q) params.set('q', opts.q);
  if (opts.pdf_link && opts.pdf_link !== 'any') params.set('pdf_link', opts.pdf_link);
  if (opts.pdf_text && opts.pdf_text !== 'any') params.set('pdf_text', opts.pdf_text);
  if (opts.analysis && opts.analysis !== 'any') params.set('analysis', opts.analysis);
  const qs = params.toString();
  return qs ? `/admin?${qs}` : '/admin';
}

function hasAnyFilters(filters: { pdf_link: Tri; pdf_text: Tri; analysis: Tri }) {
  return filters.pdf_link !== 'any' || filters.pdf_text !== 'any' || filters.analysis !== 'any';
}

function StatusBadge(props: { state: 'ok' | 'bad' | 'neutral'; children: ReactNode }) {
  const base =
    'inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-[11px] font-medium leading-none shadow-sm';
  const state =
    props.state === 'ok'
      ? 'border-[color:color-mix(in_oklab,var(--ok)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--ok)_12%,white)] text-[color:color-mix(in_oklab,var(--ok)_24%,black)]'
      : props.state === 'bad'
        ? 'border-[color:color-mix(in_oklab,var(--bad)_58%,transparent)] bg-[color:color-mix(in_oklab,var(--bad)_10%,white)] text-[color:color-mix(in_oklab,var(--bad)_30%,black)]'
        : 'border-[color:var(--line)] bg-white/35 text-[color:var(--muted)]';

  const dot =
    props.state === 'ok'
      ? 'bg-[color:var(--ok)]'
      : props.state === 'bad'
        ? 'bg-[color:var(--bad)]'
        : 'bg-black/20';

  return (
    <span className={`${base} ${state}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {props.children}
    </span>
  );
}

function FilterChip(props: { selected: boolean; tone: 'ok' | 'bad' | 'neutral'; children: ReactNode }) {
  const base =
    'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-full border px-3 text-[11px] font-medium shadow-sm transition';
  const tone =
    props.tone === 'ok'
      ? 'border-[color:color-mix(in_oklab,var(--ok)_55%,transparent)] text-[color:color-mix(in_oklab,var(--ok)_30%,black)]'
      : props.tone === 'bad'
        ? 'border-[color:color-mix(in_oklab,var(--bad)_58%,transparent)] text-[color:color-mix(in_oklab,var(--bad)_34%,black)]'
        : 'border-[color:var(--line)] text-[color:var(--ink-2)]';

  const selected =
    props.selected && props.tone === 'ok'
      ? 'bg-[color:color-mix(in_oklab,var(--ok)_12%,white)]'
      : props.selected && props.tone === 'bad'
        ? 'bg-[color:color-mix(in_oklab,var(--bad)_10%,white)]'
        : props.selected
          ? 'bg-white/60'
          : 'bg-white/30 hover:bg-white/55 hover:-translate-y-0.5';

  return <span className={`${base} ${tone} ${selected}`}>{props.children}</span>;
}

export default async function AdminPage(props: {
  searchParams: Promise<{ page?: string; q?: string; pdf_link?: string; pdf_text?: string; analysis?: string }>;
}) {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const sp = await props.searchParams;
  const q = typeof sp.q === 'string' && sp.q.trim() ? sp.q.trim() : undefined;
  const page = Math.max(1, Number(sp.page || '1') || 1);
  const pdfLinkFilter = parseTri(sp.pdf_link);
  const pdfTextFilter = parseTri(sp.pdf_text);
  const analysisFilter = parseTri(sp.analysis);
  const filtersActive = hasAnyFilters({ pdf_link: pdfLinkFilter, pdf_text: pdfTextFilter, analysis: analysisFilter });
  const limit = 100;
  const offset = (page - 1) * limit;

  const rows = await getLovforslagPage({
    limit,
    offset,
    q,
    hasPdfLink: triToBool(pdfLinkFilter),
    hasPdfText: triToBool(pdfTextFilter),
    hasPolicyAnalysis: triToBool(analysisFilter),
  });
  const shown = rows.length;
  const showPagination = page > 1 || shown >= limit;

  return (
    <main className="min-h-screen [--ok:#16a34a] [--bad:#dc2626]">
      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-x-4 top-6 -z-10 h-72 rounded-[42px] bg-[radial-gradient(1200px_280px_at_8%_0%,color-mix(in_oklab,var(--ok)_18%,transparent),transparent_56%),radial-gradient(1000px_280px_at_92%_10%,color-mix(in_oklab,var(--bad)_16%,transparent),transparent_62%),radial-gradient(840px_260px_at_52%_85%,rgba(0,0,0,0.06),transparent_60%)] blur-2xl" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Admin</div>
            <h1 className="mt-2 font-[family-name:var(--font-serif)] text-4xl tracking-tight text-[color:var(--ink)]">
              Lovforslag — redaktionelt overblik
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--ink-2)]">
              Upload PDF én gang per forslag, gem tekst i databasen, og kør policy-analysen når det giver mening.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] bg-white/60 px-4 py-2 text-sm text-[color:var(--ink-2)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
              >
                Log ud
              </button>
            </form>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="rounded-[28px] border border-[color:var(--line)] bg-white/55 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur sm:p-5 lg:self-end">
            <form className="flex flex-col gap-3 sm:flex-row sm:items-center" action="/admin" method="get">
              {pdfLinkFilter !== 'any' ? <input type="hidden" name="pdf_link" value={pdfLinkFilter} /> : null}
              {pdfTextFilter !== 'any' ? <input type="hidden" name="pdf_text" value={pdfTextFilter} /> : null}
              {analysisFilter !== 'any' ? <input type="hidden" name="analysis" value={analysisFilter} /> : null}
              <div className="relative w-full">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--muted)]">
                  q
                </div>
                <input
                  name="q"
                  defaultValue={q || ''}
                  placeholder="Søg i titel, nummer eller resumé…"
                  className="w-full rounded-full border border-[color:var(--line)] bg-white/75 py-1.5 pl-10 pr-4 text-sm text-[color:var(--ink)] shadow-sm outline-none ring-0 focus:border-black/25 focus:bg-white"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5"
              >
                Søg
              </button>
            </form>
          </div>

          <div className="justify-self-start lg:justify-self-end">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Filter</div>
              <div className="flex items-center gap-2">
                <StatusBadge state="neutral">
                  <span className="font-[family-name:var(--font-mono)]">{shown}</span>
                  vist
                </StatusBadge>
                {filtersActive ? (
                  <Link
                    href={adminHref({ q })}
                    className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-full border border-[color:var(--line)] bg-white/35 px-3 text-[11px] font-medium text-[color:var(--ink-2)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white/60"
                    title="Fjern filtre"
                  >
                    Fjern filtre
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">PDF-link</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link href={adminHref({ page: 1, q, pdf_link: 'yes', pdf_text: pdfTextFilter, analysis: analysisFilter })}>
                    <FilterChip selected={pdfLinkFilter === 'yes'} tone="ok">
                      Har
                    </FilterChip>
                  </Link>
                  <Link href={adminHref({ page: 1, q, pdf_link: 'no', pdf_text: pdfTextFilter, analysis: analysisFilter })}>
                    <FilterChip selected={pdfLinkFilter === 'no'} tone="bad">
                      Mangler
                    </FilterChip>
                  </Link>
                </div>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">PDF-tekst</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link href={adminHref({ page: 1, q, pdf_link: pdfLinkFilter, pdf_text: 'yes', analysis: analysisFilter })}>
                    <FilterChip selected={pdfTextFilter === 'yes'} tone="ok">
                      Har
                    </FilterChip>
                  </Link>
                  <Link href={adminHref({ page: 1, q, pdf_link: pdfLinkFilter, pdf_text: 'no', analysis: analysisFilter })}>
                    <FilterChip selected={pdfTextFilter === 'no'} tone="bad">
                      Mangler
                    </FilterChip>
                  </Link>
                </div>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Analyse</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link href={adminHref({ page: 1, q, pdf_link: pdfLinkFilter, pdf_text: pdfTextFilter, analysis: 'yes' })}>
                    <FilterChip selected={analysisFilter === 'yes'} tone="ok">
                      Har
                    </FilterChip>
                  </Link>
                  <Link href={adminHref({ page: 1, q, pdf_link: pdfLinkFilter, pdf_text: pdfTextFilter, analysis: 'no' })}>
                    <FilterChip selected={analysisFilter === 'no'} tone="bad">
                      Mangler
                    </FilterChip>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[34px] border border-[color:var(--line)] bg-white/55 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  <th className="sticky top-0 z-10 bg-[color:color-mix(in_oklab,var(--paper)_84%,white)] px-6 py-4">
                    Nummer
                  </th>
                  <th className="sticky top-0 z-10 bg-[color:color-mix(in_oklab,var(--paper)_84%,white)] px-6 py-4">
                    Status
                  </th>
                  <th className="sticky top-0 z-10 bg-[color:color-mix(in_oklab,var(--paper)_84%,white)] px-6 py-4">
                    Titel
                  </th>
                  <th className="sticky top-0 z-10 bg-[color:color-mix(in_oklab,var(--paper)_84%,white)] px-6 py-4">
                    Handlinger
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const pdfUrl = p.mainPdfUrl ?? p.pdfUrls?.[0] ?? null;
                  const hasPdfLink = Boolean(pdfUrl);
                  const hasPdfText = Boolean(p.pdfText?.extracted_text) && !p.pdfText?.error;
                  const hasAnalysis = Boolean(p.policy?.analysis);
                  const needsAttention = !hasPdfText || !hasAnalysis;

                  return (
                    <tr
                      key={p.id}
                      className={[
                        'group border-t border-[color:var(--line)] transition',
                        needsAttention ? 'bg-[color:color-mix(in_oklab,var(--bad)_4%,transparent)]' : 'bg-transparent',
                        'hover:bg-white/55',
                      ].join(' ')}
                    >
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <div
                            className={[
                              'mt-0.5 h-9 w-1.5 rounded-full opacity-0 transition group-hover:opacity-100',
                              needsAttention ? 'bg-[color:var(--bad)]' : 'bg-[color:var(--ok)]',
                            ].join(' ')}
                          />
                          <div>
                            <Link
                              className="font-[family-name:var(--font-mono)] text-[color:var(--ink)] underline decoration-[color:color-mix(in_oklab,black_25%,transparent)] underline-offset-4"
                              href={`/proposal/${p.id}`}
                            >
                              {p.nummer}
                            </Link>
                            <div className="mt-1 text-[11px] text-[color:var(--muted)]">ID {p.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge state={hasPdfLink ? 'ok' : 'bad'}>PDF-link</StatusBadge>
                          <StatusBadge state={hasPdfText ? 'ok' : 'bad'}>PDF-tekst</StatusBadge>
                          <StatusBadge state={hasAnalysis ? 'ok' : 'bad'}>Analyse</StatusBadge>
                        </div>
                        {p.pdfText?.error ? (
                          <div className="mt-2 text-xs text-[color:color-mix(in_oklab,var(--bad)_85%,black)]">
                            PDF-fejl: {p.pdfText.error}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="max-w-xl text-[color:var(--ink)]">{p.titel}</div>
                        {p.resume ? (
                          <div className="mt-2 line-clamp-2 max-w-xl text-xs leading-relaxed text-[color:var(--muted)]">
                            {p.resume}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <AdminRowActions
                          proposalId={p.id}
                          pdfUrl={pdfUrl}
                          initialHasPdfText={hasPdfText}
                          initialHasPolicy={hasAnalysis}
                        />
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-sm text-[color:var(--muted)]">
                      Ingen resultater.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {showPagination ? (
            <div className="flex items-center justify-between border-t border-[color:var(--line)] px-6 py-4 text-sm">
              <div className="text-[color:var(--muted)]">
                Side {page} (viser {rows.length} rækker)
              </div>
              <div className="flex items-center gap-2">
                <Link
                  aria-disabled={page <= 1}
                  className={[
                    'rounded-full border px-4 py-2 shadow-sm transition',
                    page <= 1
                      ? 'pointer-events-none border-[color:var(--line)] bg-white/30 text-[color:var(--muted)]'
                      : 'border-[color:var(--line)] bg-white/60 text-[color:var(--ink-2)] hover:-translate-y-0.5 hover:bg-white',
                  ].join(' ')}
                  href={adminHref({
                    page: page - 1,
                    q,
                    pdf_link: pdfLinkFilter,
                    pdf_text: pdfTextFilter,
                    analysis: analysisFilter,
                  })}
                >
                  Forrige
                </Link>
                <Link
                  className="rounded-full border border-[color:var(--line)] bg-white/60 px-4 py-2 text-[color:var(--ink-2)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                  href={adminHref({
                    page: page + 1,
                    q,
                    pdf_link: pdfLinkFilter,
                    pdf_text: pdfTextFilter,
                    analysis: analysisFilter,
                  })}
                >
                  Næste
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
