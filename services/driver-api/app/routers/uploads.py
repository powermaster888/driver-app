import os
import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.auth import get_current_driver
from app.config import settings
from app.database import get_db
from app.errors import APIError
from app.models import Driver, Upload
from app.schemas import UploadResponse

router = APIRouter(tags=["uploads"])

ALLOWED_TYPES = {"photo", "signature"}
PHOTO_MIMETYPES = {"image/jpeg", "image/png"}
SIGNATURE_MIMETYPES = {"image/png"}


@router.post("/uploads", response_model=UploadResponse)
def upload_file(
    file: UploadFile = File(...),
    type: str = Form(...),
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    if type not in ALLOWED_TYPES:
        raise APIError(
            422, "validation_error",
            f"Invalid type '{type}'. Must be one of: {', '.join(ALLOWED_TYPES)}",
            fields={"type": f"must be one of: {', '.join(ALLOWED_TYPES)}"},
        )

    # Validate MIME type
    mimetype = file.content_type or "application/octet-stream"
    if type == "photo" and mimetype not in PHOTO_MIMETYPES:
        raise APIError(
            422, "validation_error",
            f"Invalid file type for photo. Must be one of: {', '.join(PHOTO_MIMETYPES)}",
            fields={"file": f"mimetype must be one of: {', '.join(PHOTO_MIMETYPES)}"},
        )
    if type == "signature" and mimetype not in SIGNATURE_MIMETYPES:
        raise APIError(
            422, "validation_error",
            f"Invalid file type for signature. Must be image/png",
            fields={"file": "mimetype must be image/png"},
        )

    # Read file content and check size
    content = file.file.read()
    if len(content) > settings.upload_max_bytes:
        raise APIError(
            413, "file_too_large",
            "Maximum file size is 10MB",
            max_bytes=settings.upload_max_bytes,
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
        mimetype=mimetype,
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
