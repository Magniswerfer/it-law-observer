'use client';

import { uploadProposalPdfText, runPolicyAnalysis } from '@/lib/api';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; message: string }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function AdminRowActions(props: {
  proposalId: number;
  pdfUrl: string | null;
  initialHasPdfText: boolean;
  initialHasPolicy: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [hasPdfText, setHasPdfText] = useState(props.initialHasPdfText);
  const [hasPolicy, setHasPolicy] = useState(props.initialHasPolicy);
  const [lastFileName, setLastFileName] = useState<string | null>(null);

  const analysisLabel = hasPolicy ? 'Analyse ↻' : 'Analyse';

  async function uploadFile(file: File, sourceUrl?: string) {
    setStatus({ kind: 'busy', message: 'Uploader + udtrækker tekst…' });
    try {
      const resp = await uploadProposalPdfText({
        proposalId: props.proposalId,
        file,
        sourceUrl,
        runPolicyAnalysis: !hasPolicy,
      });
      setLastFileName(file.name);
      setHasPdfText(true);
      if (resp?.policy) setHasPolicy(true);
      if (!hasPolicy && resp?.policy) {
        setStatus({ kind: 'ok', message: 'PDF-tekst gemt + analyse opdateret.' });
      } else {
        setStatus({ kind: 'ok', message: 'PDF-tekst gemt.' });
      }

      // Re-fetch server-rendered table data (status badges, row highlighting, filters).
      setTimeout(() => router.refresh(), 500);
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Upload fejlede' });
    }
  }

  async function parseFromLink() {
    if (!props.pdfUrl) return;
    setStatus({ kind: 'busy', message: 'Henter PDF i browseren…' });

    let blob: Blob;
    try {
      const res = await fetch(props.pdfUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`PDF download fejlede (${res.status})`);
      blob = await res.blob();
    } catch {
      setStatus({
        kind: 'error',
        message: 'Kan ikke hente PDF programmatisk (CORS). Åbn linket og upload filen manuelt.',
      });
      return;
    }

    const file = new File([blob], `proposal-${props.proposalId}.pdf`, { type: 'application/pdf' });
    await uploadFile(file, props.pdfUrl);
  }

  async function runAnalysis() {
    setStatus({ kind: 'busy', message: 'Kører analyse…' });
    try {
      await runPolicyAnalysis(props.proposalId);
      setHasPolicy(true);
      setStatus({ kind: 'ok', message: 'Analysen er opdateret.' });
      setTimeout(() => router.refresh(), 500);
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Analyse fejlede' });
    }
  }

  return (
    <div className="flex min-w-[340px] flex-col gap-2">
      <div className="flex flex-nowrap items-center gap-2">
        {props.pdfUrl ? (
          <button
            type="button"
            onClick={parseFromLink}
            disabled={status.kind === 'busy'}
            className={classNames(
              'inline-flex h-8 w-24 items-center justify-center rounded-full px-3 text-[11px] font-medium shadow-sm transition',
              'border border-black/15 bg-white/60 text-[color:var(--ink)]',
              'hover:-translate-y-0.5 hover:bg-white',
              status.kind === 'busy' && 'cursor-not-allowed opacity-50 hover:translate-y-0',
            )}
            title="Hent fra PDF-link og upload"
          >
            Parse fra link
          </button>
        ) : (
          <span className="inline-flex h-8 w-24 items-center justify-center rounded-full border border-[color:var(--line)] bg-white/35 px-3 text-[11px] font-medium text-[color:var(--muted)] shadow-sm">
            Ingen PDF-link
          </span>
        )}

        <label
          className={classNames(
            'inline-flex h-8 w-24 cursor-pointer items-center justify-center rounded-full px-3 text-[11px] font-medium shadow-sm transition',
            'border border-black/15 bg-black text-white',
            'hover:-translate-y-0.5 hover:bg-black/90',
            status.kind === 'busy' && 'pointer-events-none opacity-50 hover:translate-y-0',
          )}
          title="Upload PDF (manual)"
        >
          Upload PDF…
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file, props.pdfUrl ?? undefined);
            }}
          />
        </label>

        <button
          type="button"
          onClick={runAnalysis}
          disabled={!hasPdfText || status.kind === 'busy'}
          className={classNames(
            'inline-flex h-8 w-24 items-center justify-center rounded-full px-3 text-[11px] font-medium shadow-sm transition',
            'border border-[color:color-mix(in_oklab,var(--ok)_55%,black)]',
            'bg-[color:color-mix(in_oklab,var(--ok)_10%,white)] text-[color:color-mix(in_oklab,var(--ok)_22%,black)]',
            'hover:-translate-y-0.5 hover:bg-white',
            (!hasPdfText || status.kind === 'busy') && 'cursor-not-allowed opacity-50 hover:translate-y-0',
          )}
          title={!hasPdfText ? 'Kræver PDF-tekst først' : analysisLabel}
        >
          <span className="truncate">{analysisLabel}</span>
        </button>

        {props.pdfUrl ? (
          <a
            href={props.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 w-16 items-center justify-center rounded-full border border-[color:var(--line)] bg-white/30 px-3 text-[11px] text-[color:var(--muted)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
          >
            PDF
          </a>
        ) : null}
      </div>

      {status.kind !== 'idle' ? (
        <div
          className={classNames(
            'rounded-2xl border px-3 py-2 text-xs',
            status.kind === 'error'
              ? 'border-[color:color-mix(in_oklab,var(--bad)_58%,transparent)] bg-[color:color-mix(in_oklab,var(--bad)_10%,white)] text-[color:var(--ink)]'
              : status.kind === 'ok'
                ? 'border-[color:color-mix(in_oklab,var(--ok)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--ok)_10%,white)] text-[color:var(--ink)]'
                : 'border-[color:var(--line)] bg-white/40 text-[color:var(--ink)]',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium">
                {status.kind === 'busy' ? 'Kører…' : status.kind === 'ok' ? 'OK' : 'Fejl'}
              </div>
              <div className="mt-0.5 text-[color:var(--ink-2)]">{status.message}</div>
            </div>
            {lastFileName ? (
              <div className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--muted)]">
                {lastFileName}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
