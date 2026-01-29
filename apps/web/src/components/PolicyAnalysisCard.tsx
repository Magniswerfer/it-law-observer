import React from 'react';
import type { TagFrequency } from '@/lib/tags';
import { extractAnalysisTags, mergeTags, sortTagsByFrequency } from '@/lib/tags';

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

function isNotApplicable(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'not_applicable';
}

function formatValue(value: unknown, fallback = 'Ikke angivet.'): string {
  if (isNotApplicable(value)) return 'Ikke relevant.';
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function labelize(value: string): string {
  return value.replace(/_/g, ' ').trim();
}

function formatYesNo(value: string | null): string {
  switch (value) {
    case 'yes':
      return 'ja';
    case 'no':
      return 'nej';
    case 'unclear':
      return 'uklart';
    case 'not_applicable':
      return 'ikke relevant';
    default:
      return value ? labelize(value) : 'uklart';
  }
}

function formatAlignment(value: string | null): string {
  switch (value) {
    case 'aligned':
      return 'på linje';
    case 'not_aligned':
      return 'ikke på linje';
    case 'unclear':
      return 'uklart';
    case 'not_applicable':
      return 'ikke relevant';
    default:
      return value ? labelize(value) : 'uklart';
  }
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

function toneForAlignment(value: string | null): Tone {
  switch (value) {
    case 'aligned':
      return 'good';
    case 'not_aligned':
      return 'bad';
    case 'unclear':
      return 'warn';
    case 'not_applicable':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function toneForYesNo(value: string | null): Tone {
  switch (value) {
    case 'yes':
      return 'bad';
    case 'no':
      return 'good';
    case 'unclear':
      return 'warn';
    case 'not_applicable':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value as Json, null, 2);
  } catch {
    return String(value);
  }
}

function Pill({ label, tone, subtitle }: { label: string; tone: Tone; subtitle?: string | null }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-sm ${badgeTone(tone)}`}>
      <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-wide uppercase">{label}</span>
      {subtitle ? <span className="text-[11px] text-[color:var(--muted)]">{subtitle}</span> : null}
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

function EmptyState({ label, notApplicable }: { label: string; notApplicable?: boolean }) {
  return (
    <p className="text-sm text-[color:var(--muted)]">
      {notApplicable ? 'Ikke relevant for loven.' : label}
    </p>
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
  const shortSummary = root && isRecord(root.short_summary) ? root.short_summary : null;

  const concernsRaw = root ? root.democratic_it_concerns : null;
  const missingRaw = root ? root.missing_positions : null;
  const changesRaw = root ? root.change_proposals : null;

  const concerns = asArray(concernsRaw) ?? [];
  const missing = asArray(missingRaw) ?? [];
  const changes = asArray(changesRaw) ?? [];

  const concernsNotApplicable = isNotApplicable(concernsRaw);
  const missingNotApplicable = isNotApplicable(missingRaw);
  const changesNotApplicable = isNotApplicable(changesRaw);

  const publicControl = root && isRecord(root.public_control_and_responsibility) ? root.public_control_and_responsibility : null;
  const publicControlNotes = root && isRecord(root.public_control_and_responsibility_notes)
    ? root.public_control_and_responsibility_notes
    : null;
  const privacy = root && isRecord(root.privacy_and_freedom_assessment) ? root.privacy_and_freedom_assessment : null;
  const privacyNotes = root && isRecord(root.privacy_and_freedom_assessment_notes)
    ? root.privacy_and_freedom_assessment_notes
    : null;
  const alignment = root && isRecord(root.alignment_with_democratic_it_principles)
    ? root.alignment_with_democratic_it_principles
    : null;
  const alignmentNotes = root && isRecord(root.alignment_with_democratic_it_principles_notes)
    ? root.alignment_with_democratic_it_principles_notes
    : null;
  const finalNote = root && isRecord(root.final_note) ? root.final_note : null;
  const finalNoteJustification = root && isRecord(root.final_note_justification)
    ? root.final_note_justification
    : null;

  const analysisTimestamp = meta ? asString(meta.analysis_timestamp_iso) : null;
  const jurisdiction = meta ? asString(meta.jurisdiction) : null;
  const lawType = meta ? asString(meta.law_type) : null;

  const whatTheLawDoes = shortSummary ? asString(shortSummary.what_the_law_does) : null;
  const whereItUsesIt = shortSummary ? asString(shortSummary.where_it_uses_or_depends_on_it) : null;

  const introducesSurveillance = privacy ? asString(privacy.introduces_surveillance) : null;

  const analysisTags = extractAnalysisTags(root);
  const mergedTags = mergeTags(props.extraTags ?? [], analysisTags);
  const orderedTags = sortTagsByFrequency(mergedTags, props.tagFrequency);

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper-2)_35%,white)] p-6 shadow-[0_20px_70px_rgba(18,32,50,0.12)] sm:p-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-32 top-[-180px] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle_at_top,rgba(42,107,255,0.25),transparent_70%)]" />
        <div className="absolute -left-24 bottom-[-200px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_top,rgba(255,168,76,0.22),transparent_70%)]" />
      </div>

      <div className="relative">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Demokratisk kontrol • digital suverænitet • borgerrettigheder
            </div>
            <h2 className="mt-2 font-[family-name:var(--font-serif)] text-3xl tracking-tight text-[color:var(--ink)] sm:text-4xl">
              Demokratisk IT-analyse
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-2)]">
              Struktureret overblik med fokus på frihed, ansvar og konkrete ændringskrav.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Pill label="Model" tone="neutral" subtitle={props.model ?? 'ukendt'} />
            <Pill label="Prompt" tone="neutral" subtitle={props.promptVersion ?? 'ukendt'} />
            {analysisTimestamp ? (
              <Pill label="Tid" tone="neutral" subtitle={formatIsoToDa(analysisTimestamp)} />
            ) : null}
            {jurisdiction ? <Pill label="Jurisdiktion" tone="neutral" subtitle={jurisdiction} /> : null}
            {lawType ? <Pill label="Type" tone="neutral" subtitle={labelize(lawType)} /> : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-[color:var(--line)] bg-white/60 p-5">
            <SectionTitle title="Kort resumé" />
            <div className="mt-4 grid gap-4">
              <div className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Hvad gør loven?</div>
                <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                  {formatValue(whatTheLawDoes)}
                </div>
              </div>
              <div className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">IT-afhængighed</div>
                <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                  {formatValue(whereItUsesIt)}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {orderedTags.length ? (
                orderedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper-2)_55%,white)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--ink-2)]"
                  >
                    {labelize(tag)}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[color:var(--muted)]">Ingen emnetags.</span>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[color:var(--line)] bg-white/60 p-5">
            <SectionTitle title="Privatliv & frihed" />
            <div className="mt-4 grid gap-3 rounded-2xl border border-[color:var(--line)] bg-white/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-[color:var(--ink)]">Introducerer overvågning?</div>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] shadow-sm ${badgeTone(toneForYesNo(introducesSurveillance))}`}>
                  {formatYesNo(introducesSurveillance)}
                </span>
              </div>
              {privacyNotes ? (
                <p className="text-xs leading-relaxed text-[color:var(--muted)]">
                  {formatValue(privacyNotes.introduces_surveillance)}
                </p>
              ) : null}
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Mulige privatlivsproblemer</div>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                  {formatValue(privacy ? privacy.potential_privacy_issues : null)}
                </p>
                {privacyNotes ? (
                  <p className="mt-2 text-xs leading-relaxed text-[color:var(--muted)]">
                    {formatValue(privacyNotes.potential_privacy_issues)}
                  </p>
                ) : null}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Grupper i risiko</div>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                  {formatValue(privacy ? privacy.groups_most_at_risk : null)}
                </p>
                {privacyNotes ? (
                  <p className="mt-2 text-xs leading-relaxed text-[color:var(--muted)]">
                    {formatValue(privacyNotes.groups_most_at_risk)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4">
            <div className="rounded-3xl border border-[color:var(--line)] bg-white/60 p-5">
              <SectionTitle title="Demokratiske IT-bekymringer" subtitle={concernsNotApplicable ? 'ikke relevant' : undefined} />
              {concerns.length ? (
                <div className="mt-4 grid gap-3">
                  {concerns.map((item, idx) => {
                    if (!isRecord(item)) {
                      return (
                        <div key={idx} className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-4 text-sm text-[color:var(--ink-2)]">
                          {formatValue(item, 'Ikke angivet.')}
                        </div>
                      );
                    }
                    const topic = asString(item.topic) ?? `punkt-${idx + 1}`;
                    return (
                      <div key={idx} className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] shadow-sm ${badgeTone('neutral')}`}>
                            {labelize(topic)}
                          </span>
                          <span className="text-xs text-[color:var(--muted)]">Berørte: {formatValue(item.who_is_affected, 'ukendt')}</span>
                        </div>
                        <div className="mt-3 text-sm font-medium text-[color:var(--ink)]">
                          {formatValue(item.concern)}
                        </div>
                        <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                          {formatValue(item.why_it_matters_democratically)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyState label="Ingen bekymringer angivet." notApplicable={concernsNotApplicable} />
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-[color:var(--line)] bg-white/60 p-5">
              <SectionTitle title="Manglende stillingtagen" subtitle={missingNotApplicable ? 'ikke relevant' : undefined} />
              {missing.length ? (
                <div className="mt-4 grid gap-3">
                  {missing.map((item, idx) => {
                    if (!isRecord(item)) {
                      return (
                        <div key={idx} className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-4 text-sm text-[color:var(--ink-2)]">
                          {formatValue(item, 'Ikke angivet.')}
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-4">
                        <div className="text-sm font-medium text-[color:var(--ink)]">{formatValue(item.question)}</div>
                        <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                          {formatValue(item.why_this_should_be_explicit)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyState label="Ingen mangler angivet." notApplicable={missingNotApplicable} />
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-[color:var(--line)] bg-white/60 p-5">
              <SectionTitle title="Konkrete ændringsforslag" subtitle={changesNotApplicable ? 'ikke relevant' : undefined} />
              {changes.length ? (
                <div className="mt-4 grid gap-3">
                  {changes.map((item, idx) => {
                    if (!isRecord(item)) {
                      return (
                        <div key={idx} className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-4 text-sm text-[color:var(--ink-2)]">
                          {formatValue(item, 'Ikke angivet.')}
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-4">
                        <div className="text-sm font-medium text-[color:var(--ink)]">{formatValue(item.proposal)}</div>
                        <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                          <span className="font-medium text-[color:var(--ink)]">Krav: </span>
                          {formatValue(item.what_it_requires)}
                        </div>
                        <div className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                          <span className="font-medium text-[color:var(--ink)]">Demokratisk effekt: </span>
                          {formatValue(item.democratic_effect)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyState label="Ingen forslag angivet." notApplicable={changesNotApplicable} />
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-[color:var(--line)] bg-white/60 p-5">
              <SectionTitle title="Offentlig kontrol & ansvar" />
              <div className="mt-4 grid gap-3 rounded-2xl border border-[color:var(--line)] bg-white/70 p-4">
                <KV label="Ejer systemet" value={formatValue(publicControl ? publicControl.who_owns_the_system : null)} />
                {publicControlNotes ? (
                  <NoteRow value={formatValue(publicControlNotes.who_owns_the_system)} />
                ) : null}
                <KV label="Driver systemet" value={formatValue(publicControl ? publicControl.who_operates_it : null)} />
                {publicControlNotes ? (
                  <NoteRow value={formatValue(publicControlNotes.who_operates_it)} />
                ) : null}
                <KV label="Vedligeholdelse" value={formatValue(publicControl ? publicControl.who_maintains_it_long_term : null)} />
                {publicControlNotes ? (
                  <NoteRow value={formatValue(publicControlNotes.who_maintains_it_long_term)} />
                ) : null}
                <KV label="Ansvarsgab" value={formatValue(publicControl ? publicControl.accountability_gaps : null)} />
                {publicControlNotes ? (
                  <NoteRow value={formatValue(publicControlNotes.accountability_gaps)} />
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-[color:var(--line)] bg-white/60 p-5">
              <SectionTitle title="Demokratiske IT-principper" />
              <div className="mt-4 grid gap-2">
                <PrincipleRow
                  label="Open source som standard"
                  value={alignment ? asString(alignment.open_source_by_default) : null}
                  note={alignmentNotes ? asString(alignmentNotes.open_source_by_default) : null}
                />
                <PrincipleRow
                  label="Ingen tvungen digital-only adgang"
                  value={alignment ? asString(alignment.no_forced_digital_only_access) : null}
                  note={alignmentNotes ? asString(alignmentNotes.no_forced_digital_only_access) : null}
                />
                <PrincipleRow
                  label="Offentligt ejerskab af kritiske systemer"
                  value={alignment ? asString(alignment.public_ownership_of_critical_systems) : null}
                  note={alignmentNotes ? asString(alignmentNotes.public_ownership_of_critical_systems) : null}
                />
                <PrincipleRow
                  label="Forsigtighed med ny teknologi"
                  value={alignment ? asString(alignment.precaution_with_new_technology) : null}
                  note={alignmentNotes ? asString(alignmentNotes.precaution_with_new_technology) : null}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-[color:var(--line)] bg-white/60 p-5">
              <SectionTitle title="Vigtigste note" />
              <div className="mt-4 grid gap-3 rounded-2xl border border-[color:var(--line)] bg-white/70 p-4">
                <KV label="Største demokratiske risiko" value={formatValue(finalNote ? finalNote.biggest_democratic_risk : null)} />
                {finalNoteJustification ? (
                  <NoteRow value={formatValue(finalNoteJustification.biggest_democratic_risk)} />
                ) : null}
                <KV label="Vigtigste ændring" value={formatValue(finalNote ? finalNote.most_important_change : null)} />
                {finalNoteJustification ? (
                  <NoteRow value={formatValue(finalNoteJustification.most_important_change)} />
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <details className="mt-6 rounded-2xl border border-[color:var(--line)] bg-white/55 p-4">
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
      </div>
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

function NoteRow({ value }: { value: string }) {
  return <p className="text-xs leading-relaxed text-[color:var(--muted)]">{value}</p>;
}

function PrincipleRow({ label, value, note }: { label: string; value: string | null; note?: string | null }) {
  const tone = toneForAlignment(value);
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[color:var(--ink-2)]">{label}</span>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] shadow-sm ${badgeTone(tone)}`}>
          {formatAlignment(value)}
        </span>
      </div>
      {note ? (
        <p className="mt-2 text-xs leading-relaxed text-[color:var(--muted)]">{note}</p>
      ) : null}
    </div>
  );
}
