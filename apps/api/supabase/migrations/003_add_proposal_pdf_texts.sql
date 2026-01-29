-- Store extracted PDF text per proposal (uploaded by user via browser)

CREATE TABLE IF NOT EXISTS proposal_pdf_texts (
    proposal_id INTEGER PRIMARY KEY REFERENCES proposals(id) ON DELETE CASCADE,
    source_url TEXT,
    sha256 TEXT,
    extracted_text TEXT NOT NULL,
    extracted_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_proposal_pdf_texts_updated_at ON proposal_pdf_texts;
CREATE TRIGGER update_proposal_pdf_texts_updated_at
    BEFORE UPDATE ON proposal_pdf_texts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

