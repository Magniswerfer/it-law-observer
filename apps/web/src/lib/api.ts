import { ProposalWithLabel, ProposalsQuery } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function readError(response: Response) {
  try {
    const data = await response.json();
    if (typeof data?.detail === 'string') return data.detail;
    return JSON.stringify(data);
  } catch {
    return response.statusText;
  }
}

export async function getProposals(query?: ProposalsQuery): Promise<ProposalWithLabel[]> {
  const params = new URLSearchParams();

  // Web app contract: only fetch IT-relevant bills.
  params.set('it_relevant', 'true');
  if (query?.topic) params.append('topic', query.topic);
  if (query?.q) params.append('q', query.q);
  if (query?.limit) params.append('limit', query.limit.toString());
  if (query?.offset) params.append('offset', query.offset.toString());

  const url = `${API_BASE_URL}/proposals?${params.toString()}`;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Failed to fetch proposals: ${await readError(response)}`);
  }

  return response.json();
}

export async function getProposal(id: number): Promise<ProposalWithLabel> {
  const response = await fetch(`${API_BASE_URL}/proposals/${id}`, { cache: 'no-store' });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Proposal not found');
    }
    throw new Error(`Failed to fetch proposal: ${await readError(response)}`);
  }

  return response.json();
}

export async function triggerIngestion(token: string) {
  const response = await fetch(`${API_BASE_URL}/ingest?ingest_token=${token}`, {
    method: 'POST',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to trigger ingestion: ${await readError(response)}`);
  }

  return response.json();
}
