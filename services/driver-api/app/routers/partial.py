import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.auth import get_current_driver
from app.database import get_db
from app.errors import APIError
from app.models import Driver, Action
from app.odoo_client import odoo

router = APIRouter(tags=["partial"])


class ItemQuantity(BaseModel):
    move_id: int
    delivered_qty: float


class PartialDeliveryRequest(BaseModel):
    action_id: str
    items: list[ItemQuantity]
    timestamp: str


@router.post("/jobs/{job_id}/partial-delivery")
def partial_delivery(
    job_id: int,
    body: PartialDeliveryRequest,
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    # Idempotent check
    existing = db.query(Action).filter(Action.action_id == body.action_id, Action.driver_id == driver.id).first()
    if existing:
        return json.loads(existing.result)

    # Verify job
    picking = odoo.get_job_detail(job_id, driver.odoo_shipper_value)
    if not picking:
        raise APIError(404, "not_found", "Job not found")

    try:
        # Write delivered quantities to each stock.move
        for item in body.items:
            odoo.write("stock.move", [item.move_id], {"quantity": item.delivered_qty})

        # Validate the picking — Odoo will create backorder for remaining qty
        result = odoo.mark_delivered(job_id)

        result_data = {
            "action_id": body.action_id,
            "job_id": job_id,
            "accepted": True,
            "partial": any(
                i.delivered_qty < odoo.read("stock.move", [i.move_id], ["product_uom_qty"])[0].get("product_uom_qty", 0)
                for i in body.items
            ) if body.items else False,
        }
    except Exception as e:
        raise APIError(502, "odoo_error", f"Odoo error: {str(e)}")

    # Log action
    db.add(Action(
        action_id=body.action_id,
        driver_id=driver.id,
        job_id=job_id,
        action_type="partial_delivery",
        payload=json.dumps(body.model_dump(), default=str),
        result=json.dumps(result_data),
    ))
    db.commit()

    return result_data
