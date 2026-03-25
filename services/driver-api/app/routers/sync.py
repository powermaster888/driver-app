import base64
import os
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.auth import get_current_driver
from app.config import settings
from app.database import get_db
from app.errors import APIError
from app.models import Action, Driver, Upload
from app.schemas import (
    BatchAction,
    BatchRequest,
    BatchResponse,
    BatchResult,
    CashRequest,
    PodRequest,
    StatusRequest,
    SyncStatusResponse,
)
from app.routers.status import update_status as _update_status
from app.routers.pod import submit_pod as _submit_pod
from app.routers.cash import submit_cash_collection as _submit_cash

router = APIRouter(tags=["sync"])


def _dispatch_action(action: BatchAction, driver: Driver, db: Session) -> BatchResult:
    """Route a batch action to the appropriate handler and return a BatchResult."""
    endpoint = action.endpoint

    # Match /jobs/:id/status
    m = re.match(r"^/jobs/(\d+)/status$", endpoint)
    if m:
        job_id = int(m.group(1))
        req = StatusRequest(**action.body)
        result = _update_status(job_id, req, driver, db)
        return BatchResult(
            action_id=action.action_id,
            accepted=True,
            replayed=result.replayed,
        )

    # Match /jobs/:id/proof-of-delivery
    m = re.match(r"^/jobs/(\d+)/proof-of-delivery$", endpoint)
    if m:
        job_id = int(m.group(1))
        req = PodRequest(**action.body)
        result = _submit_pod(job_id, req, driver, db)
        return BatchResult(
            action_id=action.action_id,
            accepted=True,
            replayed=False,
        )

    # Match /jobs/:id/cash-collection
    m = re.match(r"^/jobs/(\d+)/cash-collection$", endpoint)
    if m:
        job_id = int(m.group(1))
        req = CashRequest(**action.body)
        result = _submit_cash(job_id, req, driver, db)
        return BatchResult(
            action_id=action.action_id,
            accepted=True,
            replayed=False,
        )

    # Match /uploads (with base64 file data)
    if endpoint == "/uploads" and action.file:
        file_bytes = base64.b64decode(action.file)
        upload_id = f"up_{uuid.uuid4().hex[:8]}"
        file_type = (action.body or {}).get("type", "photo")
        mimetype = (action.body or {}).get("mimetype", "image/jpeg")

        os.makedirs(settings.upload_dir, exist_ok=True)
        ext = ".jpg" if mimetype == "image/jpeg" else ".png" if mimetype == "image/png" else ".bin"
        file_path = os.path.join(settings.upload_dir, f"{upload_id}{ext}")
        with open(file_path, "wb") as f:
            f.write(file_bytes)

        upload = Upload(
            upload_id=upload_id,
            driver_id=driver.id,
            file_type=file_type,
            file_path=file_path,
            mimetype=mimetype,
            size_bytes=len(file_bytes),
        )
        db.add(upload)
        db.commit()

        return BatchResult(
            action_id=action.action_id,
            accepted=True,
            upload_id=upload_id,
        )

    return BatchResult(
        action_id=action.action_id,
        accepted=False,
        error="unsupported_endpoint",
        message=f"Endpoint {endpoint} is not supported in batch sync",
    )


@router.get("/sync/status", response_model=SyncStatusResponse)
def sync_status(
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    latest_action = (
        db.query(Action)
        .filter(Action.driver_id == driver.id)
        .order_by(desc(Action.created_at))
        .first()
    )
    last_sync_at = latest_action.created_at if latest_action else None
    return SyncStatusResponse(
        driver_id=driver.id,
        last_sync_at=last_sync_at,
        pending_actions=0,
    )


@router.post("/sync/batch", response_model=BatchResponse)
def batch_sync(
    body: BatchRequest,
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    results = []
    synced = 0
    failed = 0

    for action in body.actions:
        try:
            result = _dispatch_action(action, driver, db)
            results.append(result)
            if result.accepted:
                synced += 1
            else:
                failed += 1
        except APIError as e:
            results.append(BatchResult(
                action_id=action.action_id,
                accepted=False,
                error=e.error,
                message=e.message,
            ))
            failed += 1
        except Exception as e:
            results.append(BatchResult(
                action_id=action.action_id,
                accepted=False,
                error="internal_error",
                message=str(e),
            ))
            failed += 1

    return BatchResponse(results=results, synced=synced, failed=failed)
