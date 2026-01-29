-- Initial schema for IT-politics bill radar
-- Tables: proposals, proposal_labels, ingestion_runs

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Proposals table - stores parliamentary proposals from ODA API
CREATE TABLE proposals (
    id INTEGER PRIMARY KEY,
    periodeid INTEGER NOT NULL,
    nummerprefix TEXT NOT NULL,
    nummernumerisk TEXT NOT NULL,
    nummer TEXT NOT NULL,
    titel TEXT NOT NULL,
    resume TEXT,
    opdateringsdato TIMESTAMPTZ NOT NULL,
    raw_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_proposals_nummerprefix ON proposals(nummerprefix);
CREATE INDEX idx_proposals_opdateringsdato ON proposals(opdateringsdato);
CREATE INDEX idx_proposals_created_at ON proposals(created_at);

-- Proposal labels table - stores IT relevance analysis and summaries
CREATE TABLE proposal_labels (
    proposal_id INTEGER PRIMARY KEY REFERENCES proposals(id) ON DELETE CASCADE,
    it_relevant BOOLEAN NOT NULL,
    it_topics TEXT[] DEFAULT '{}',
    it_summary_da TEXT,
    why_it_relevant_da TEXT,
    confidence REAL CHECK (confidence >= 0 AND confidence <= 1),
    model TEXT,
    prompt_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ingestion runs table - tracks data ingestion processes
CREATE TABLE ingestion_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    last_watermark_before TIMESTAMPTZ,
    last_watermark_after TIMESTAMPTZ,
    fetched_count INTEGER DEFAULT 0,
    updated_count INTEGER DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ingestion tracking
CREATE INDEX idx_ingestion_runs_started_at ON ingestion_runs(started_at);
CREATE INDEX idx_ingestion_runs_finished_at ON ingestion_runs(finished_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_proposals_updated_at
    BEFORE UPDATE ON proposals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
