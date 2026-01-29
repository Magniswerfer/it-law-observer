"""
Ingestion service for fetching proposals from Folketingets ODA API.
"""

import httpx
import json
import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from .enrichment import should_enrich_proposal, enrich_proposal, create_or_update_label
from .policy_analysis import (
    analyze_proposal_policy,
    policy_analysis_enabled,
    policy_analysis_model_id,
    policy_analysis_prompt_version,
)
from .oda import fetch_pdf_urls_for_sag
from .supabase_rest import (
    get_last_watermark,
    insert_ingestion_run,
    update_ingestion_run,
    upsert_proposal,
    fetch_proposals_page,
    update_proposal,
    upsert_proposal_policy_analysis,
)

ODA_BASE_URL = "https://oda.ft.dk/api"
SAG_ENDPOINT = f"{ODA_BASE_URL}/Sag"
BILL_TYPE_ID = 3
PAGE_SIZE = 100

# Bills (Sag.typeid == 3) are treated as closed/irrelevant if any of these status IDs occur.
# These are Folketinget ODA Sag.statusid values covering: vedtaget, forkastet, bortfaldet,
# tilbagetaget/udgået, afsluttet/behandlet/foretaget/taget til efterretning, stadfæstet.
CLOSED_STATUS_IDS = {
    1, 8, 10, 25, 44,  # vedtaget (various phases)
    29, 6, 9,          # forkastet
    22, 41, 43,        # bortfaldet / tilbagetaget / udgået
    14, 17, 27, 40,    # afsluttet / behandlet / foretaget / taget til efterretning
    38,                # stadfæstet
}

# "Zombie" cleanup: very old bills that never progressed and are missing clear closure markers.
# Default is 2018-01-01T00:00:00Z; override via ODA_OLD_BILL_CUTOFF_DATE.
DEFAULT_OLD_BILL_CUTOFF_DATE_ISO = "2018-01-01T00:00:00Z"

