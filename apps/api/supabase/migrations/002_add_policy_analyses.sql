-- Store democracy/policy analysis JSON separate from IT labels

CREATE TABLE IF NOT EXISTS proposal_policy_analyses (
    proposal_id INTEGER PRIMARY KEY REFERENCES proposals(id) ON DELETE CASCADE,
    analysis JSONB NOT NULL,
    model TEXT,
    prompt_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reuse the existing update_updated_at_column() trigger function from 001_initial_schema.sql
DROP TRIGGER IF EXISTS update_proposal_policy_analyses_updated_at ON proposal_policy_analyses;
CREATE TRIGGER update_proposal_policy_analyses_updated_at
    BEFORE UPDATE ON proposal_policy_analyses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

