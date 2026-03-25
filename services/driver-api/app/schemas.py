from datetime import datetime
from pydantic import BaseModel, Field


# --- Auth ---
class LoginRequest(BaseModel):
    phone: str
    pin: str


class DriverResponse(BaseModel):
    id: int
    name: str
    phone: str


class LoginResponse(BaseModel):
    token: str
    driver: DriverResponse


# --- Error ---
class ErrorResponse(BaseModel):
    error: str
    message: str
    fields: dict[str, str] = {}


# --- Jobs ---
class JobItem(BaseModel):
    product_name: str
    quantity: float


class JobSummary(BaseModel):
    job_id: int
    odoo_reference: str
    sales_order_ref: str | None = None
    customer_name: str
    phone: str | None = None
    address: str | None = None
    warehouse: str
    scheduled_date: datetime
    status: str
    collection_required: bool = False
    collection_method: str | None = None
    expected_collection_amount: float | None = None
    sync_status: str = "synced"


class JobListResponse(BaseModel):
    jobs: list[JobSummary]
    fetched_at: datetime


class JobDetail(JobSummary):
    delivery_notes: str | None = None
    additional_info: str | None = None
    account_no: str | None = None
    items: list[JobItem] = []
    proof_of_delivery: dict | None = None
    cash_collection: dict | None = None


# --- Status ---
class StatusRequest(BaseModel):
    action_id: str
    status: str
    timestamp: datetime
    reason: str | None = None
    note: str | None = None


class StatusResponse(BaseModel):
    action_id: str
    job_id: int
    status: str
    accepted: bool = True
    replayed: bool = False


# --- Upload ---
class UploadResponse(BaseModel):
    upload_id: str
    type: str
    size_bytes: int
    mimetype: str
    uploaded_at: datetime


# --- POD ---
class PodRequest(BaseModel):
    action_id: str
    photo_upload_ids: list[str] = Field(min_length=1)
    signature_upload_id: str | None = None
    note: str | None = None
    timestamp: datetime


class PodResponse(BaseModel):
    action_id: str
    job_id: int
    accepted: bool = True
    photos_synced: int
    signature_synced: bool = False


# --- Cash ---
class CashRequest(BaseModel):
    action_id: str
    amount: float
    method: str
    reference: str
    photo_upload_id: str | None = None
    timestamp: datetime


class CashResponse(BaseModel):
    action_id: str
    job_id: int
    accepted: bool = True
    amount: float
    method: str


# --- Sync ---
class BatchAction(BaseModel):
    action_id: str
    endpoint: str
    method: str
    body: dict | None = None
    file: str | None = None


class BatchRequest(BaseModel):
    actions: list[BatchAction]


class BatchResult(BaseModel):
    action_id: str
    accepted: bool
    replayed: bool = False
    upload_id: str | None = None
    error: str | None = None
    message: str | None = None


class BatchResponse(BaseModel):
    results: list[BatchResult]
    synced: int
    failed: int


class SyncStatusResponse(BaseModel):
    driver_id: int
    last_sync_at: datetime | None = None
    pending_actions: int = 0
    last_error: str | None = None
