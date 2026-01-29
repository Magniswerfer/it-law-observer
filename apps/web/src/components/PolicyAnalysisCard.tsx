import React from 'react';
import type { TagFrequency } from '@/lib/tags';
import { extractAnalysisTags, mergeTags, sortTagsByFrequency } from '@/lib/tags';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function formatIsoToDa(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString('da-DK', { dateStyle: 'medium', timeStyle: 'short' });
}

function badgeTone(kind: 'good' | 'warn' | 'bad' | 'neutral') {
  if (kind === 'good') {
    return 'border-[color:color-mix(in_oklab,var(--teal)_35%,transparent)] bg-[color:color-mix(in_oklab,var(--teal)_10%,white)] text-[color:var(--ink)]';
  }
  if (kind === 'bad') {
    return 'border-[color:color-mix(in_oklab,var(--rose)_40%,transparent)] bg-[color:color-mix(in_oklab,var(--rose)_10%,white)] text-[color:var(--ink)]';
  }
  if (kind === 'warn') {
    return 'border-[color:color-mix(in_oklab,var(--gold)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--gold)_12%,white)] text-[color:var(--ink)]';
  }
  return 'border-[color:var(--line)] bg-white/55 text-[color:var(--ink-2)]';
}

function toneForDirection(direction: string | null): 'good' | 'warn' | 'bad' | 'neutral' {
  switch (direction) {
    case 'strengthens':
      return 'good';
    case 'weakens':
      return 'bad';
    case 'mixed':
      return 'warn';
    case 'neutral':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function toneForPosition(position: string | null): 'good' | 'warn' | 'bad' | 'neutral' {
  switch (position) {
    case 'support':
      return 'good';
    case 'support_with_changes':
      return 'warn';
    case 'oppose':
      return 'bad';
    case 'neutral':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function clampPercent(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value as Json, null, 2);
  } catch {
    return String(value);
  }
}

function Pill({
  label,
  tone,
  subtitle,
}: {
  label: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  subtitle?: string | null;
}) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-sm ${badgeTone(tone)}`}>
      <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-wide">{label}</span>
      {subtitle ? (
        <span className="text-[11px] text-[color:var(--muted)]">{subtitle}</span>
      ) : null}
    </div>
  );
}

function TinyMeter({ label, value }: { label: string; value: number }) {
  const pct = clampPercent(value);
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-white/55 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</div>
        <div className="font-[family-name:var(--font-mono)] text-xs text-[color:var(--ink-2)]">{pct}</div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full border border-[color:var(--line)] bg-white/60">
        <div
          className="h-full rounded-full bg-[color:color-mix(in_oklab,var(--teal)_55%,var(--ink))]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
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
  const overall = root && isRecord(root.overall_assessment) ? root.overall_assessment : null;
  const recommendation = root && isRecord(root.recommendation) ? root.recommendation : null;

  const direction = overall ? asString(overall.direction) : null;
  const score = overall ? asNumber(overall.score) : null;
  const position = recommendation ? asString(recommendation.position) : null;

  const analysisTags = extractAnalysisTags(root);
  const mergedTags = mergeTags(props.extraTags ?? [], analysisTags);
  const orderedTags = sortTagsByFrequency(mergedTags, props.tagFrequency);
  const attention = root ? asArray(root.attention_points) : null;
  const redFlags = root ? asArray(root.red_flags) : null;
  const positives = root ? asArray(root.positive_elements) : null;
  const questions = root ? asArray(root.open_questions) : null;

  const analysisTimestamp = meta ? asString(meta.analysis_timestamp_iso) : null;
  const jurisdiction = meta ? asString(meta.jurisdiction) : null;
  const lawType = meta ? asString(meta.law_type) : null;

  const oneParagraph = summary ? asString(summary.one_paragraph) : null;
  const problem = summary ? asString(summary.what_problem_it_addresses) : null;
  const who = summary && isRecord(summary.who_is_affected) ? summary.who_is_affected : null;

  const citizens = who ? asBoolean(who.citizens) : null;
  const publicSector = who ? asBoolean(who.public_sector) : null;
  const privateCompanies = who ? asBoolean(who.private_companies) : null;

  const scoreMeter = score != null ? clampPercent(Math.round(score)) : null;

  return (
    <section className="rounded-3xl border border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper-2)_40%,white)] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Demokrati • digital suverænitet • borgerrettigheder
          </div>
          <h2 className="mt-2 font-[family-name:var(--font-serif)] text-2xl tracking-tight text-[color:var(--ink)] sm:text-3xl">
            Analyse (policy)
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
            Et “dossier”-blik på konsekvenser, magtforskydninger og risici — baseret på titel, resumé og tilgængelig lovtekst.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Pill label="Retning" tone={toneForDirection(direction)} subtitle={direction ?? 'uklar'} />
          <Pill
            label="Position"
            tone={toneForPosition(position)}
            subtitle={
              position === 'support_with_changes'
                ? 'støt m. ændringer'
                : position ?? 'uklar'
            }
          />
          {analysisTimestamp ? (
            <Pill label="Tid" tone="neutral" subtitle={formatIsoToDa(analysisTimestamp)} />
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-[color:var(--line)] bg-white/55 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Kort overblik</div>
              <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                {oneParagraph ?? 'Ingen opsummering angivet.'}
              </div>
            </div>
            {scoreMeter != null ? <TinyMeter label="Score" value={scoreMeter} /> : null}
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border border-[color:var(--line)] bg-white/50 p-4">
            <div className="grid gap-1">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Hvilket problem adresseres?
              </div>
              <div className="text-sm leading-relaxed text-[color:var(--ink-2)]">
                {problem ?? 'Ikke angivet.'}
              </div>
            </div>
            <div className="grid gap-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Hvem påvirkes?</div>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] shadow-sm ${badgeTone(citizens ? 'warn' : 'neutral')}`}>
                  Borgere: {citizens == null ? 'uklart' : citizens ? 'ja' : 'nej'}
                </span>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] shadow-sm ${badgeTone(publicSector ? 'warn' : 'neutral')}`}>
                  Offentlig sektor: {publicSector == null ? 'uklart' : publicSector ? 'ja' : 'nej'}
                </span>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] shadow-sm ${badgeTone(privateCompanies ? 'warn' : 'neutral')}`}>
                  Private: {privateCompanies == null ? 'uklart' : privateCompanies ? 'ja' : 'nej'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
            <span className="font-[family-name:var(--font-mono)]">Model</span> {props.model ?? 'ukendt'}
            <span aria-hidden className="opacity-40">•</span>
            <span className="font-[family-name:var(--font-mono)]">Prompt</span> {props.promptVersion ?? 'ukendt'}
            {jurisdiction ? (
              <>
                <span aria-hidden className="opacity-40">•</span>
                <span className="font-[family-name:var(--font-mono)]">Jurisdiktion</span> {jurisdiction}
              </>
            ) : null}
            {lawType ? (
              <>
                <span aria-hidden className="opacity-40">•</span>
                <span className="font-[family-name:var(--font-mono)]">Type</span> {lawType}
              </>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-[color:var(--line)] bg-white/55 p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Tags</div>
          {orderedTags.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {orderedTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper-2)_55%,white)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--ink-2)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[color:var(--muted)]">Ingen tags foreslået endnu.</p>
          )}

          <div className="mt-6 text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Anbefaling</div>
          <div className="mt-2 grid gap-3 rounded-2xl border border-[color:var(--line)] bg-white/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Pill
                label="Position"
                tone={toneForPosition(position)}
                subtitle={
                  position === 'support_with_changes'
                    ? 'støt med ændringer'
                    : position ?? 'uklar'
                }
              />
              {scoreMeter != null ? (
                <div className="font-[family-name:var(--font-mono)] text-xs text-[color:var(--muted)]">
                  score {scoreMeter}
                </div>
              ) : null}
            </div>
            <div className="text-sm leading-relaxed text-[color:var(--ink-2)]">
              {recommendation ? asString(recommendation.rationale) ?? 'Ingen begrundelse angivet.' : 'Ingen anbefaling angivet.'}
            </div>
            {recommendation && Array.isArray(recommendation.key_changes_if_any) && recommendation.key_changes_if_any.length ? (
              <div className="grid gap-2">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  Nøgleændringer
                </div>
                <ul className="space-y-1 text-sm leading-relaxed text-[color:var(--ink-2)]">
                  {(recommendation.key_changes_if_any as unknown[]).map((k, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-black/25" aria-hidden />
                      <span>{asString(k) ?? String(k)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <DossierList
          title="Attention points"
          items={attention}
          empty="Ingen opmærksomhedspunkter angivet."
          render={(item, idx) => {
            if (!isRecord(item)) return null;
            const topic = asString(item.topic) ?? `punkt-${idx + 1}`;
            const issue = asString(item.issue) ?? 'Ikke angivet.';
            const why = asString(item.why_it_matters) ?? 'Ikke angivet.';
            const risk = asString(item.risk_level) ?? 'unknown';
            const tone = risk === 'high' ? 'bad' : risk === 'medium' ? 'warn' : 'neutral';
            return (
              <div className="rounded-2xl border border-[color:var(--line)] bg-white/55 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Pill label={topic} tone="neutral" />
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] shadow-sm ${badgeTone(tone)}`}>
                    risk: <span className="ml-1 font-[family-name:var(--font-mono)]">{risk}</span>
                  </span>
                </div>
                <div className="mt-3 text-sm font-medium text-[color:var(--ink)]">{issue}</div>
                <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">{why}</div>
              </div>
            );
          }}
        />

        <DossierList title="Red flags" items={redFlags} empty="Ingen red flags angivet." />
        <DossierList title="Åbne spørgsmål" items={questions} empty="Ingen åbne spørgsmål angivet." />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DossierList title="Positive elementer" items={positives} empty="Ingen positive elementer angivet." />

        <div className="rounded-3xl border border-[color:var(--line)] bg-white/55 p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Detaljer</div>
          <div className="mt-3 grid gap-3 rounded-2xl border border-[color:var(--line)] bg-white/50 p-4">
            <KV label="Titel" value={asString(meta?.title) ?? props.title} />
            <KV label="Hvem vinder mest?" value={overall ? asString(overall.who_benefits_most) ?? 'Ikke angivet.' : 'Ikke angivet.'} />
            <KV label="Hvem taber mest?" value={overall ? asString(overall.who_loses_most) ?? 'Ikke angivet.' : 'Ikke angivet.'} />
            <KV label="Score forklaring" value={overall ? asString(overall.score_explanation) ?? 'Ikke angivet.' : 'Ikke angivet.'} />
          </div>

          <details className="mt-4 rounded-2xl border border-[color:var(--line)] bg-white/45 p-4">
            <summary className="cursor-pointer select-none text-sm font-medium text-[color:var(--ink)]">
              Vis rå JSON
            </summary>
            <pre className="mt-3 max-h-[420px] overflow-auto rounded-xl border border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper)_78%,white)] p-3 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-[color:var(--ink-2)]">
{stringifyJson(props.analysis)}
            </pre>
          </details>
        </div>
      </div>

      {!root ? (
        <p className="mt-4 text-sm text-[color:var(--muted)]">
          Analysen kunne ikke fortolkes som JSON-objekt. Se “rå JSON” ovenfor.
        </p>
      ) : null}
    </section>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</div>
      <div className="text-sm leading-relaxed text-[color:var(--ink-2)]">{value}</div>
    </div>
  );
}

function DossierList(props: {
  title: string;
  items: unknown[] | null;
  empty: string;
  render?: (item: unknown, idx: number) => React.ReactNode;
}) {
  const list = props.items ?? [];
  return (
    <div className="rounded-3xl border border-[color:var(--line)] bg-white/55 p-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">{props.title}</div>
      {list.length ? (
        <div className="mt-3 grid gap-3">
          {list.map((item, idx) => {
            if (props.render) return <React.Fragment key={idx}>{props.render(item, idx)}</React.Fragment>;
            const text = typeof item === 'string' && item.trim() ? item.trim() : String(item);
            return (
              <div key={idx} className="rounded-2xl border border-[color:var(--line)] bg-white/50 px-4 py-3 text-sm leading-relaxed text-[color:var(--ink-2)]">
                {text}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[color:var(--muted)]">{props.empty}</p>
      )}
    </div>
  );
}
