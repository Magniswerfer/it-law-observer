'use client';

import { uploadProposalPdfText } from '@/lib/api';
import { runPolicyAnalysis } from '@/lib/api';
import { useEffect, useMemo, useState } from 'react';

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading'; message: string }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };

export function PdfTextIngestCard(props: {
  proposalId: number;
  pdfUrl: string | null;
  hasPdfText: boolean;
  hasPolicy: boolean;
}) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [lastUploadName, setLastUploadName] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Avoid SSR/client hydration mismatch by not branching on `window` during render.
  // Client Components still get an initial server render, so keep first client render identical.
  useEffect(() => {
    setHydrated(true);
  }, []);

  const canTryAutoFetch = useMemo(() => !!props.pdfUrl && hydrated, [props.pdfUrl, hydrated]);

  async function attemptAutoFetchAndUpload() {
    if (!props.pdfUrl) return;
    setStatus({ kind: 'uploading', message: 'Henter PDF i browseren…' });

    let blob: Blob;
    try {
      const res = await fetch(props.pdfUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`PDF download fejlede (${res.status})`);
      blob = await res.blob();
    } catch {
      setStatus({
        kind: 'error',
        message:
          'Browseren må ikke hente PDF’en programmatisk (ofte pga. CORS). Åbn PDF-linket og upload filen manuelt her.',
      });
      return;
    }

    const file = new File([blob], `proposal-${props.proposalId}.pdf`, { type: 'application/pdf' });
    await uploadFile(file, props.pdfUrl);
  }

  async function uploadFile(file: File, sourceUrl?: string) {
    setStatus({ kind: 'uploading', message: 'Uploader og udtrækker tekst…' });
    try {
      const resp = await uploadProposalPdfText({
        proposalId: props.proposalId,
        file,
        sourceUrl,
        runPolicyAnalysis: true,
      });
      setLastUploadName(file.name);
      if (resp?.policy) {
        setStatus({ kind: 'done', message: 'PDF-tekst gemt, og analysen er opdateret. Opdater siden.' });
      } else if (typeof resp?.policyError === 'string' && resp.policyError) {
        setStatus({ kind: 'error', message: `PDF-tekst gemt, men analysen fejlede: ${resp.policyError}` });
      } else {
        setStatus({
          kind: 'error',
          message: 'PDF-tekst gemt, men analysen blev ikke gemt. Prøv “Kør analyse igen”.',
        });
      }
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Upload fejlede',
      });
    }
  }

  async function rerunAnalysis() {
    setStatus({ kind: 'uploading', message: 'Kører policy-analyse…' });
    try {
      await runPolicyAnalysis(props.proposalId);
      setStatus({ kind: 'done', message: 'Analysen er opdateret. Opdater siden.' });
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Analyse fejlede' });
    }
  }

  return (
    <section className="rounded-3xl border border-[color:var(--line)] bg-white/55 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            PDF → tekst → analyse
          </div>
          <div className="mt-1 font-[family-name:var(--font-serif)] text-xl tracking-tight text-[color:var(--ink)]">
            Lovtekst fra PDF
          </div>
        </div>
        <div className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-white/60 px-3 py-1.5 shadow-sm">
          <span
            className={[
              'h-2 w-2 rounded-full',
              props.hasPdfText ? 'bg-[color:var(--teal)]' : 'bg-black/15',
            ].join(' ')}
          />
          <span className="ml-2 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--muted)]">
            {props.hasPdfText ? 'tekst' : 'ingen tekst'}
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-2)]">
        Backend kan ikke hente PDF’er fra <span className="font-[family-name:var(--font-mono)]">ft.dk</span> pga.
        Cloudflare. Derfor lader vi din browser hente PDF’en og uploader den med dit klik.
      </p>

        <div className="mt-4 grid gap-3 rounded-2xl border border-[color:var(--line)] bg-white/50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={attemptAutoFetchAndUpload}
              disabled={!canTryAutoFetch || status.kind === 'uploading'}
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--ink)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Parse bill text
            </button>

            {props.pdfUrl ? (
              <a
                href={props.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] bg-white/60 px-4 py-2 text-sm text-[color:var(--ink-2)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
              >
                Åbn PDF
              </a>
            ) : (
              <span className="text-sm text-[color:var(--muted)]">Ingen PDF-link fundet.</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[color:var(--line)] bg-white/60 px-4 py-2 text-sm text-[color:var(--ink-2)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white">
              Upload PDF…
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFile(file, props.pdfUrl ?? undefined);
                }}
                disabled={status.kind === 'uploading'}
              />
            </label>

            {props.hasPolicy ? (
              <div className="text-sm text-[color:var(--muted)]">Policy-analyse findes allerede.</div>
            ) : props.hasPdfText ? (
              <button
                type="button"
                onClick={rerunAnalysis}
                disabled={status.kind === 'uploading'}
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] bg-white/60 px-4 py-2 text-sm text-[color:var(--ink-2)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Kør analyse igen
              </button>
            ) : (
              <div className="text-sm text-[color:var(--muted)]">Policy-analyse bliver genereret efter upload.</div>
            )}
          </div>

        {status.kind !== 'idle' ? (
          <div
            className={[
              'rounded-2xl border px-4 py-3 text-sm',
              status.kind === 'error'
                ? 'border-[color:color-mix(in_oklab,var(--rose)_35%,transparent)] bg-[color:color-mix(in_oklab,var(--rose)_10%,white)] text-[color:var(--ink)]'
                : 'border-[color:color-mix(in_oklab,var(--teal)_30%,transparent)] bg-[color:color-mix(in_oklab,var(--teal)_8%,white)] text-[color:var(--ink)]',
            ].join(' ')}
          >
            <div className="font-medium">
              {status.kind === 'uploading' ? 'Kører…' : status.kind === 'done' ? 'Færdig' : 'Bemærk'}
            </div>
            <div className="mt-1 text-[color:var(--ink-2)]">{status.message}</div>
            {lastUploadName ? (
              <div className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--muted)]">
                {lastUploadName}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
