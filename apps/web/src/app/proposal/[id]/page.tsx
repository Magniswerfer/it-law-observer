import { getProposal } from '@/lib/api';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { PolicyAnalysisCard } from '@/components/PolicyAnalysisCard';
import { buildTagFrequency, getMergedProposalTags, sortTagsByFrequency } from '@/lib/tags';

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
      title: 'Forslag ikke fundet',
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

    const confidencePct =
      proposal.label?.confidence != null ? Math.round(proposal.label.confidence * 100) : null;
    const mainPdfUrl = proposal.mainPdfUrl ?? proposal.pdfUrls?.[0] ?? null;
    const mergedTags = getMergedProposalTags(proposal);
    const orderedTags = sortTagsByFrequency(mergedTags, buildTagFrequency([proposal]));

    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10">
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white/55 px-4 py-2 text-sm text-[color:var(--ink-2)] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
            >
              <span className="font-[family-name:var(--font-mono)] text-xs">←</span>
              Tilbage til radar
            </Link>
          </div>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-4 text-sm text-[color:var(--muted)]">
                <span className="font-[family-name:var(--font-serif)] uppercase tracking-[0.4em] text-[color:var(--ink-2)]">
                  {getTypeLabel(proposal.nummerprefix as 'L' | 'B')}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[color:var(--ink-2)]">
                  {proposal.nummer}
                </span>
              </div>

              <h1 className="mt-4 font-[family-name:var(--font-serif)] text-3xl leading-[1.08] tracking-tight text-[color:var(--ink)] sm:text-4xl">
                {proposal.titel}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[color:var(--muted)]">
                <span className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-white/60 px-2.5 py-1 text-[11px] font-medium text-[color:var(--ink-2)] shadow-sm">
                  <span className="font-[family-name:var(--font-mono)]">ID</span>&nbsp;{proposal.id}
                </span>
                <span className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-white/60 px-2.5 py-1 text-[11px] font-medium text-[color:var(--ink-2)] shadow-sm">
                  <span className="font-[family-name:var(--font-mono)]">Periode</span>&nbsp;{proposal.periodeid}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <section className="flex max-h-[420px] flex-col rounded-3xl border border-[color:var(--line)] bg-white/55 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Officielt resume</div>
                {proposal.resume ? (
                  <p className="mt-3 min-h-0 flex-1 whitespace-pre-line overflow-y-auto text-sm leading-relaxed text-[color:var(--ink-2)]">
                    {proposal.resume}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-[color:var(--muted)]">Intet officielt resume tilgængeligt.</p>
                )}
              </section>

              <div className="flex max-h-[420px] flex-col rounded-2xl border border-[color:var(--line)] bg-white/60 p-5 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Opdateret</div>
                <div className="mt-1 font-[family-name:var(--font-mono)] text-xs text-[color:var(--ink-2)]">
                  {formatDate(proposal.opdateringsdato)}
                </div>
                {confidencePct != null ? (
                  <div className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[color:var(--muted)]">
                    Sikkerhed {confidencePct}%
                  </div>
                ) : null}

                {mainPdfUrl ? (
                  <a
                    href={mainPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--teal)_38%,transparent)] bg-[color:color-mix(in_oklab,var(--teal)_10%,white)] px-3 py-2 text-xs font-medium text-[color:var(--ink)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                    title="Åbn hoved-PDF (Folketinget)"
                  >
                    <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-wide">Åbn PDF</span>
                    <span aria-hidden className="text-[11px] text-[color:var(--muted)]">
                      ↗
                    </span>
                  </a>
                ) : (
                  <div className="mt-3 text-xs text-[color:var(--muted)]">Ingen PDF fundet endnu.</div>
                )}

                <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Emner</div>
                {orderedTags.length ? (
                  <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {orderedTags.map((topic) => (
                      <span
                        key={topic}
                        className="inline-flex w-full items-center rounded-full border border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper-2)_55%,white)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--ink-2)]"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[color:var(--muted)]">Ingen emner registreret.</p>
                )}
              </div>
            </div>

            {proposal.label?.it_summary_da ? (
              <section className="rounded-3xl border border-[color:var(--line)] bg-white/55 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">IT-opsummering</div>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                  {proposal.label.it_summary_da}
                </p>
              </section>
            ) : null}

            {proposal.label?.why_it_relevant_da ? (
              <section className="rounded-3xl border border-[color:var(--line)] bg-white/55 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Begrundelse</div>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                  {proposal.label.why_it_relevant_da}
                </p>
              </section>
            ) : null}

            {proposal.policy?.analysis ? (
              <PolicyAnalysisCard
                title={proposal.titel}
                analysis={proposal.policy.analysis}
                model={proposal.policy.model ?? null}
                promptVersion={proposal.policy.prompt_version ?? null}
                extraTags={mergedTags}
                tagFrequency={buildTagFrequency([proposal])}
              />
            ) : (
              <section className="rounded-3xl border border-[color:color-mix(in_oklab,var(--gold)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--gold)_10%,white)] p-6">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Analyse (policy)</div>
                <div className="mt-2 font-[family-name:var(--font-serif)] text-2xl tracking-tight text-[color:var(--ink)]">
                  Ingen analyse endnu
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-2)]">
                  Analysen køres fra admin-oversigten, når der er vedhæftet PDF-tekst til forslaget.
                </p>
              </section>
            )}
          </div>
        </div>
      </main>
    );
  } catch {
    notFound();
  }
}
