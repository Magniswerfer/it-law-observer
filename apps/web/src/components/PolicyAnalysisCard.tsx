import React from 'react';
import type { TagFrequency } from '@/lib/tags';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

type Tone = 'good' | 'warn' | 'bad' | 'neutral';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function formatIsoToDa(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString('da-DK', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatValue(value: unknown, fallback = 'Ikke angivet.'): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function labelize(value: string): string {
  return value.replace(/_/g, ' ').trim();
}

function badgeTone(kind: Tone) {
  if (kind === 'good') {
    return 'border-[color:color-mix(in_oklab,var(--teal)_38%,transparent)] bg-[color:color-mix(in_oklab,var(--teal)_12%,white)] text-[color:var(--ink)]';
  }
  if (kind === 'bad') {
    return 'border-[color:color-mix(in_oklab,var(--rose)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--rose)_12%,white)] text-[color:var(--ink)]';
  }
  if (kind === 'warn') {
    return 'border-[color:color-mix(in_oklab,var(--gold)_50%,transparent)] bg-[color:color-mix(in_oklab,var(--gold)_14%,white)] text-[color:var(--ink)]';
  }
  return 'border-[color:var(--line)] bg-white/60 text-[color:var(--ink-2)]';
}

function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value as Json, null, 2);
  } catch {
    return String(value);
  }
}

const REQUIRED_QUESTIONS = [
  {
    question: 'Er løsningen åben og gennemsigtig?',
    why_it_matters: 'Ikke eksplicit nævnt; bør afklares for offentlig kontrol, revision og læring.',
  },
  {
    question: 'Ejes data af kommunen eller en privat leverandør?',
    why_it_matters: 'Ikke eksplicit nævnt; bør afklares for at undgå lock-in og sikre demokratisk ejerskab.',
  },
  {
    question: 'Gavner det den lokale økonomi – eller store techkoncerner?',
    why_it_matters: 'Ikke eksplicit nævnt; bør afklares for at sikre lokal værdiskabelse og ansvarlig indkøb.',
  },
  {
    question: 'Er der taget højde for sikkerhed, etik og borgernes ret til privatliv?',
    why_it_matters: 'Ikke eksplicit nævnt; bør afklares for at beskytte borgere og minimere risici.',
  },
];

function normalizeQuestion(value: string) {
  return value.trim().toLowerCase();
}

function buildQuestionsList(raw: unknown[]): Array<{ question: string; why_it_matters: string }> {
  const combined: Array<{ question: string; why_it_matters: string }> = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (isRecord(item)) {
      const question = asString(item.question);
      if (!question) continue;
      const key = normalizeQuestion(question);
      if (seen.has(key)) continue;
      seen.add(key);
      combined.push({
        question,
        why_it_matters: asString(item.why_it_matters) ?? 'Ikke eksplicit nævnt; bør afklares.',
      });
      continue;
    }
    const asText = asString(item);
    if (!asText) continue;
    const key = normalizeQuestion(asText);
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push({
      question: asText,
      why_it_matters: 'Ikke eksplicit nævnt; bør afklares.',
    });
  }

  for (const required of REQUIRED_QUESTIONS) {
    const key = normalizeQuestion(required.question);
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(required);
  }

  return combined;
}

