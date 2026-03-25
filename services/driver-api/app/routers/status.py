import json
import xmlrpc.client

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_driver
from app.database import get_db
from app.errors import APIError
from app.models import Action, Driver
from app.odoo_client import odoo
from app.schemas import StatusRequest, StatusResponse
from app.state_machine import is_valid_transition, get_allowed_transitions, FAILURE_REASONS

router = APIRouter(tags=["status"])


@router.post("/jobs/{job_id}/status", response_model=StatusResponse)
def update_status(
    job_id: int,
    body: StatusRequest,
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    # 1. Check idempotent replay (scoped to driver)
    existing = db.query(Action).filter(Action.action_id == body.action_id, Action.driver_id == driver.id).first()
    if existing:
        result = json.loads(existing.result)
        return StatusResponse(
            action_id=body.action_id,
            job_id=job_id,
            status=result.get("status", body.status),
            accepted=True,
            replayed=True,
        )

    # 2. Fetch job from Odoo
    try:
        picking = odoo.get_job_detail(job_id, driver.odoo_shipper_value)
    except (xmlrpc.client.Fault, Exception) as e:
        raise APIError(502, "odoo_error", "Odoo is unavailable or rejected the request")
    if not picking:
        raise APIError(404, "not_found", "Job not found or not assigned to this driver")

    current_status = picking.get("x_studio_driver_status") or "assigned"

    # 3. Validate transition
    if not is_valid_transition(current_status, body.status):
        allowed = get_allowed_transitions(current_status)
        raise APIError(
            409, "invalid_transition",
            f"Cannot transition from '{current_status}' to '{body.status}'",
            current_status=current_status,
            allowed_transitions=allowed,
        )

    # 4. Validate "failed" has reason
    if body.status == "failed":
        if not body.reason:
            raise APIError(
                422, "validation_error",
                "Failure reason is required when status is 'failed'",
                fields={"reason": "required"},
            )
        if body.reason not in FAILURE_REASONS:
            raise APIError(
                422, "validation_error",
                f"Invalid failure reason: '{body.reason}'",
                fields={"reason": f"must be one of: {', '.join(FAILURE_REASONS)}"},
            )

    # 5. Validate "delivered" prerequisites
    if body.status == "delivered":
        # Check POD action exists
        pod_action = db.query(Action).filter(
            Action.job_id == job_id,
            Action.driver_id == driver.id,
            Action.action_type == "proof_of_delivery",
        ).first()
        if not pod_action:
            raise APIError(
                422, "validation_error",
                "Proof of delivery is required before marking as delivered",
                fields={"proof_of_delivery": "required"},
            )

        # Check cash collection if required
        sale_id = picking["sale_id"][0] if picking.get("sale_id") else None
        try:
            collection_required, _, _ = odoo.resolve_collection(sale_id)
        except (xmlrpc.client.Fault, Exception) as e:
            raise APIError(502, "odoo_error", "Odoo is unavailable or rejected the request")
        if collection_required:
            cash_action = db.query(Action).filter(
                Action.job_id == job_id,
                Action.driver_id == driver.id,
                Action.action_type == "cash_collection",
            ).first()
            if not cash_action:
                raise APIError(
                    422, "validation_error",
                    "Cash collection is required before marking as delivered",
                    fields={"cash_collection": "required"},
                )

    # 6. Write to Odoo
    try:
        if body.status == "delivered":
            odoo.mark_delivered(job_id)
        elif body.status == "failed":
            note = f"FAILED: {body.reason}"
            if body.note:
                note += f" - {body.note}"
            odoo.update_driver_status(job_id, body.status, note)
        else:
            odoo.update_driver_status(job_id, body.status, body.note)
    except (xmlrpc.client.Fault, Exception) as e:
        raise APIError(502, "odoo_error", "Odoo is unavailable or rejected the request")

    # 7. Log Action to DB
    result_data = {"status": body.status, "job_id": job_id}
    action = Action(
        action_id=body.action_id,
        driver_id=driver.id,
        job_id=job_id,
        action_type="status_update",
        payload=json.dumps(body.model_dump(), default=str),
        result=json.dumps(result_data),
    )
    db.add(action)
    db.commit()

    return StatusResponse(
        action_id=body.action_id,
        job_id=job_id,
        status=body.status,
        accepted=True,
        replayed=False,
    )
