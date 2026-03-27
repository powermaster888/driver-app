import base64
import json
import xmlrpc.client

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_driver
from app.database import get_db
from app.errors import APIError
from app.models import Action, Driver, Upload
from app.odoo_client import odoo
from app.schemas import PodRequest, PodResponse

router = APIRouter(tags=["pod"])


@router.post("/jobs/{job_id}/proof-of-delivery", response_model=PodResponse)
def submit_pod(
    job_id: int,
    body: PodRequest,
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    # 1. Idempotent check (scoped to driver)
    existing = db.query(Action).filter(Action.action_id == body.action_id, Action.driver_id == driver.id).first()
    if existing:
        result = json.loads(existing.result)
        return PodResponse(
            action_id=body.action_id,
            job_id=job_id,
            accepted=True,
            photos_synced=result.get("photos_synced", 0),
            signature_synced=result.get("signature_synced", False),
        )

    # 2. Verify job exists
    try:
        picking = odoo.get_job_detail(job_id, driver.odoo_shipper_value)
    except (xmlrpc.client.Fault, Exception) as e:
        raise APIError(502, "odoo_error", "Cannot reach server — please try again later")
    if not picking:
        raise APIError(404, "not_found", "This job was not found or is not assigned to you")

    # 3. Read Upload records for photos
    photos_synced = 0
    for upload_id in body.photo_upload_ids:
        upload = db.query(Upload).filter(
            Upload.upload_id == upload_id, Upload.driver_id == driver.id
        ).first()
        if not upload:
            raise APIError(404, "not_found", f"Photo upload '{upload_id}' was not found — please re-upload")
        # Read file and base64 encode
        with open(upload.file_path, "rb") as f:
            data_b64 = base64.b64encode(f.read()).decode("utf-8")
        try:
            odoo.create_attachment(job_id, f"pod_{upload_id}{_ext(upload.file_path)}", data_b64, upload.mimetype)
        except (xmlrpc.client.Fault, Exception) as e:
            raise APIError(502, "odoo_error", "Cannot reach server — please try again later")
        photos_synced += 1

    # 4. Handle signature if present
    signature_synced = False
    if body.signature_upload_id:
        sig_upload = db.query(Upload).filter(
            Upload.upload_id == body.signature_upload_id, Upload.driver_id == driver.id
        ).first()
        if not sig_upload:
            raise APIError(404, "not_found", "Signature upload was not found — please sign again")
        with open(sig_upload.file_path, "rb") as f:
            sig_b64 = base64.b64encode(f.read()).decode("utf-8")
        try:
            odoo.save_signature(job_id, sig_b64)
        except (xmlrpc.client.Fault, Exception) as e:
            raise APIError(502, "odoo_error", "Cannot reach server — please try again later")
        signature_synced = True

    # 5. Link uploads to job
    upload_ids = body.photo_upload_ids[:]
    if body.signature_upload_id:
        upload_ids.append(body.signature_upload_id)
    db.query(Upload).filter(Upload.upload_id.in_(upload_ids)).update(
        {"linked_job_id": job_id}, synchronize_session="fetch"
    )

    # 6. Log Action
    result_data = {
        "job_id": job_id,
        "photos_synced": photos_synced,
        "signature_synced": signature_synced,
    }
    action = Action(
        action_id=body.action_id,
        driver_id=driver.id,
        job_id=job_id,
        action_type="proof_of_delivery",
        payload=json.dumps(body.model_dump(), default=str),
        result=json.dumps(result_data),
    )
    db.add(action)
    db.commit()

    return PodResponse(
        action_id=body.action_id,
        job_id=job_id,
        accepted=True,
        photos_synced=photos_synced,
        signature_synced=signature_synced,
    )


def _ext(path: str) -> str:
    import os
    return os.path.splitext(path)[1] or ""