function MetaTile({ label, tone, value }: { label: string; tone: Tone; value?: string | null }) {
  return (
    <div className={`rounded-2xl border px-3 py-3 shadow-sm ${badgeTone(tone)}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">{label}</div>
      <div className="mt-1 text-sm font-medium text-[color:var(--ink)]">{value ?? 'ukendt'}</div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="font-[family-name:var(--font-serif)] text-xl text-[color:var(--ink)]">{title}</h3>
      {subtitle ? <span className="text-xs text-[color:var(--muted)]">{subtitle}</span> : null}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-[color:var(--muted)]">{label}</p>;
}

export function PolicyAnalysisCard(props: {
  title: string;
  analysis: unknown;
  model?: string | null;
  promptVersion?: string | null;
  extraTags?: string[];
  tagFrequency?: TagFrequency;
}) {
  const root = isRecord(props.analysis) ? props.analysis : null;
  const meta = root && isRecord(root.meta) ? root.meta : null;
  const summary = root && isRecord(root.summary) ? root.summary : null;

  const hooksRaw = root ? root.it_hooks : null;
  const requestsRaw = root ? root.democratic_change_requests : null;
  const questionsRaw = root ? root.questions_to_ask : null;
  const amendmentsRaw = root ? root.amendment_text_suggestions : null;
  const risksRaw = root ? root.top_risks_if_unchanged : null;
  const positivesRaw = root ? root.positive_elements_to_keep : null;

  const hooks = asArray(hooksRaw) ?? [];
  const requests = asArray(requestsRaw) ?? [];
  const questions = asArray(questionsRaw) ?? [];
  const amendments = asArray(amendmentsRaw) ?? [];
  const risks = asArray(risksRaw) ?? [];
  const positives = asArray(positivesRaw) ?? [];

  const analysisTimestamp = meta ? asString(meta.analysis_timestamp_iso) : null;
  const jurisdiction = meta ? asString(meta.jurisdiction) : null;
  const lawType = meta ? asString(meta.law_type) : null;

  const oneParagraph = summary ? asString(summary.one_paragraph) : null;
  const whatChanges = summary ? asString(summary.what_changes_in_practice) : null;

  const combinedQuestions = buildQuestionsList(questions);

  return (
    <section className="relative">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-[32px] border border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper-2)_28%,white)] p-6 shadow-[0_24px_80px_rgba(18,32,50,0.14)] sm:p-8">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-40 top-[-200px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_top,rgba(42,107,255,0.22),transparent_70%)]" />
              <div className="absolute -left-36 bottom-[-220px] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle_at_top,rgba(255,168,76,0.2),transparent_70%)]" />
            </div>

            <div className="relative">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                  Demokratisk kontrol • digital suverænitet • borgerrettigheder
                </div>
                <h2 className="mt-2 font-[family-name:var(--font-serif)] text-3xl tracking-tight text-[color:var(--ink)] sm:text-4xl">
                  Demokratisk IT-analyse
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-2)]">
                  Konkrete krav, IT-koblinger og spørgsmål til demokratisk kontrol.
                </p>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Ét afsnit</div>
                  <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                    {formatValue(oneParagraph)}
                  </div>
                </div>
                <div className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Hvad ændrer sig i praksis
                  </div>
                  <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                    {formatValue(whatChanges)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[color:var(--line)] bg-white/70 p-5">
            <SectionTitle title="Risici uden ændringer" />
            <div className="mt-4 text-sm text-[color:var(--ink-2)]">
              {risks.length ? (
                <ol className="grid gap-3">
                  {risks.map((item, idx) => (
                    <li key={idx} className="relative rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 pl-11">
                      <span className="absolute left-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--line)] bg-white text-[11px] font-semibold text-[color:var(--ink-2)]">
                        {idx + 1}
                      </span>
                      {formatValue(item)}
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState label="Ingen risici angivet." />
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-[color:color-mix(in_oklab,var(--paper-2)_22%,white)] p-5 sm:p-6">
            <SectionTitle title="Demokratiske ændringskrav" />
            {requests.length ? (
              <div className="mt-4 grid gap-3">
                {requests.map((item, idx) => {
                  if (!isRecord(item)) {
                    return (
                      <div key={idx} className="rounded-2xl border border-[color:var(--line)] bg-white/80 p-4 text-sm text-[color:var(--ink-2)]">
                        {formatValue(item, 'Ikke angivet.')}
                      </div>
                    );
                  }
                  const targetIndex = typeof item.targets_hook_index === 'number' ? item.targets_hook_index : null;
                  const targetHook = targetIndex != null && hooks[targetIndex] && isRecord(hooks[targetIndex])
                    ? asString(hooks[targetIndex]?.hook)
                    : null;
                  return (
                    <div key={idx} className="rounded-2xl border border-[color:var(--line)] bg-white/85 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[color:var(--ink-2)]">
                          Krav {idx + 1}
                        </span>
                        <span className="text-xs text-[color:var(--muted)]">
                          {targetIndex != null ? `Relateret hook #${targetIndex + 1}` : 'Hook: uklart'}
                        </span>
                      </div>
                      {targetHook ? (
                        <div className="mt-2 text-xs text-[color:var(--muted)]">{targetHook}</div>
                      ) : null}
                      <div className="mt-3 text-sm font-medium text-[color:var(--ink)]">
                        {formatValue(item.request)}
                      </div>
                      <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                        {formatValue(item.rationale)}
                      </div>
                      <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                        <span className="font-medium text-[color:var(--ink)]">Implementering: </span>
                        {formatValue(item.implementation_hint)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState label="Ingen ændringskrav angivet." />
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-[color:color-mix(in_oklab,var(--paper-2)_24%,white)] p-5 sm:p-6">
            <SectionTitle title="IT-koblinger" />
            {hooks.length ? (
              <div className="mt-4 grid gap-3">
                {hooks.map((item, idx) => {
                  if (!isRecord(item)) {
                    return (
                      <div key={idx} className="rounded-2xl border border-[color:var(--line)] bg-white/80 p-4 text-sm text-[color:var(--ink-2)]">
                        {formatValue(item, 'Ikke angivet.')}
                      </div>
                    );
                  }
                  const hook = asString(item.hook) ?? `Hook ${idx + 1}`;
                  const dataTypes = asArray(item.likely_data_types) ?? [];
                  const operator = asString(item.who_might_run_it) ?? 'uklart; bør afklares';
                  return (
                    <div key={idx} className="rounded-2xl border border-[color:var(--line)] bg-white/85 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] shadow-sm ${badgeTone('neutral')}`}>
                          Hook #{idx + 1}
                        </span>
                        <span className="text-xs text-[color:var(--muted)]">Drift: {operator}</span>
                      </div>
                      <div className="mt-3 text-sm font-medium text-[color:var(--ink)]">{hook}</div>
                      <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                        {formatValue(item.why_it_implies_it_systems_or_data)}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {dataTypes.length ? (
                          dataTypes.map((entry, dataIdx) => (
                            <span
                              key={dataIdx}
                              className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper-2)_60%,white)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--ink-2)]"
                            >
                              {formatValue(entry, 'ukendt datatype')}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[color:var(--muted)]">Ingen datatyper angivet.</span>
                        )}
                      </div>
                      <div className="mt-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                          Privatliv & sikkerhedsflade
                        </div>
                        <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                          {formatValue(item.privacy_or_security_surface)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState label="Ingen IT-koblinger angivet." />
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-[color:var(--line)] bg-white/70 p-5 shadow-[0_18px_48px_rgba(18,32,50,0.08)]">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted)]">Metadata</div>
            <div className="mt-3 grid gap-2">
              <MetaTile label="Model" tone="neutral" value={props.model} />
              <MetaTile label="Prompt" tone="neutral" value={props.promptVersion} />
              {analysisTimestamp ? <MetaTile label="Tid" tone="neutral" value={formatIsoToDa(analysisTimestamp)} /> : null}
              {jurisdiction ? <MetaTile label="Jurisdiktion" tone="neutral" value={jurisdiction} /> : null}
              {lawType ? <MetaTile label="Type" tone="neutral" value={labelize(lawType)} /> : null}
            </div>
          </div>

          <div className="rounded-3xl bg-[color:color-mix(in_oklab,var(--paper-2)_20%,white)] p-5 sm:p-6">
            <SectionTitle title="Spørgsmål der bør stilles" subtitle="inkl. faste kontrolspørgsmål" />
            {combinedQuestions.length ? (
              <div className="mt-4 columns-1 gap-4 sm:columns-2 [column-fill:balance]">
                {combinedQuestions.map((item, idx) => (
                  <div key={idx} className="mb-4 break-inside-avoid rounded-2xl border border-[color:var(--line)] bg-white/80 p-4">
                    <div className="text-sm font-medium text-[color:var(--ink)]">{formatValue(item.question)}</div>
                    <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                      {formatValue(item.why_it_matters)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState label="Ingen spørgsmål angivet." />
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-[color:color-mix(in_oklab,var(--paper-2)_20%,white)] p-5 sm:p-6">
            <SectionTitle title="Lovtekstforslag" />
            {amendments.length ? (
              <div className="mt-4 columns-1 gap-4 sm:columns-2 [column-fill:balance]">
                {amendments.map((item, idx) => {
                  if (!isRecord(item)) {
                    return (
                      <div key={idx} className="mb-4 break-inside-avoid rounded-2xl border border-[color:var(--line)] bg-white/80 p-4 text-sm text-[color:var(--ink-2)]">
                        {formatValue(item, 'Ikke angivet.')}
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="mb-4 break-inside-avoid rounded-2xl border border-[color:var(--line)] bg-white/80 p-4">
                      <div className="text-sm font-medium text-[color:var(--ink)]">{formatValue(item.short_clause)}</div>
                      <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                        <span className="font-medium text-[color:var(--ink)]">Placering: </span>
                        {formatValue(item.where_to_insert)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState label="Ingen lovtekstforslag angivet." />
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-[color:var(--line)] bg-white/70 p-5">
            <SectionTitle title="Positive elementer at bevare" />
            <div className="mt-4 text-sm text-[color:var(--ink-2)]">
              {positives.length ? (
                <div className="columns-1 gap-3 sm:columns-2 [column-fill:balance]">
                  {positives.map((item, idx) => (
                    <div key={idx} className="mb-3 break-inside-avoid rounded-2xl border border-[color:var(--line)] bg-white/75 px-3 py-2">
                      {formatValue(item)}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState label="Ingen positive elementer angivet." />
              )}
            </div>
          </div>
        </aside>
      </div>

      <details className="mt-6 rounded-2xl border border-[color:var(--line)] bg-white/70 p-4">
        <summary className="cursor-pointer select-none text-sm font-medium text-[color:var(--ink)]">
          Vis rå JSON
        </summary>
        <pre className="mt-3 max-h-[420px] overflow-auto rounded-xl border border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper)_78%,white)] p-3 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-[color:var(--ink-2)]">
{stringifyJson(props.analysis)}
        </pre>
      </details>

      {!root ? (
        <p className="mt-4 text-sm text-[color:var(--muted)]">
          Analysen kunne ikke fortolkes som JSON-objekt. Se “rå JSON” ovenfor.
        </p>
      ) : null}
    </section>
  );
}
