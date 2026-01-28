// Shared TypeScript types for the IT-politics bill radar

export interface ProposalBase {
  id: number;
  periodeid: number;
  nummerprefix: string;
  nummernumerisk: string;
  nummer: string;
  titel: string;
  resume: string | null;
  opdateringsdato: string;
}

export interface Proposal extends ProposalBase {
  raw_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProposalLabel {
  proposal_id: number;
  it_relevant: boolean;
  it_topics: string[];
  it_summary_da: string | null;
  why_it_relevant_da: string | null;
  confidence: number | null;
  model: string | null;
  prompt_version: string | null;
  created_at: string;
}

export interface ProposalWithLabel extends ProposalBase {
  label: ProposalLabel | null;
  mainPdfUrl?: string | null;
  pdfUrls?: string[];
}

export interface IngestResponse {
  run_id: string;
  fetched_count: number;
  updated_count: number;
  duration_seconds: number;
}

export interface ProposalsQuery {
  it_relevant?: boolean;
  topic?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export type ProposalType = "L" | "B";
export type ProposalTypeLabel = "Lovforslag" | "Beslutningsforslag";