class IngestionService:
    def __init__(self, only_in_process: Optional[bool] = None):
        self.client = httpx.Client(timeout=30.0)
        if only_in_process is None:
            only_in_process = os.getenv("ODA_ONLY_IN_PROCESS", "").strip().lower() in {"1", "true", "yes"}
        self.only_in_process = only_in_process
        self.fetch_pdf_urls = os.getenv("ODA_FETCH_PDF_URLS", "true").strip().lower() in {"1", "true", "yes"}
        self.doc_request_delay_ms = int(os.getenv("ODA_DOC_REQUEST_DELAY_MS", "0") or "0")
        self.doc_request_retries = int(os.getenv("ODA_DOC_REQUEST_RETRIES", "2") or "2")
        self.old_bill_cutoff_date = self._parse_env_cutoff_date()

    def get_last_watermark(self) -> Optional[datetime]:
        """Get the last successful watermark from ingestion runs."""
        value = get_last_watermark()
        if not value:
            return None
        return datetime.fromisoformat(value.replace("Z", "+00:00"))

    def _format_datetime_for_odata(self, value: datetime) -> str:
        value_utc = value.astimezone(timezone.utc)
        millis = value_utc.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]
        return millis

    def _parse_oda_datetime(self, value: str) -> str:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.isoformat()

    def _parse_oda_datetime_to_dt(self, value: str) -> datetime:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed

    def _parse_env_cutoff_date(self) -> datetime:
        """
        Parse ODA_OLD_BILL_CUTOFF_DATE into a timezone-aware datetime.
        Falls back to DEFAULT_OLD_BILL_CUTOFF_DATE_ISO if missing/invalid.
        """
        raw = os.getenv("ODA_OLD_BILL_CUTOFF_DATE", DEFAULT_OLD_BILL_CUTOFF_DATE_ISO).strip()
        try:
            return self._parse_oda_datetime_to_dt(raw)
        except Exception:
            # Keep ingestion robust even if an env var is misconfigured.
            return self._parse_oda_datetime_to_dt(DEFAULT_OLD_BILL_CUTOFF_DATE_ISO)

    def is_closed(self, sag: Dict[str, Any]) -> bool:
        """
        Decide whether a Sag (bill) is "closed/irrelevant" and should be skipped.

        Rationale:
        1) `lovnummerdato` is the strongest closure signal: it indicates the bill received a law number.
        2) CLOSED_STATUS_IDS captures known final statuses (vedtaget/forkastet/bortfaldet/etc.).
        3) A cutoff date filters out very old "zombie" bills that never progressed but clutter the DB.
        """
        lovnummerdato = sag.get("lovnummerdato")
        if isinstance(lovnummerdato, str) and lovnummerdato.strip():
            return True

        statusid = sag.get("statusid")
        if isinstance(statusid, int) and statusid in CLOSED_STATUS_IDS:
            return True

        typeid = sag.get("typeid")
        opdateringsdato = sag.get("opdateringsdato")
        if typeid == BILL_TYPE_ID and isinstance(opdateringsdato, str):
            try:
                if self._parse_oda_datetime_to_dt(opdateringsdato) < self.old_bill_cutoff_date:
                    return True
            except Exception:
                # If we can't parse the date, don't discard on the cutoff rule.
                pass

        return False

    def _build_filter(self, since: Optional[datetime]) -> str:
        filters = [f"typeid eq {BILL_TYPE_ID}"]
        if since:
            since_str = self._format_datetime_for_odata(since)
            filters.append(f"opdateringsdato gt datetime'{since_str}'")
        return " and ".join(filters)

    def fetch_proposals_since(
        self,
        since: Optional[datetime] = None,
        *,
        include_pdfs: bool = False,
        only_relevant: Optional[bool] = None,
    ) -> List[Dict[str, Any]]:
        """
        Fetch proposals from ODA API since the given timestamp.

        Args:
            since: Timestamp to fetch proposals updated after
            include_pdfs: If True, enrich each Sag with `pdfUrls` from SagDokument → Dokument → Fil
            only_relevant: If True, filter out closed/irrelevant bills per `is_closed`. If None, uses
              the IngestionService's `only_in_process` setting.

        Returns:
            List of proposal data from ODA API
        """
        try:
            params = {
                "$format": "json",
                "$orderby": "opdateringsdato desc",
                "$top": PAGE_SIZE,
                "$filter": self._build_filter(since),
            }

            proposals: List[Dict[str, Any]] = []
            skip = 0
            while True:
                params["$skip"] = skip
                response = self.client.get(SAG_ENDPOINT, params=params)
                response.raise_for_status()

                data = response.json()
                page = data.get("value", [])
                if not page:
                    break

                proposals.extend(page)
                skip += PAGE_SIZE

            if only_relevant is None:
                only_relevant = self.only_in_process
            if only_relevant:
                proposals = [s for s in proposals if not self.is_closed(s)]

            print(f"Fetched {len(proposals)} proposals from ODA API")
            if include_pdfs:
                self._enrich_proposals_with_pdf_urls(proposals)
            return proposals

        except httpx.HTTPError as e:
            raise Exception(f"Failed to fetch from ODA API: {e}")

    def fetch_active_bills_with_pdfs(self) -> List[Dict[str, Any]]:
        """
        Convenience wrapper to fetch all non-closed bills (per `is_closed`) enriched with PDFs.
        """
        bills = self.fetch_proposals_since(None, include_pdfs=False, only_relevant=True)
        self._enrich_proposals_with_pdf_urls(bills)
        return bills

    def _enrich_proposals_with_pdf_urls(self, proposals: List[Dict[str, Any]]) -> None:
        """
        Attach `mainPdfUrl` + `pdfUrls` to each proposal (Sag).

        We do this *after* fetching the paginated /Sag listing because ODA does not include
        file URLs directly on Sag. The direct PDF URLs live on Fil, reachable via:
          Sag(id) -> SagDokument(dokumentid) -> Dokument(+Fil) -> Fil.filurl

        We identify the main law-text document by (Dokument.typeid == 21 OR Dokument.kategoriid == 31),
        and we filter Fil entries by format == "PDF".
        """
        if not self.fetch_pdf_urls:
            return

        for sag in proposals:
            try:
                result = fetch_pdf_urls_for_sag(
                    self.client,
                    sag,
                    delay_ms=self.doc_request_delay_ms,
                    max_retries=self.doc_request_retries,
                )
                sag["mainPdfUrl"] = result.get("mainPdfUrl")
                sag["pdfUrls"] = result.get("pdfUrls", [])
                # Keep some lightweight debug metadata for future refinement (optional).
                sag["pdfDocuments"] = result.get("documents", [])
            except Exception as e:
                sag_id = sag.get("id")
                print(f"Warning: failed to fetch PDFs for Sag {sag_id}: {e}")
                sag["mainPdfUrl"] = None
                sag["pdfUrls"] = []
                sag["pdfDocuments"] = []

    def upsert_proposal(self, proposal_data: Dict[str, Any]) -> bool:
        """
        Upsert a single proposal into the database.

        Args:
            db: Database session
            proposal_data: Proposal data from ODA API

        Returns:
            bool: True if proposal was updated/inserted
        """
        proposal_id = proposal_data.get("id")
        if not proposal_id:
            print(f"Skipping proposal without ID: {proposal_data}")
            return False

        # Prepare proposal data
        nummerprefix = proposal_data.get("nummerprefix") or "L"
        proposal_dict = {
            "id": proposal_id,
            "periodeid": proposal_data.get("periodeid"),
            "nummerprefix": nummerprefix,
            "nummernumerisk": proposal_data.get("nummernumerisk") or "",
            "nummer": proposal_data.get("nummer") or "",
            "titel": proposal_data.get("titel", "").strip(),
            "resume": proposal_data.get("resume", "").strip() if proposal_data.get("resume") else None,
            "opdateringsdato": self._parse_oda_datetime(proposal_data["opdateringsdato"]),
            "raw_json": proposal_data
        }

        upsert_proposal(proposal_dict)
        print(f"Upserted proposal {proposal_id}")
        return True

    def backfill_pdf_urls_for_existing_proposals(
        self,
        *,
        limit: int = 100,
        offset: int = 0,
        only_missing: bool = True,
        max_rows: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Enrich already ingested proposals by adding `pdfUrls` into `raw_json`.

        This is useful when you deploy PDF enrichment after you already have proposals in the DB.
        We PATCH existing rows so we don't require a full proposal payload (which would be needed
        for an upsert insert).
        """
        processed = 0
        updated = 0
        skipped = 0

        while True:
            if max_rows is not None and processed >= max_rows:
                break

            page = fetch_proposals_page(
                select="id,raw_json",
                limit=limit,
                offset=offset,
            )
            if not page:
                break

            for row in page:
                if max_rows is not None and processed >= max_rows:
                    break
                processed += 1

                proposal_id = row.get("id")
                raw_json = row.get("raw_json") or {}
                if not isinstance(raw_json, dict) or not proposal_id:
                    skipped += 1
                    continue

                existing = raw_json.get("pdfUrls")
                if only_missing and isinstance(existing, list) and existing:
                    skipped += 1
                    continue

                try:
                    result = fetch_pdf_urls_for_sag(
                        self.client,
                        {"id": proposal_id},
                        delay_ms=self.doc_request_delay_ms,
                        max_retries=self.doc_request_retries,
                    )
                    raw_json["mainPdfUrl"] = result.get("mainPdfUrl")
                    raw_json["pdfUrls"] = result.get("pdfUrls", [])
                    raw_json["pdfDocuments"] = result.get("documents", [])
                    update_proposal(proposal_id, {"raw_json": raw_json})
                    updated += 1
                except Exception as e:
                    print(f"Warning: failed to backfill PDFs for proposal {proposal_id}: {e}")
                    continue

            offset += limit

        return {"processed": processed, "updated": updated, "skipped": skipped}

    def run_ingestion(self) -> Dict[str, Any]:
        """
        Run the complete ingestion process.

        Returns:
            Dict with ingestion results
        """
        start_time = datetime.now(timezone.utc)

        # Create ingestion run record
        # Get last watermark
        last_watermark = self.get_last_watermark()

        # Create ingestion run
        run = insert_ingestion_run(
            {
                "started_at": start_time.isoformat(),
                "last_watermark_before": last_watermark.isoformat() if last_watermark else None,
            }
        )
        run_id = run["id"]

        try:
            # Fetch proposals
            proposals = self.fetch_proposals_since(last_watermark, include_pdfs=False, only_relevant=False)
            fetched_count = len(proposals)

            # Filter out closed/irrelevant bills before any expensive per-Sag enrichment.
            relevant: List[Dict[str, Any]] = []
            skipped_closed_count = 0
            for sag in proposals:
                if self.is_closed(sag):
                    skipped_closed_count += 1
                    continue
                relevant.append(sag)

            print(
                "ODA /Sag fetched="
                f"{fetched_count} relevant={len(relevant)} skipped_closed={skipped_closed_count}"
            )

            # Enrich only relevant proposals with PDFs (optional).
            self._enrich_proposals_with_pdf_urls(relevant)

            # Process proposals
            updated_count = 0
            enriched_count = 0

            for proposal_data in relevant:
                try:
                    # Upsert proposal
                    updated = self.upsert_proposal(proposal_data)
                    if updated:
                        updated_count += 1

                    # IT enrichment (existing)
                    if should_enrich_proposal(proposal_data):
                        print(f"Enriching proposal {proposal_data.get('id')}")
                        enrichment_result = enrich_proposal(proposal_data)
                        if enrichment_result:
                            create_or_update_label(proposal_data["id"], enrichment_result)
                            enriched_count += 1

                    # Optional: policy/democracy analysis (stored separately from IT labels).
                    if policy_analysis_enabled():
                        analysis = analyze_proposal_policy(proposal_data)
                        if analysis is not None:
                            upsert_proposal_policy_analysis(
                                {
                                    "proposal_id": proposal_data["id"],
                                    "analysis": analysis,
                                    "model": policy_analysis_model_id(),
                                    "prompt_version": policy_analysis_prompt_version(),
                                }
                            )

                except Exception as e:
                    print(f"Error processing proposal {proposal_data.get('id')}: {e}")
                    continue

            # Update run record
            finished_at = datetime.now(timezone.utc)
            update_ingestion_run(
                run_id,
                {
                    "finished_at": finished_at.isoformat(),
                    "fetched_count": fetched_count,
                    "updated_count": updated_count,
                    "last_watermark_after": start_time.isoformat(),
                }
            )

            duration = (finished_at - start_time).total_seconds()

            result = {
                "run_id": run_id,
                "fetched_count": fetched_count,
                "updated_count": updated_count,
                "enriched_count": enriched_count,
                "skipped_closed_count": skipped_closed_count,
                "relevant_count": len(relevant),
                "duration_seconds": duration
            }

            print(f"Ingestion completed: {result}")
            return result

        except Exception as e:
            # Record error
            update_ingestion_run(
                run_id,
                {
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                    "error": str(e),
                }
            )

            raise e
