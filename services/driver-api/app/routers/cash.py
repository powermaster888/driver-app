import json
import xmlrpc.client

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_driver
from app.database import get_db
from app.errors import APIError
from app.models import Action, Driver
from app.odoo_client import odoo
from app.schemas import CashRequest, CashResponse

router = APIRouter(tags=["cash"])

ALLOWED_METHODS = {"cash", "cheque"}


@router.post("/jobs/{job_id}/cash-collection", response_model=CashResponse)
def submit_cash_collection(
    job_id: int,
    body: CashRequest,
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    # 1. Idempotent check (scoped to driver)
    existing = db.query(Action).filter(Action.action_id == body.action_id, Action.driver_id == driver.id).first()
    if existing:
        result = json.loads(existing.result)
        return CashResponse(
            action_id=body.action_id,
            job_id=job_id,
            accepted=True,
            amount=result.get("amount", body.amount),
            method=result.get("method", body.method),
        )

    # 2. Verify job exists
    try:
        picking = odoo.get_job_detail(job_id, driver.odoo_shipper_value)
    except (xmlrpc.client.Fault, Exception) as e:
        raise APIError(502, "odoo_error", "Cannot reach server — please try again later")
    if not picking:
        raise APIError(404, "not_found", "This job was not found or is not assigned to you")

    # 3. Verify collection is required
    sale_id = picking["sale_id"][0] if picking.get("sale_id") else None
    try:
        collection_required, _, _ = odoo.resolve_collection(sale_id)
    except (xmlrpc.client.Fault, Exception) as e:
        raise APIError(502, "odoo_error", "Cannot reach server — please try again later")
    if not collection_required:
        raise APIError(422, "collection_not_required", "This delivery does not require cash collection")

    # 4. Validate method
    if body.method not in ALLOWED_METHODS:
        raise APIError(
            422, "validation_error",
            f"Please select a valid payment method (cash or cheque)",
            fields={"method": f"must be one of: {', '.join(ALLOWED_METHODS)}"},
        )

    # 5. Write to Odoo
    try:
        odoo.save_cash_collection(job_id, body.amount, body.method, body.reference)
    except (xmlrpc.client.Fault, Exception) as e:
        raise APIError(502, "odoo_error", "Cannot reach server — please try again later")

    # 6. Log Action
    result_data = {
        "job_id": job_id,
        "amount": body.amount,
        "method": body.method,
    }
    action = Action(
        action_id=body.action_id,
        driver_id=driver.id,
        job_id=job_id,
        action_type="cash_collection",
        payload=json.dumps(body.model_dump(), default=str),
        result=json.dumps(result_data),
    )
    db.add(action)
    db.commit()

    return CashResponse(
        action_id=body.action_id,
        job_id=job_id,
        accepted=True,
        amount=body.amount,
        method=body.method,
    )
