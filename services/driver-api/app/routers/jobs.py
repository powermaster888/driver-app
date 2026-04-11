import json
import xmlrpc.client
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_driver
from app.database import get_db
from app.errors import APIError
from app.models import Driver, CachedJobList
from app.odoo_client import odoo, WAREHOUSE_NAMES, COD_PAYMENT_TERMS
from app.schemas import JobSummary, JobDetail, JobItem, JobListResponse

router = APIRouter(tags=["jobs"])


def _batch_build_summaries(pickings: list[dict]) -> list[JobSummary]:
    """Build summaries for multiple pickings with batch Odoo calls (2 calls instead of 2N)."""
    if not pickings:
        return []

    # Collect unique partner IDs and sale order IDs
    partner_ids = list({p["partner_id"][0] for p in pickings if p.get("partner_id")})
    sale_ids = list({p["sale_id"][0] for p in pickings if p.get("sale_id")})

    # Batch fetch partners (1 call)
    partners_map: dict[int, dict] = {}
    if partner_ids:
        try:
            partners = odoo.read("res.partner", partner_ids, ["display_name", "phone", "street", "street2", "partner_latitude", "partner_longitude"])
            partners_map = {p["id"]: p for p in partners}
        except Exception:
            pass

    # Batch fetch sale orders for cash collection (1 call)
    sales_map: dict[int, dict] = {}
    if sale_ids:
        try:
            sales = odoo.read("sale.order", sale_ids, ["name", "amount_total", "payment_term_id"])
            sales_map = {s["id"]: s for s in sales}
        except Exception:
            pass

    # Build summaries from cached data
    jobs = []
    for picking in pickings:
        partner_id = picking["partner_id"][0] if picking.get("partner_id") else None
        partner = partners_map.get(partner_id, {}) if partner_id else {}

        sale_id = picking["sale_id"][0] if picking.get("sale_id") else None
        so = sales_map.get(sale_id, {}) if sale_id else {}

        # Resolve collection from cached SO
        collection_required = False
        collection_method = None
        expected_amount = None
        if so and so.get("payment_term_id"):
            term_id = so["payment_term_id"][0]
            if term_id in COD_PAYMENT_TERMS:
                collection_required = True
                collection_method = COD_PAYMENT_TERMS[term_id]
                expected_amount = so.get("amount_total", 0)

        pt_id = picking["picking_type_id"][0] if picking.get("picking_type_id") else None
        address_parts = [partner.get("street"), partner.get("street2")]
        address = ", ".join(p for p in address_parts if p) or None
        driver_status = picking.get("x_studio_driver_status") or "assigned"

        lat = partner.get("partner_latitude") or None
        lng = partner.get("partner_longitude") or None
        # Odoo stores 0.0 when unset — treat as null
        if lat == 0.0 and lng == 0.0:
            lat = None
            lng = None

        jobs.append(JobSummary(
            job_id=picking["id"],
            odoo_reference=picking["name"],
            sales_order_ref=picking.get("origin"),
            customer_name=partner.get("display_name", picking["partner_id"][1] if picking.get("partner_id") else "Unknown"),
            phone=partner.get("phone") or None,
            address=address,
            latitude=lat,
            longitude=lng,
            warehouse=WAREHOUSE_NAMES.get(pt_id, "Unknown"),
            scheduled_date=picking["scheduled_date"],
            status=driver_status,
            collection_required=collection_required,
            collection_method=collection_method,
            expected_collection_amount=expected_amount,
        ))

    return jobs


def _save_cache(db: Session, driver_id: int, scope: str, response: JobListResponse):
    """Save or update cached job list for this driver+scope."""
    existing = db.query(CachedJobList).filter(
        CachedJobList.driver_id == driver_id,
        CachedJobList.scope == scope,
    ).first()
    response_json = response.model_dump_json()
    if existing:
        existing.response_json = response_json
        existing.cached_at = datetime.now(timezone.utc)
    else:
        db.add(CachedJobList(
            driver_id=driver_id,
            scope=scope,
            response_json=response_json,
        ))
    db.commit()


def _load_cache(db: Session, driver_id: int, scope: str) -> JobListResponse | None:
    """Load cached job list for this driver+scope."""
    cached = db.query(CachedJobList).filter(
        CachedJobList.driver_id == driver_id,
        CachedJobList.scope == scope,
    ).first()
    if not cached:
        return None
    data = json.loads(cached.response_json)
    data["stale"] = True
    data["cached_at"] = cached.cached_at.isoformat()
    return JobListResponse(**data)


@router.get("/me/jobs", response_model=JobListResponse)
def list_jobs(
    scope: Literal["today", "pending", "recent", "all", "upcoming"] = "today",
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    try:
        pickings = odoo.get_driver_jobs(driver.odoo_shipper_value, scope)
    except (xmlrpc.client.Fault, Exception):
        # Odoo unreachable — return cached response or empty list
        cached = _load_cache(db, driver.id, scope)
        if cached:
            return cached
        return JobListResponse(
            jobs=[], fetched_at=datetime.now(timezone.utc), stale=True,
        )

    jobs = _batch_build_summaries(pickings)
    response = JobListResponse(jobs=jobs, fetched_at=datetime.now(timezone.utc))

    # Cache the successful response
    _save_cache(db, driver.id, scope, response)

    return response


@router.get("/jobs/{job_id}", response_model=JobDetail)
def get_job(job_id: int, driver: Driver = Depends(get_current_driver)):
    try:
        picking = odoo.get_job_detail(job_id, driver.odoo_shipper_value)
    except (xmlrpc.client.Fault, Exception):
        raise APIError(502, "odoo_error", "Cannot reach server — please try again later")
    if not picking:
        raise APIError(404, "not_found", "This job was not found or is not assigned to you")

    summaries = _batch_build_summaries([picking])
    summary = summaries[0] if summaries else None
    if not summary:
        raise APIError(500, "build_error", "Failed to build job summary")

    try:
        moves = odoo.get_move_lines(picking.get("move_ids", []))
    except (xmlrpc.client.Fault, Exception):
        moves = []

    items = [
        JobItem(
            product_name=m["product_id"][1] if m.get("product_id") else "Unknown",
            quantity=m.get("product_uom_qty", 0),
            move_id=m.get("id"),
            barcode=m.get("barcode"),
        )
        for m in moves
    ]

    return JobDetail(
        **summary.model_dump(),
        delivery_notes=picking.get("x_studio_do_note") or None,
        additional_info=picking.get("x_studio_hapo") or None,
        account_no=picking.get("x_studio_account_no") or None,
        items=items,
    )
