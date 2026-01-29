from sqlalchemy import Column, Integer, String, Text, Boolean, TIMESTAMP, JSON, REAL, ForeignKey, Index, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB, TIMESTAMPTZ
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True)
    periodeid = Column(Integer, nullable=False)
    nummerprefix = Column(String, nullable=False)
    nummernumerisk = Column(String, nullable=False)
    nummer = Column(String, nullable=False)
    titel = Column(String, nullable=False)
    resume = Column(Text)
    opdateringsdato = Column(TIMESTAMPTZ, nullable=False)
    raw_json = Column(JSONB, nullable=False)
    created_at = Column(TIMESTAMPTZ, server_default=func.now())
    updated_at = Column(TIMESTAMPTZ, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("nummerprefix IN ('L', 'B')", name="check_nummerprefix"),
        Index('idx_proposals_nummerprefix', 'nummerprefix'),
        Index('idx_proposals_opdateringsdato', 'opdateringsdato'),
        Index('idx_proposals_created_at', 'created_at'),
    )

class ProposalLabel(Base):
    __tablename__ = "proposal_labels"

    proposal_id = Column(Integer, ForeignKey('proposals.id', ondelete='CASCADE'), primary_key=True)
    it_relevant = Column(Boolean, nullable=False)
    it_topics = Column(ARRAY(String), default=[])
    it_summary_da = Column(Text)
    why_it_relevant_da = Column(Text)
    confidence = Column(REAL)
    model = Column(String)
    prompt_version = Column(String)
    created_at = Column(TIMESTAMPTZ, server_default=func.now())

    __table_args__ = (
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="check_confidence"),
    )

class IngestionRun(Base):
    __tablename__ = "ingestion_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    started_at = Column(TIMESTAMPTZ, server_default=func.now())
    finished_at = Column(TIMESTAMPTZ)
    last_watermark_before = Column(TIMESTAMPTZ)
    last_watermark_after = Column(TIMESTAMPTZ)
    fetched_count = Column(Integer, default=0)
    updated_count = Column(Integer, default=0)
    error = Column(Text)
    created_at = Column(TIMESTAMPTZ, server_default=func.now())

    __table_args__ = (
        Index('idx_ingestion_runs_started_at', 'started_at'),
        Index('idx_ingestion_runs_finished_at', 'finished_at'),
    )
