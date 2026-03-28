import xmlrpc.client
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends

from app.auth import get_current_driver
from app.errors import APIError
from app.models import Driver
from app.odoo_client import odoo, WAREHOUSE_NAMES
from app.schemas import JobSummary, JobDetail, JobItem, JobListResponse

router = APIRouter(tags=["jobs"])


def _build_summary(picking: dict) -> JobSummary:
    """Assemble a JobSummary from an Odoo picking + partner + collection data."""
    partner_id = picking["partner_id"][0] if picking.get("partner_id") else None
    partner = odoo.get_partner(partner_id) if partner_id else {}

    sale_id = picking["sale_id"][0] if picking.get("sale_id") else None
    collection_required, collection_method, expected_amount = odoo.resolve_collection(sale_id)

    picking_type_id = picking["picking_type_id"][0] if picking.get("picking_type_id") else None
    warehouse = WAREHOUSE_NAMES.get(picking_type_id, "Unknown")

    address_parts = [partner.get("street"), partner.get("street2")]
    address = ", ".join(p for p in address_parts if p) or None

    driver_status = picking.get("x_studio_driver_status") or "assigned"

    return JobSummary(
        job_id=picking["id"],
        odoo_reference=picking["name"],
        sales_order_ref=picking.get("origin"),
        customer_name=partner.get("display_name", picking["partner_id"][1] if picking.get("partner_id") else "Unknown"),
        phone=partner.get("phone"),
        address=address,
        warehouse=warehouse,
        scheduled_date=picking["scheduled_date"],
        status=driver_status,
        collection_required=collection_required,
        collection_method=collection_method,
        expected_collection_amount=expected_amount,
    )


@router.get("/me/jobs", response_model=JobListResponse)
def list_jobs(scope: Literal["today", "pending", "recent", "all"] = "today", driver: Driver = Depends(get_current_driver)):
    try:
        pickings = odoo.get_driver_jobs(driver.odoo_shipper_value, scope)
    except (xmlrpc.client.Fault, Exception) as e:
        raise APIError(502, "odoo_error", "Cannot reach server — please try again later")
    jobs = [_build_summary(p) for p in pickings]
    return JobListResponse(jobs=jobs, fetched_at=datetime.now(timezone.utc))


@router.get("/jobs/{job_id}", response_model=JobDetail)
def get_job(job_id: int, driver: Driver = Depends(get_current_driver)):
    try:
        picking = odoo.get_job_detail(job_id, driver.odoo_shipper_value)
    except (xmlrpc.client.Fault, Exception) as e:
        raise APIError(502, "odoo_error", "Cannot reach server — please try again later")
    if not picking:
        raise APIError(404, "not_found", "This job was not found or is not assigned to you")

    summary = _build_summary(picking)
    try:
        moves = odoo.get_move_lines(picking.get("move_ids", []))
    except (xmlrpc.client.Fault, Exception) as e:
        raise APIError(502, "odoo_error", "Cannot reach server — please try again later")
    items = [
        JobItem(
            product_name=m["product_id"][1] if m.get("product_id") else "Unknown",
            quantity=m.get("product_uom_qty", 0),
            move_id=m.get("id"),
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
