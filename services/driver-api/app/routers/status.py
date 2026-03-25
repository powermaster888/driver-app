import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_driver
from app.database import get_db
from app.models import Action, Driver
from app.odoo_client import odoo
from app.schemas import StatusRequest, StatusResponse
from app.state_machine import is_valid_transition, FAILURE_REASONS

router = APIRouter(tags=["status"])


@router.post("/jobs/{job_id}/status", response_model=StatusResponse)
def update_status(
    job_id: int,
    body: StatusRequest,
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    # 1. Check idempotent replay
    existing = db.query(Action).filter(Action.action_id == body.action_id).first()
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
    picking = odoo.get_job_detail(job_id, driver.odoo_shipper_value)
    if not picking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    current_status = picking.get("x_studio_driver_status") or "assigned"

    # 3. Validate transition
    if not is_valid_transition(current_status, body.status):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid transition from '{current_status}' to '{body.status}'",
        )

    # 4. Validate "failed" has reason
    if body.status == "failed":
        if not body.reason:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Failure reason is required when status is 'failed'",
            )
        if body.reason not in FAILURE_REASONS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid failure reason: '{body.reason}'",
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
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Proof of delivery is required before marking as delivered",
            )

        # Check cash collection if required
        sale_id = picking["sale_id"][0] if picking.get("sale_id") else None
        collection_required, _, _ = odoo.resolve_collection(sale_id)
        if collection_required:
            cash_action = db.query(Action).filter(
                Action.job_id == job_id,
                Action.driver_id == driver.id,
                Action.action_type == "cash_collection",
            ).first()
            if not cash_action:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Cash collection is required before marking as delivered",
                )

    # 6. Write to Odoo
    if body.status == "delivered":
        odoo.mark_delivered(job_id)
    else:
        odoo.update_driver_status(job_id, body.status, body.note)

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
