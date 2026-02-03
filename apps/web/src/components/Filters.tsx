'use client';

import SearchableSelect from '@/components/SearchableSelect';

export type SortKey =
  | 'updated_desc'
  | 'updated_asc'
  | 'confidence_desc'
  | 'confidence_asc'
  | 'title_asc'
  | 'title_desc';

export type DashboardFilters = {
  topic: string;
  q: string;
  sort: SortKey;
};

export default function Filters({
  value,
  onChange,
  topicSuggestions,
}: {
  value: DashboardFilters;
  onChange: (next: Partial<DashboardFilters>) => void;
  topicSuggestions: string[];
}) {
  return (
    <div className="rounded-3xl border border-[color:var(--line)] bg-white/55 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="mt-1 font-[family-name:var(--font-serif)] text-xl tracking-tight text-[color:var(--ink)]">
            Afgrænsning
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[color:var(--muted)]">
            Visningen viser kun forslag med IT-relevans, så du får et fokuseret overblik.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onChange({ topic: '', q: '', sort: 'updated_desc' })}
          className="rounded-full border border-[color:var(--line)] bg-white/60 px-3 py-1.5 text-xs font-medium text-[color:var(--ink-2)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
        >
          Nulstil
        </button>
      </div>

      <div className="mt-5 space-y-5">
        <Field label="Søgning">
          <input
            value={value.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Søg i titel, resume, IT-opsummering…"
            className="w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 text-sm text-[color:var(--ink)] shadow-sm transition placeholder:text-[color:color-mix(in_oklab,var(--muted)_80%,transparent)] hover:bg-white focus:bg-white"
          />
        </Field>

        <Field label="Emne">
          <SearchableSelect
            value={value.topic}
            onChange={(topic) => onChange({ topic })}
            placeholder="Vælg eller skriv et emne"
            options={topicSuggestions}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sortering">
            <select
              value={value.sort}
              onChange={(e) => onChange({ sort: e.target.value as SortKey })}
              className="w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 text-sm text-[color:var(--ink)] shadow-sm transition hover:bg-white focus:bg-white"
            >
              <option value="updated_desc">Opdateret (nyest)</option>
              <option value="updated_asc">Opdateret (ældst)</option>
              <option value="confidence_desc">Sikkerhed (høj)</option>
              <option value="confidence_asc">Sikkerhed (lav)</option>
              <option value="title_asc">Titel (A→Å)</option>
              <option value="title_desc">Titel (Å→A)</option>
            </select>
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
