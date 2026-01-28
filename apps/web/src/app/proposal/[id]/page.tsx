import { getProposal } from '@/lib/api';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const proposal = await getProposal(parseInt(id));
    return {
      title: `${proposal.nummer} - ${proposal.titel}`,
      description: proposal.resume || proposal.titel,
    };
  } catch {
    return {
      title: 'Proposal Not Found',
    };
  }
}

export default async function ProposalPage({ params }: PageProps) {
  const { id } = await params;
  const proposalId = parseInt(id);

  if (isNaN(proposalId)) {
    notFound();
  }

  try {
    const proposal = await getProposal(proposalId);

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('da-DK', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const getTypeLabel = (prefix: 'L' | 'B') => {
      return prefix === 'L' ? 'Lovforslag' : 'Beslutningsforslag';
    };

    const toneBar = !proposal.label
      ? 'bg-black/10'
      : proposal.label.it_relevant
        ? 'bg-[color:var(--teal)]'
        : 'bg-[color:var(--rose)]';

    const confidencePct =
      proposal.label?.confidence != null ? Math.round(proposal.label.confidence * 100) : null;

    const mainPdfUrl = proposal.mainPdfUrl ?? proposal.pdfUrls?.[0] ?? null;

    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white/55 px-4 py-2 text-sm text-[color:var(--ink-2)] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
            >
              <span className="font-[family-name:var(--font-mono)] text-xs">←</span>
              Back to radar
            </Link>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-[color:var(--line)] bg-white/55 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur sm:p-8">
            <div className={`absolute left-0 top-0 h-full w-1.5 ${toneBar}`} />

            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
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
                </div>

                <h1 className="mt-4 font-[family-name:var(--font-serif)] text-3xl leading-[1.08] tracking-tight text-[color:var(--ink)] sm:text-4xl">
                  {proposal.titel}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[color:var(--muted)]">
                  <div>
                    <span className="font-[family-name:var(--font-mono)]">ID</span> {proposal.id}
                  </div>
                  <div>
                    <span className="font-[family-name:var(--font-mono)]">Periode</span> {proposal.periodeid}
                  </div>
                  <div>
                    <span className="font-[family-name:var(--font-mono)]">Nummer</span> {proposal.nummernumerisk}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[color:var(--line)] bg-white/60 px-4 py-3 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Updated</div>
                <div className="mt-1 font-[family-name:var(--font-mono)] text-xs text-[color:var(--ink-2)]">
                  {formatDate(proposal.opdateringsdato)}
                </div>
                {confidencePct != null ? (
                  <div className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[color:var(--muted)]">
                    Confidence {confidencePct}%
                  </div>
                ) : null}

                {mainPdfUrl ? (
                  <a
                    href={mainPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--teal)_38%,transparent)] bg-[color:color-mix(in_oklab,var(--teal)_10%,white)] px-3 py-2 text-xs font-medium text-[color:var(--ink)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                    title="Open main bill PDF (Folketinget)"
                  >
                    <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-wide">Open PDF</span>
                    <span aria-hidden className="text-[11px] text-[color:var(--muted)]">
                      ↗
                    </span>
                  </a>
                ) : (
                  <div className="mt-3 text-xs text-[color:var(--muted)]">No PDF found yet.</div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
            <article className="space-y-6">
              <section className="rounded-3xl border border-[color:var(--line)] bg-white/55 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Official resume</div>
                {proposal.resume ? (
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[color:var(--ink-2)]">
                    {proposal.resume}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-[color:var(--muted)]">No official resume available.</p>
                )}
              </section>

              <section className="rounded-3xl border border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper-2)_55%,white)] p-6">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Reading notes</div>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                  <li>
                    Look for <span className="font-medium">obligations</span>, <span className="font-medium">data flows</span>, and{' '}
                    <span className="font-medium">enforcement</span> — they often carry the real IT-policy impact.
                  </li>
                  <li>
                    If the “IT lens” is based on keyword matching, topics often represent the matched terms directly.
                  </li>
                </ul>
              </section>
            </article>

            <aside className="lg:sticky lg:top-8">
              {proposal.label ? (
                <div className="rounded-3xl border border-[color:var(--line)] bg-white/55 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">IT lens</div>
                      <div className="mt-1 font-[family-name:var(--font-serif)] text-2xl tracking-tight text-[color:var(--ink)]">
                        {proposal.label.it_relevant ? 'Flagged' : 'Not flagged'}
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white/60 px-3 py-1.5 shadow-sm">
                      <span className={`h-2 w-2 rounded-full ${toneBar}`} />
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--muted)]">
                        {confidencePct != null ? `${confidencePct}%` : 'n/a'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 rounded-2xl border border-[color:var(--line)] bg-white/50 p-4">
                    <MetaRow label="Model" value={proposal.label.model ?? 'N/A'} />
                    <MetaRow label="Prompt" value={proposal.label.prompt_version ?? 'N/A'} />
                    <MetaRow label="Label created" value={formatDate(proposal.label.created_at)} />
                  </div>

                  <div className="mt-5">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Topics</div>
                    {proposal.label.it_topics?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {proposal.label.it_topics.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper-2)_55%,white)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--ink-2)]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-[color:var(--muted)]">No topics stored.</p>
                    )}
                  </div>

                  {proposal.label.it_summary_da ? (
                    <div className="mt-6">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">IT summary</div>
                      <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                        {proposal.label.it_summary_da}
                      </p>
                    </div>
                  ) : null}

                  {proposal.label.why_it_relevant_da ? (
                    <div className="mt-6">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Rationale</div>
                      <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                        {proposal.label.why_it_relevant_da}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-3xl border border-[color:color-mix(in_oklab,var(--gold)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--gold)_12%,white)] p-6">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">IT lens</div>
                  <div className="mt-1 font-[family-name:var(--font-serif)] text-2xl tracking-tight text-[color:var(--ink)]">
                    Not analyzed yet
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-2)]">
                    This proposal has no label in the database — it won’t appear in topic-based filtering until it’s enriched.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>
    );
  } catch {
    notFound();
  }
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</div>
      <div className="min-w-0 truncate text-right font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--ink-2)]">
        {value}
      </div>
    </div>
  );
}
