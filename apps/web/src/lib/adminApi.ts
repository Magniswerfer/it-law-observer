import { ProposalWithLabel } from '@/types';

const API_BASE_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function readError(response: Response) {
  try {
    const data = await response.json();
    if (typeof data?.detail === 'string') return data.detail;
    return JSON.stringify(data);
  } catch {
    return response.statusText;
  }
}

export async function getLovforslagPage(opts: {
  limit: number;
  offset: number;
  q?: string;
  hasPdfLink?: boolean;
  hasPdfText?: boolean;
  hasPolicyAnalysis?: boolean;
}) {
  const params = new URLSearchParams();
  params.set('type', 'L');
  params.set('limit', String(opts.limit));
  params.set('offset', String(opts.offset));
  if (opts.q) params.set('q', opts.q);
  if (opts.hasPdfLink != null) params.set('has_pdf_link', String(opts.hasPdfLink));
  if (opts.hasPdfText != null) params.set('has_pdf_text', String(opts.hasPdfText));
  if (opts.hasPolicyAnalysis != null) params.set('has_policy_analysis', String(opts.hasPolicyAnalysis));

  const res = await fetch(`${API_BASE_URL}/proposals?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch proposals: ${await readError(res)}`);
  return (await res.json()) as ProposalWithLabel[];
}
