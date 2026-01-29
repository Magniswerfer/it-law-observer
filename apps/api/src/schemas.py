from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
from uuid import UUID

class ProposalBase(BaseModel):
    id: int
    periodeid: int
    nummerprefix: str
    nummernumerisk: str
    nummer: str
    titel: str
    resume: Optional[str] = None
    opdateringsdato: datetime

class Proposal(ProposalBase):
    raw_json: dict
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProposalLabel(BaseModel):
    proposal_id: int
    it_relevant: bool
    it_topics: List[str] = Field(default_factory=list)
    it_summary_da: Optional[str] = None
    why_it_relevant_da: Optional[str] = None
    confidence: Optional[float] = None
    model: Optional[str] = None
    prompt_version: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ProposalPolicyAnalysis(BaseModel):
    proposal_id: int
    analysis: dict
    model: Optional[str] = None
    prompt_version: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProposalPdfText(BaseModel):
    proposal_id: int
    source_url: Optional[str] = None
    sha256: Optional[str] = None
    extracted_text: str
    extracted_at: Optional[datetime] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProposalWithLabel(ProposalBase):
    label: Optional[ProposalLabel] = None
    policy: Optional[ProposalPolicyAnalysis] = None
    pdfText: Optional[ProposalPdfText] = None
    mainPdfUrl: Optional[str] = None
    pdfUrls: List[str] = Field(default_factory=list)

    class Config:
        from_attributes = True

class IngestionRun(BaseModel):
    id: UUID
    started_at: datetime
    finished_at: Optional[datetime] = None
    last_watermark_before: Optional[datetime] = None
    last_watermark_after: Optional[datetime] = None
    fetched_count: int = 0
    updated_count: int = 0
    error: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ProposalsQuery(BaseModel):
    type: Optional[Literal["L", "B"]] = None
    it_relevant: Optional[bool] = None
    topic: Optional[str] = None
    q: Optional[str] = None
    has_pdf_link: Optional[bool] = None
    has_pdf_text: Optional[bool] = None
    has_policy_analysis: Optional[bool] = None
    limit: int = Field(default=50, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)

class IngestResponse(BaseModel):
    run_id: UUID
    fetched_count: int
    updated_count: int
    duration_seconds: float
