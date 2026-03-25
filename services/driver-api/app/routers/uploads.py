import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.auth import get_current_driver
from app.config import settings
from app.database import get_db
from app.models import Driver, Upload
from app.schemas import UploadResponse

router = APIRouter(tags=["uploads"])

ALLOWED_TYPES = {"photo", "signature"}


@router.post("/uploads", response_model=UploadResponse)
def upload_file(
    file: UploadFile = File(...),
    type: str = Form(...),
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    if type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid type '{type}'. Must be one of: {', '.join(ALLOWED_TYPES)}",
        )

    # Read file content and check size
    content = file.file.read()
    if len(content) > settings.upload_max_bytes:
        raise HTTPException(
            status_code=413,
            detail="File too large",
        )

    # Generate upload_id
    upload_id = f"up_{uuid.uuid4().hex[:8]}"

    # Ensure upload directory exists
    os.makedirs(settings.upload_dir, exist_ok=True)

    # Save to disk
    ext = os.path.splitext(file.filename or "file")[1] or ".bin"
    file_path = os.path.join(settings.upload_dir, f"{upload_id}{ext}")
    with open(file_path, "wb") as f:
        f.write(content)

    # Create Upload record
    upload = Upload(
        upload_id=upload_id,
        driver_id=driver.id,
        file_type=type,
        file_path=file_path,
        mimetype=file.content_type or "application/octet-stream",
        size_bytes=len(content),
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    return UploadResponse(
        upload_id=upload.upload_id,
        type=upload.file_type,
        size_bytes=upload.size_bytes,
        mimetype=upload.mimetype,
        uploaded_at=upload.created_at,
    )
