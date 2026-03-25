import base64
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.auth import get_current_driver
from app.database import get_db
from app.models import Action, Driver
from app.schemas import (
    BatchRequest,
    BatchResponse,
    BatchResult,
    SyncStatusResponse,
)

router = APIRouter(tags=["sync"])


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
    request: Request,
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    results = []
    synced = 0
    failed = 0

    auth_header = request.headers.get("authorization", "")
    internal_client = TestClient(request.app)

    for action in body.actions:
        try:
            url = f"/api/v1{action.endpoint}"

            if action.file:
                # Upload action: decode base64 and send as multipart
                file_bytes = base64.b64decode(action.file)
                file_obj = io.BytesIO(file_bytes)
                resp = internal_client.post(
                    url,
                    files={"file": ("upload.jpg", file_obj, "image/jpeg")},
                    headers={"Authorization": auth_header},
                )
            elif action.method.upper() == "POST":
                resp = internal_client.post(
                    url,
                    json=action.body,
                    headers={"Authorization": auth_header},
                )
            elif action.method.upper() == "GET":
                resp = internal_client.get(
                    url,
                    headers={"Authorization": auth_header},
                )
            else:
                results.append(BatchResult(
                    action_id=action.action_id,
                    accepted=False,
                    error="unsupported_method",
                    message=f"Method {action.method} not supported",
                ))
                failed += 1
                continue

            data = resp.json()

            if resp.status_code < 400:
                replayed = data.get("replayed", False)
                upload_id = data.get("upload_id", None)
                results.append(BatchResult(
                    action_id=action.action_id,
                    accepted=True,
                    replayed=replayed,
                    upload_id=upload_id,
                ))
                synced += 1
            else:
                detail = data.get("detail", str(data))
                results.append(BatchResult(
                    action_id=action.action_id,
                    accepted=False,
                    error="endpoint_error",
                    message=detail,
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
