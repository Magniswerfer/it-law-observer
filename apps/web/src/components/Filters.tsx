'use client';

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
          <div className="inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--teal)_35%,transparent)] bg-[color:color-mix(in_oklab,var(--teal)_12%,white)] px-3 py-1 text-[11px] font-medium tracking-wide text-[color:var(--ink)] shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--teal)]" />
            IT relevant only
          </div>
          <h2 className="mt-3 font-[family-name:var(--font-serif)] text-xl tracking-tight text-[color:var(--ink)]">
            Scope
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[color:var(--muted)]">
            This view is server-filtered: only proposals labeled <span className="font-medium">IT relevant</span> are
            fetched.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onChange({ topic: '', q: '', sort: 'updated_desc' })}
          className="rounded-full border border-[color:var(--line)] bg-white/60 px-3 py-1.5 text-xs font-medium text-[color:var(--ink-2)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
        >
          Reset
        </button>
      </div>

      <div className="mt-5 space-y-5">
        <Field label="Topic">
          <div className="space-y-2">
            <input
              value={value.topic}
              onChange={(e) => onChange({ topic: e.target.value })}
              placeholder="e.g. digitalisering"
              list="topic-suggestions"
              className="w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 text-sm text-[color:var(--ink)] shadow-sm transition placeholder:text-[color:color-mix(in_oklab,var(--muted)_80%,transparent)] hover:bg-white focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            />
            <datalist id="topic-suggestions">
              {topicSuggestions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        </Field>

        <Field label="Search">
          <input
            value={value.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Search title, resume, IT summary…"
            className="w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 text-sm text-[color:var(--ink)] shadow-sm transition placeholder:text-[color:color-mix(in_oklab,var(--muted)_80%,transparent)] hover:bg-white focus:bg-white"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sort">
            <select
              value={value.sort}
              onChange={(e) => onChange({ sort: e.target.value as SortKey })}
              className="w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 text-sm text-[color:var(--ink)] shadow-sm transition hover:bg-white focus:bg-white"
            >
              <option value="updated_desc">Updated (newest)</option>
              <option value="updated_asc">Updated (oldest)</option>
              <option value="confidence_desc">Confidence (high)</option>
              <option value="confidence_asc">Confidence (low)</option>
              <option value="title_asc">Title (A→Z)</option>
              <option value="title_desc">Title (Z→A)</option>
              </select>
          </Field>
        </div>

        <div className="rounded-3xl border border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper-2)_55%,white)] p-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Where the label comes from
          </div>
          <ul className="mt-2 space-y-1 text-sm text-[color:var(--ink-2)]">
            <li>
              The backend ingestion writes a label once, then the web app reads it.
            </li>
            <li>
              If no LLM key is configured, labels come from keyword matching.
            </li>
            <li>
              With an LLM key, labels can include richer topics and rationale.
            </li>
          </ul>
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
