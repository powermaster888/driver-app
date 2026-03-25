# Driver API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FastAPI driver-api service that translates between the mobile app and Odoo 19.

**Architecture:** FastAPI service with SQLite for driver auth and action log, Odoo XML-RPC for ERP reads/writes. Each endpoint maps to Odoo operations documented in `docs/odoo-integration.md`. Idempotency via client-generated `action_id` stored in SQLite.

**Tech Stack:** Python 3.12, FastAPI, SQLite (via SQLAlchemy), python-jose (JWT), bcrypt, OdooRPC or xmlrpc.client, pytest, httpx (test client)

**Spec:** `docs/superpowers/specs/2026-03-26-api-contract-design.md`
**Odoo mapping:** `docs/odoo-integration.md`

---

## File Structure

```
services/driver-api/
├── pyproject.toml                  # Project config, dependencies
├── alembic.ini                     # DB migrations config
├── alembic/
│   └── versions/                   # Migration scripts
├── app/
│   ├── __init__.py
│   ├── main.py                     # FastAPI app, router mounting, lifespan
│   ├── config.py                   # Settings from env vars
│   ├── database.py                 # SQLAlchemy engine, session
│   ├── models.py                   # SQLAlchemy models (Driver, Action, Upload)
│   ├── schemas.py                  # Pydantic request/response models
│   ├── auth.py                     # JWT creation, verification, dependency
│   ├── odoo_client.py              # Odoo XML-RPC wrapper
│   ├── state_machine.py            # Status transitions and validation
│   └── routers/
│       ├── __init__.py
│       ├── auth.py                 # POST /auth/login
│       ├── jobs.py                 # GET /me/jobs, GET /jobs/:id
│       ├── status.py               # POST /jobs/:id/status
│       ├── uploads.py              # POST /uploads
│       ├── pod.py                  # POST /jobs/:id/proof-of-delivery
│       ├── cash.py                 # POST /jobs/:id/cash-collection
│       └── sync.py                 # POST /sync/batch, GET /sync/status
├── scripts/
│   └── seed_drivers.py             # Seed the 3 initial drivers
└── tests/
    ├── conftest.py                 # Fixtures: test client, test DB, mock Odoo
    ├── test_auth.py
    ├── test_jobs.py
    ├── test_status.py
    ├── test_uploads.py
    ├── test_pod.py
    ├── test_cash.py
    ├── test_sync.py
    └── test_state_machine.py
```

---

## Task 1: Project Scaffold and Config

**Files:**
- Create: `services/driver-api/pyproject.toml`
- Create: `services/driver-api/app/__init__.py`
- Create: `services/driver-api/app/main.py`
- Create: `services/driver-api/app/config.py`

- [ ] **Step 1: Create pyproject.toml**

```toml
[project]
name = "driver-api"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.34",
    "sqlalchemy>=2.0",
    "alembic>=1.14",
    "python-jose[cryptography]>=3.3",
    "bcrypt>=4.2",
    "python-multipart>=0.0.18",
    "pydantic-settings>=2.7",
    "httpx>=0.28",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.25",
    "httpx>=0.28",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

- [ ] **Step 2: Create config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./driver_api.db"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30
    odoo_url: str = "https://hlm260321.odoo.com"
    odoo_db: str = "hlm260321"
    odoo_username: str = ""
    odoo_api_key: str = ""
    upload_max_bytes: int = 10_485_760  # 10MB
    upload_dir: str = "./uploads"

    model_config = {"env_prefix": "DRIVER_API_"}


settings = Settings()
```

- [ ] **Step 3: Create main.py**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.database import create_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


app = FastAPI(title="Driver API", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Create __init__.py**

Empty file.

- [ ] **Step 5: Install and verify**

```bash
cd services/driver-api
pip install -e ".[dev]"
uvicorn app.main:app --port 8000 &
curl http://localhost:8000/health
# Expected: {"status":"ok"}
kill %1
```

- [ ] **Step 6: Commit**

```bash
git add services/driver-api/
git commit -m "feat: scaffold driver-api FastAPI project with config"
```

---

## Task 2: Database Models and Migrations

**Files:**
- Create: `services/driver-api/app/database.py`
- Create: `services/driver-api/app/models.py`
- Create: `services/driver-api/scripts/seed_drivers.py`
- Create: `services/driver-api/alembic.ini`
- Create: `services/driver-api/alembic/env.py`

- [ ] **Step 1: Create database.py**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 2: Create models.py**

```python
import datetime
from sqlalchemy import String, Boolean, Float, DateTime, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    pin_hash: Mapped[str] = mapped_column(String(200))
    odoo_shipper_value: Mapped[str] = mapped_column(String(50))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Action(Base):
    __tablename__ = "actions"

    id: Mapped[int] = mapped_column(primary_key=True)
    action_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    driver_id: Mapped[int] = mapped_column(Integer)
    job_id: Mapped[int] = mapped_column(Integer)
    action_type: Mapped[str] = mapped_column(String(50))
    payload: Mapped[str] = mapped_column(Text)
    result: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )


class Upload(Base):
    __tablename__ = "uploads"

    id: Mapped[int] = mapped_column(primary_key=True)
    upload_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    driver_id: Mapped[int] = mapped_column(Integer)
    file_type: Mapped[str] = mapped_column(String(20))  # photo | signature
    file_path: Mapped[str] = mapped_column(String(500))
    mimetype: Mapped[str] = mapped_column(String(50))
    size_bytes: Mapped[int] = mapped_column(Integer)
    linked_job_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )
```

- [ ] **Step 3: Create seed_drivers.py**

```python
"""Seed the 3 initial drivers. Run once: python -m scripts.seed_drivers"""
import bcrypt
from app.database import SessionLocal, create_tables
from app.models import Driver

DRIVERS = [
    {"name": "耀", "phone": "+85200000001", "pin": "1234", "odoo_shipper_value": "耀"},
    {"name": "盧生", "phone": "+85200000002", "pin": "1234", "odoo_shipper_value": "盧生"},
    {"name": "Barry", "phone": "+85200000003", "pin": "1234", "odoo_shipper_value": "Barry"},
]


def seed():
    create_tables()
    db = SessionLocal()
    for d in DRIVERS:
        existing = db.query(Driver).filter_by(phone=d["phone"]).first()
        if existing:
            print(f"Driver {d['name']} already exists, skipping")
            continue
        pin_hash = bcrypt.hashpw(d["pin"].encode(), bcrypt.gensalt()).decode()
        driver = Driver(
            name=d["name"],
            phone=d["phone"],
            pin_hash=pin_hash,
            odoo_shipper_value=d["odoo_shipper_value"],
            active=True,
        )
        db.add(driver)
        print(f"Created driver: {d['name']}")
    db.commit()
    db.close()


if __name__ == "__main__":
    seed()
```

- [ ] **Step 4: Run seed and verify**

```bash
cd services/driver-api
python -m scripts.seed_drivers
# Expected: Created driver: 耀 / Created driver: 盧生 / Created driver: Barry
```

- [ ] **Step 5: Commit**

```bash
git add services/driver-api/
git commit -m "feat: add database models (Driver, Action, Upload) and seed script"
```

---

## Task 3: Pydantic Schemas

**Files:**
- Create: `services/driver-api/app/schemas.py`

- [ ] **Step 1: Create schemas.py**

```python
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
    method: str  # cash | cheque
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
    file: str | None = None  # base64 for uploads


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
```

- [ ] **Step 2: Commit**

```bash
git add services/driver-api/app/schemas.py
git commit -m "feat: add Pydantic request/response schemas for all endpoints"
```

---

## Task 4: Auth (JWT + Login Endpoint)

**Files:**
- Create: `services/driver-api/app/auth.py`
- Create: `services/driver-api/app/routers/auth.py`
- Create: `services/driver-api/app/routers/__init__.py`
- Create: `services/driver-api/tests/conftest.py`
- Create: `services/driver-api/tests/test_auth.py`

- [ ] **Step 1: Write test_auth.py**

```python
from fastapi.testclient import TestClient


def test_login_success(client, seeded_db):
    resp = client.post("/api/v1/auth/login", json={"phone": "+85200000001", "pin": "1234"})
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["driver"]["name"] == "耀"


def test_login_wrong_pin(client, seeded_db):
    resp = client.post("/api/v1/auth/login", json={"phone": "+85200000001", "pin": "9999"})
    assert resp.status_code == 401
    assert resp.json()["error"] == "invalid_credentials"


def test_login_unknown_phone(client, seeded_db):
    resp = client.post("/api/v1/auth/login", json={"phone": "+85299999999", "pin": "1234"})
    assert resp.status_code == 401


def test_protected_endpoint_no_token(client):
    resp = client.get("/api/v1/me/jobs?scope=today")
    assert resp.status_code == 401


def test_protected_endpoint_with_token(client, seeded_db, auth_token):
    resp = client.get("/api/v1/me/jobs?scope=today", headers={"Authorization": f"Bearer {auth_token}"})
    # May return empty jobs but should not be 401
    assert resp.status_code == 200
```

- [ ] **Step 2: Create conftest.py**

```python
import bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import Driver

TEST_DB_URL = "sqlite:///./test.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def seeded_db(db):
    pin_hash = bcrypt.hashpw(b"1234", bcrypt.gensalt()).decode()
    for name, phone, shipper in [
        ("耀", "+85200000001", "耀"),
        ("盧生", "+85200000002", "盧生"),
        ("Barry", "+85200000003", "Barry"),
    ]:
        db.add(Driver(name=name, phone=phone, pin_hash=pin_hash, odoo_shipper_value=shipper, active=True))
    db.commit()
    return db


@pytest.fixture
def auth_token(client, seeded_db):
    resp = client.post("/api/v1/auth/login", json={"phone": "+85200000001", "pin": "1234"})
    return resp.json()["token"]
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd services/driver-api
pytest tests/test_auth.py -v
# Expected: FAIL — routers not implemented yet
```

- [ ] **Step 4: Create app/auth.py**

```python
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Driver

security = HTTPBearer()


def create_token(driver_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days)
    return jwt.encode(
        {"sub": str(driver_id), "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def get_current_driver(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Driver:
    try:
        payload = jwt.decode(
            credentials.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        driver_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")
    driver = db.query(Driver).filter_by(id=driver_id, active=True).first()
    if not driver:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")
    return driver
```

- [ ] **Step 5: Create app/routers/__init__.py**

Empty file.

- [ ] **Step 6: Create app/routers/auth.py**

```python
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Driver
from app.schemas import LoginRequest, LoginResponse, DriverResponse
from app.auth import create_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    driver = db.query(Driver).filter_by(phone=body.phone, active=True).first()
    if not driver or not bcrypt.checkpw(body.pin.encode(), driver.pin_hash.encode()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "invalid_credentials", "message": "Phone or PIN is incorrect"},
        )
    token = create_token(driver.id)
    return LoginResponse(
        token=token,
        driver=DriverResponse(id=driver.id, name=driver.name, phone=driver.phone),
    )
```

- [ ] **Step 7: Mount router in main.py**

Update `app/main.py` to add:

```python
from app.routers import auth as auth_router, jobs as jobs_router

app.include_router(auth_router.router, prefix="/api/v1")
```

Note: `jobs_router` will be stubbed in the next task. For now, create a minimal `app/routers/jobs.py`:

```python
from fastapi import APIRouter, Depends
from app.auth import get_current_driver
from app.schemas import JobListResponse
from datetime import datetime, timezone

router = APIRouter(tags=["jobs"])


@router.get("/me/jobs", response_model=JobListResponse)
def list_jobs(scope: str = "today", driver=Depends(get_current_driver)):
    return JobListResponse(jobs=[], fetched_at=datetime.now(timezone.utc))
```

Mount it: `app.include_router(jobs_router.router, prefix="/api/v1")`

- [ ] **Step 8: Run tests**

```bash
pytest tests/test_auth.py -v
# Expected: all 5 PASS
```

- [ ] **Step 9: Commit**

```bash
git add services/driver-api/
git commit -m "feat: add auth endpoint with JWT and login tests"
```

---

## Task 5: State Machine

**Files:**
- Create: `services/driver-api/app/state_machine.py`
- Create: `services/driver-api/tests/test_state_machine.py`

- [ ] **Step 1: Write test_state_machine.py**

```python
from app.state_machine import is_valid_transition, get_allowed_transitions, FAILURE_REASONS


def test_assigned_to_accepted():
    assert is_valid_transition("assigned", "accepted") is True


def test_assigned_to_delivered_invalid():
    assert is_valid_transition("assigned", "delivered") is False


def test_arrived_to_failed():
    assert is_valid_transition("arrived", "failed") is True


def test_on_the_way_to_failed():
    assert is_valid_transition("on_the_way", "failed") is True


def test_failed_to_returned():
    assert is_valid_transition("failed", "returned") is True


def test_delivered_is_terminal():
    assert get_allowed_transitions("delivered") == []


def test_returned_is_terminal():
    assert get_allowed_transitions("returned") == []


def test_allowed_from_arrived():
    allowed = get_allowed_transitions("arrived")
    assert set(allowed) == {"delivered", "failed"}


def test_failure_reasons():
    assert "customer_not_home" in FAILURE_REASONS
    assert "other" in FAILURE_REASONS
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_state_machine.py -v
# Expected: FAIL — module not found
```

- [ ] **Step 3: Create state_machine.py**

```python
TRANSITIONS: dict[str, list[str]] = {
    "assigned": ["accepted"],
    "accepted": ["on_the_way"],
    "on_the_way": ["arrived", "failed"],
    "arrived": ["delivered", "failed"],
    "failed": ["returned"],
    "delivered": [],
    "returned": [],
}

FAILURE_REASONS = [
    "customer_not_home",
    "wrong_address",
    "customer_refused",
    "access_issue",
    "other",
]


def is_valid_transition(current: str, target: str) -> bool:
    return target in TRANSITIONS.get(current, [])


def get_allowed_transitions(current: str) -> list[str]:
    return TRANSITIONS.get(current, [])
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_state_machine.py -v
# Expected: all PASS
```

- [ ] **Step 5: Commit**

```bash
git add services/driver-api/app/state_machine.py services/driver-api/tests/test_state_machine.py
git commit -m "feat: add delivery status state machine with transition validation"
```

---

## Task 6: Odoo Client

**Files:**
- Create: `services/driver-api/app/odoo_client.py`

- [ ] **Step 1: Create odoo_client.py**

```python
"""Thin wrapper around Odoo XML-RPC. All Odoo complexity lives here."""
import xmlrpc.client
from app.config import settings

# Delivery order picking type IDs (excludes PoS)
DELIVERY_PICKING_TYPES = [2, 8, 13, 50]

# Payment terms that require cash collection
COD_PAYMENT_TERMS = {11: "cash", 12: "cheque"}

# Warehouse names by picking type
WAREHOUSE_NAMES = {2: "HQ", 8: "KT", 13: "YL", 50: "TP"}


class OdooClient:
    def __init__(self):
        self.url = settings.odoo_url
        self.db = settings.odoo_db
        self.username = settings.odoo_username
        self.api_key = settings.odoo_api_key
        self._uid = None

    @property
    def uid(self):
        if self._uid is None:
            common = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/common")
            self._uid = common.authenticate(self.db, self.username, self.api_key, {})
        return self._uid

    @property
    def models(self):
        return xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/object")

    def execute(self, model: str, method: str, *args, **kwargs):
        return self.models.execute_kw(
            self.db, self.uid, self.api_key, model, method, list(args), kwargs
        )

    def search_read(self, model: str, domain: list, fields: list, **kwargs):
        return self.execute(model, "search_read", domain, fields=fields, **kwargs)

    def read(self, model: str, ids: list, fields: list):
        return self.execute(model, "read", ids, fields=fields)

    def write(self, model: str, ids: list, vals: dict):
        return self.execute(model, "write", ids, vals)

    def create(self, model: str, vals: dict):
        return self.execute(model, "create", [vals])

    def get_driver_jobs(self, shipper_value: str, scope: str) -> list[dict]:
        """Fetch jobs for a driver from Odoo."""
        from datetime import datetime, timedelta

        domain = [
            ("picking_type_id", "in", DELIVERY_PICKING_TYPES),
            ("x_studio_shipper", "=", shipper_value),
        ]

        if scope == "today":
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d 00:00:00")
            tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d 00:00:00")
            domain += [
                ("scheduled_date", ">=", today),
                ("scheduled_date", "<", tomorrow),
                ("state", "in", ["confirmed", "assigned"]),
            ]
        elif scope == "pending":
            domain += [("state", "in", ["confirmed", "assigned"])]
        elif scope == "recent":
            week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d 00:00:00")
            domain += [("state", "=", "done"), ("date_done", ">=", week_ago)]

        fields = [
            "name", "origin", "state", "partner_id", "scheduled_date",
            "sale_id", "x_studio_shipper", "x_studio_do_note", "note",
            "x_studio_actual_delivery_date", "x_studio_hapo",
            "x_studio_account_no", "x_studio_driver_status",
            "picking_type_id", "move_ids",
        ]
        return self.search_read("stock.picking", domain, fields, order="scheduled_date asc")

    def get_job_detail(self, picking_id: int, shipper_value: str) -> dict | None:
        """Fetch a single job with full detail."""
        results = self.search_read(
            "stock.picking",
            [("id", "=", picking_id), ("x_studio_shipper", "=", shipper_value)],
            [
                "name", "origin", "state", "partner_id", "scheduled_date",
                "sale_id", "x_studio_shipper", "x_studio_do_note", "note",
                "x_studio_actual_delivery_date", "x_studio_hapo",
                "x_studio_account_no", "x_studio_driver_status",
                "picking_type_id", "move_ids",
            ],
        )
        return results[0] if results else None

    def get_partner(self, partner_id: int) -> dict:
        results = self.read("res.partner", [partner_id], ["display_name", "phone", "street", "street2"])
        return results[0] if results else {}

    def get_sale_order(self, sale_id: int) -> dict:
        results = self.read("sale.order", [sale_id], ["name", "amount_total", "payment_term_id"])
        return results[0] if results else {}

    def get_move_lines(self, move_ids: list[int]) -> list[dict]:
        return self.read("stock.move", move_ids, ["product_id", "product_uom_qty"])

    def resolve_collection(self, sale_id: int | None) -> tuple[bool, str | None, float | None]:
        """Check if a job requires cash collection. Returns (required, method, amount)."""
        if not sale_id:
            return False, None, None
        so = self.get_sale_order(sale_id)
        if not so or not so.get("payment_term_id"):
            return False, None, None
        term_id = so["payment_term_id"][0]
        if term_id in COD_PAYMENT_TERMS:
            return True, COD_PAYMENT_TERMS[term_id], so.get("amount_total", 0)
        return False, None, None

    def mark_delivered(self, picking_id: int):
        """Set picking to done and record delivery date."""
        from datetime import date
        self.execute("stock.picking", "button_validate", [picking_id])
        self.write("stock.picking", [picking_id], {
            "x_studio_actual_delivery_date": date.today().isoformat(),
            "x_studio_driver_status": "delivered",
        })

    def update_driver_status(self, picking_id: int, status: str, note: str | None = None):
        vals: dict = {"x_studio_driver_status": status}
        if note:
            vals["x_studio_do_note"] = note
        self.write("stock.picking", [picking_id], vals)

    def save_cash_collection(self, picking_id: int, amount: float, method: str, reference: str):
        from datetime import datetime
        self.write("stock.picking", [picking_id], {
            "x_studio_cash_amount": amount,
            "x_studio_cash_method": method,
            "x_studio_cash_reference": reference,
            "x_studio_cash_collected_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        })

    def create_attachment(self, picking_id: int, filename: str, data_b64: str, mimetype: str):
        return self.create("ir.attachment", {
            "name": filename,
            "res_model": "stock.picking",
            "res_id": picking_id,
            "datas": data_b64,
            "mimetype": mimetype,
        })

    def save_signature(self, picking_id: int, signature_b64: str):
        self.write("stock.picking", [picking_id], {"signature": signature_b64})


odoo = OdooClient()
```

- [ ] **Step 2: Commit**

```bash
git add services/driver-api/app/odoo_client.py
git commit -m "feat: add Odoo XML-RPC client with job read/write operations"
```

---

## Task 7: Jobs Router

**Files:**
- Modify: `services/driver-api/app/routers/jobs.py`
- Create: `services/driver-api/tests/test_jobs.py`

- [ ] **Step 1: Write test_jobs.py**

```python
from unittest.mock import patch, MagicMock
from datetime import datetime


MOCK_PICKING = {
    "id": 120723,
    "name": "DO-26-09394",
    "origin": "SO-26-10732",
    "state": "assigned",
    "partner_id": [151221, "陳生"],
    "scheduled_date": "2026-03-25 10:03:36",
    "sale_id": [124482, "SO-26-10732"],
    "x_studio_shipper": "耀",
    "x_studio_do_note": "請打電話先",
    "note": False,
    "x_studio_actual_delivery_date": False,
    "x_studio_hapo": "網站訂單: 319602",
    "x_studio_account_no": "H44501",
    "x_studio_driver_status": False,
    "picking_type_id": [2, "HQ: Delivery Orders"],
    "move_ids": [317020, 317021],
}

MOCK_PARTNER = {
    "id": 151221,
    "display_name": "陳生",
    "phone": "+852 91234567",
    "street": "Room B03, 5/F, Ka To Factory Building",
    "street2": False,
}

MOCK_SO = {
    "id": 124482,
    "name": "SO-26-10732",
    "amount_total": 3985.0,
    "payment_term_id": [11, "貨到付款 - 現金"],
}

MOCK_MOVES = [
    {"id": 317020, "product_id": [47322, "[MEKI-0038] 日本 Terumo Syringe - 3ml"], "product_uom_qty": 10},
    {"id": 317021, "product_id": [47323, "[MEKI-0039] 日本 Terumo Syringe - 5ml"], "product_uom_qty": 10},
]


@patch("app.routers.jobs.odoo")
def test_list_jobs(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_driver_jobs.return_value = [MOCK_PICKING]
    mock_odoo.get_partner.return_value = MOCK_PARTNER
    mock_odoo.resolve_collection.return_value = (True, "cash", 3985.0)

    resp = client.get(
        "/api/v1/me/jobs?scope=today",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["jobs"]) == 1
    job = data["jobs"][0]
    assert job["odoo_reference"] == "DO-26-09394"
    assert job["collection_required"] is True
    assert job["collection_method"] == "cash"
    assert job["warehouse"] == "HQ"


@patch("app.routers.jobs.odoo")
def test_get_job_detail(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = MOCK_PICKING
    mock_odoo.get_partner.return_value = MOCK_PARTNER
    mock_odoo.resolve_collection.return_value = (True, "cash", 3985.0)
    mock_odoo.get_move_lines.return_value = MOCK_MOVES

    resp = client.get(
        "/api/v1/jobs/120723",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["job_id"] == 120723
    assert len(data["items"]) == 2
    assert data["items"][0]["product_name"] == "[MEKI-0038] 日本 Terumo Syringe - 3ml"


@patch("app.routers.jobs.odoo")
def test_get_job_not_found(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = None
    resp = client.get(
        "/api/v1/jobs/999999",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_jobs.py -v
# Expected: FAIL
```

- [ ] **Step 3: Implement app/routers/jobs.py**

```python
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_driver
from app.models import Driver
from app.odoo_client import odoo, WAREHOUSE_NAMES
from app.schemas import JobListResponse, JobSummary, JobDetail, JobItem

router = APIRouter(tags=["jobs"])


def _build_summary(picking: dict, partner: dict, collection: tuple) -> JobSummary:
    required, method, amount = collection
    pt_id = picking["picking_type_id"][0] if picking.get("picking_type_id") else None
    driver_status = picking.get("x_studio_driver_status") or "assigned"
    address_parts = [partner.get("street") or "", partner.get("street2") or ""]
    address = ", ".join(p for p in address_parts if p) or None

    return JobSummary(
        job_id=picking["id"],
        odoo_reference=picking["name"],
        sales_order_ref=picking.get("origin"),
        customer_name=partner.get("display_name", ""),
        phone=partner.get("phone"),
        address=address,
        warehouse=WAREHOUSE_NAMES.get(pt_id, "Unknown"),
        scheduled_date=picking["scheduled_date"],
        status=driver_status,
        collection_required=required,
        collection_method=method,
        expected_collection_amount=amount,
    )


@router.get("/me/jobs", response_model=JobListResponse)
def list_jobs(scope: str = "today", driver: Driver = Depends(get_current_driver)):
    pickings = odoo.get_driver_jobs(driver.odoo_shipper_value, scope)
    jobs = []
    for p in pickings:
        partner = odoo.get_partner(p["partner_id"][0]) if p.get("partner_id") else {}
        sale_id = p["sale_id"][0] if p.get("sale_id") else None
        collection = odoo.resolve_collection(sale_id)
        jobs.append(_build_summary(p, partner, collection))
    return JobListResponse(jobs=jobs, fetched_at=datetime.now(timezone.utc))


@router.get("/jobs/{job_id}", response_model=JobDetail)
def get_job(job_id: int, driver: Driver = Depends(get_current_driver)):
    picking = odoo.get_job_detail(job_id, driver.odoo_shipper_value)
    if not picking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "message": "Job not found or not assigned to this driver"},
        )
    partner = odoo.get_partner(picking["partner_id"][0]) if picking.get("partner_id") else {}
    sale_id = picking["sale_id"][0] if picking.get("sale_id") else None
    collection = odoo.resolve_collection(sale_id)
    summary = _build_summary(picking, partner, collection)

    # Build items from stock.move
    items = []
    if picking.get("move_ids"):
        moves = odoo.get_move_lines(picking["move_ids"])
        for m in moves:
            items.append(JobItem(
                product_name=m["product_id"][1] if m.get("product_id") else "Unknown",
                quantity=m.get("product_uom_qty", 0),
            ))

    notes_parts = [picking.get("x_studio_do_note") or "", picking.get("note") or ""]
    delivery_notes = " | ".join(p for p in notes_parts if p) or None

    return JobDetail(
        **summary.model_dump(),
        delivery_notes=delivery_notes,
        additional_info=picking.get("x_studio_hapo") or None,
        account_no=picking.get("x_studio_account_no") or None,
        items=items,
    )
```

- [ ] **Step 4: Update main.py to mount jobs router properly**

Replace the stub import with the full router. Ensure `app/main.py` includes:

```python
from app.routers import auth as auth_router, jobs as jobs_router

app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(jobs_router.router, prefix="/api/v1")
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_jobs.py tests/test_auth.py -v
# Expected: all PASS
```

- [ ] **Step 6: Commit**

```bash
git add services/driver-api/
git commit -m "feat: add jobs list and detail endpoints with Odoo integration"
```

---

## Task 8: Status Endpoint

**Files:**
- Create: `services/driver-api/app/routers/status.py`
- Create: `services/driver-api/tests/test_status.py`

- [ ] **Step 1: Write test_status.py**

```python
import json
from unittest.mock import patch


@patch("app.routers.status.odoo")
def test_status_update(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = {
        "id": 100, "x_studio_driver_status": "assigned", "x_studio_shipper": "耀"
    }
    resp = client.post(
        "/api/v1/jobs/100/status",
        json={"action_id": "test-1", "status": "accepted", "timestamp": "2026-03-25T09:00:00Z"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["accepted"] is True
    mock_odoo.update_driver_status.assert_called_once()


@patch("app.routers.status.odoo")
def test_invalid_transition(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = {
        "id": 100, "x_studio_driver_status": "assigned", "x_studio_shipper": "耀"
    }
    resp = client.post(
        "/api/v1/jobs/100/status",
        json={"action_id": "test-2", "status": "delivered", "timestamp": "2026-03-25T09:00:00Z"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 409


@patch("app.routers.status.odoo")
def test_idempotent_replay(mock_odoo, client, seeded_db, auth_token, db):
    mock_odoo.get_job_detail.return_value = {
        "id": 100, "x_studio_driver_status": "assigned", "x_studio_shipper": "耀"
    }
    # First call
    client.post(
        "/api/v1/jobs/100/status",
        json={"action_id": "replay-1", "status": "accepted", "timestamp": "2026-03-25T09:00:00Z"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    # Replay
    resp = client.post(
        "/api/v1/jobs/100/status",
        json={"action_id": "replay-1", "status": "accepted", "timestamp": "2026-03-25T09:00:00Z"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["replayed"] is True


@patch("app.routers.status.odoo")
def test_failed_requires_reason(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = {
        "id": 100, "x_studio_driver_status": "arrived", "x_studio_shipper": "耀"
    }
    resp = client.post(
        "/api/v1/jobs/100/status",
        json={"action_id": "test-3", "status": "failed", "timestamp": "2026-03-25T09:00:00Z"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_status.py -v
```

- [ ] **Step 3: Implement app/routers/status.py**

```python
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_driver
from app.database import get_db
from app.models import Driver, Action
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
    # Check idempotent replay
    existing = db.query(Action).filter_by(action_id=body.action_id).first()
    if existing:
        result = json.loads(existing.result)
        return StatusResponse(**result, replayed=True)

    # Fetch job
    picking = odoo.get_job_detail(job_id, driver.odoo_shipper_value)
    if not picking:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Job not found"})

    current = picking.get("x_studio_driver_status") or "assigned"

    # Validate transition
    if not is_valid_transition(current, body.status):
        raise HTTPException(
            status_code=409,
            detail={
                "error": "invalid_transition",
                "message": f"Cannot transition from '{current}' to '{body.status}'",
                "current_status": current,
                "allowed_transitions": get_allowed_transitions(current),
            },
        )

    # Validate failed requires reason
    if body.status == "failed":
        if not body.reason or body.reason not in FAILURE_REASONS:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "validation_error",
                    "message": "Failed status requires a valid reason",
                    "fields": {"reason": f"Must be one of: {', '.join(FAILURE_REASONS)}"},
                },
            )

    # Validate delivered prerequisites
    if body.status == "delivered":
        pod_action = db.query(Action).filter_by(
            job_id=job_id, driver_id=driver.id, action_type="proof_of_delivery"
        ).first()
        if not pod_action:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "validation_error",
                    "message": "POD must be submitted before marking as delivered",
                },
            )
        # Check cash collection if required
        sale_id = picking["sale_id"][0] if picking.get("sale_id") else None
        required, _, _ = odoo.resolve_collection(sale_id)
        if required:
            cash_action = db.query(Action).filter_by(
                job_id=job_id, driver_id=driver.id, action_type="cash_collection"
            ).first()
            if not cash_action:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "error": "validation_error",
                        "message": "Cash collection must be submitted before marking as delivered",
                    },
                )

    # Write to Odoo
    if body.status == "delivered":
        odoo.mark_delivered(job_id)
    else:
        note = f"FAILED: {body.reason} - {body.note}" if body.status == "failed" else None
        odoo.update_driver_status(job_id, body.status, note)

    # Log action
    result_data = {"action_id": body.action_id, "job_id": job_id, "status": body.status, "accepted": True}
    action = Action(
        action_id=body.action_id,
        driver_id=driver.id,
        job_id=job_id,
        action_type="status",
        payload=json.dumps(body.model_dump(), default=str),
        result=json.dumps(result_data),
    )
    db.add(action)
    db.commit()

    return StatusResponse(**result_data)
```

- [ ] **Step 4: Mount in main.py**

```python
from app.routers import status as status_router
app.include_router(status_router.router, prefix="/api/v1")
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_status.py tests/test_auth.py tests/test_state_machine.py -v
# Expected: all PASS
```

- [ ] **Step 6: Commit**

```bash
git add services/driver-api/
git commit -m "feat: add status update endpoint with state machine validation and idempotency"
```

---

## Task 9: Upload Endpoint

**Files:**
- Create: `services/driver-api/app/routers/uploads.py`
- Create: `services/driver-api/tests/test_uploads.py`

- [ ] **Step 1: Write test_uploads.py**

```python
import io


def test_upload_photo(client, seeded_db, auth_token):
    file_data = io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 100)  # fake JPEG header
    resp = client.post(
        "/api/v1/uploads",
        files={"file": ("test.jpg", file_data, "image/jpeg")},
        data={"type": "photo"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "photo"
    assert "upload_id" in data
    assert data["mimetype"] == "image/jpeg"


def test_upload_too_large(client, seeded_db, auth_token):
    # 11MB file
    file_data = io.BytesIO(b"\x00" * (11 * 1024 * 1024))
    resp = client.post(
        "/api/v1/uploads",
        files={"file": ("big.jpg", file_data, "image/jpeg")},
        data={"type": "photo"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 413


def test_upload_no_auth(client):
    file_data = io.BytesIO(b"\x00" * 10)
    resp = client.post(
        "/api/v1/uploads",
        files={"file": ("test.jpg", file_data, "image/jpeg")},
        data={"type": "photo"},
    )
    assert resp.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement app/routers/uploads.py**

```python
import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_driver
from app.config import settings
from app.database import get_db
from app.models import Driver, Upload
from app.schemas import UploadResponse

router = APIRouter(tags=["uploads"])


@router.post("/uploads", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    type: str = Form(...),
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    if type not in ("photo", "signature"):
        raise HTTPException(status_code=422, detail={"error": "validation_error", "message": "type must be photo or signature"})

    content = await file.read()
    if len(content) > settings.upload_max_bytes:
        raise HTTPException(
            status_code=413,
            detail={"error": "file_too_large", "message": "Maximum file size is 10MB", "max_bytes": settings.upload_max_bytes},
        )

    upload_id = f"up_{uuid.uuid4().hex[:8]}"
    os.makedirs(settings.upload_dir, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin"
    file_path = os.path.join(settings.upload_dir, f"{upload_id}.{ext}")

    with open(file_path, "wb") as f:
        f.write(content)

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

    return UploadResponse(
        upload_id=upload_id,
        type=type,
        size_bytes=len(content),
        mimetype=upload.mimetype,
        uploaded_at=datetime.now(timezone.utc),
    )
```

- [ ] **Step 4: Mount in main.py**

```python
from app.routers import uploads as uploads_router
app.include_router(uploads_router.router, prefix="/api/v1")
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_uploads.py -v
# Expected: all PASS
```

- [ ] **Step 6: Commit**

```bash
git add services/driver-api/
git commit -m "feat: add file upload endpoint with size validation"
```

---

## Task 10: POD Endpoint

**Files:**
- Create: `services/driver-api/app/routers/pod.py`
- Create: `services/driver-api/tests/test_pod.py`

- [ ] **Step 1: Write test_pod.py**

```python
import io
import json
from unittest.mock import patch


def _upload(client, auth_token):
    file_data = io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 100)
    resp = client.post(
        "/api/v1/uploads",
        files={"file": ("test.jpg", file_data, "image/jpeg")},
        data={"type": "photo"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    return resp.json()["upload_id"]


@patch("app.routers.pod.odoo")
def test_submit_pod(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = {"id": 100, "x_studio_shipper": "耀"}
    upload_id = _upload(client, auth_token)

    resp = client.post(
        "/api/v1/jobs/100/proof-of-delivery",
        json={
            "action_id": "pod-1",
            "photo_upload_ids": [upload_id],
            "note": "Left at door",
            "timestamp": "2026-03-25T09:25:00Z",
        },
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["photos_synced"] == 1


def test_pod_no_photos(client, seeded_db, auth_token):
    resp = client.post(
        "/api/v1/jobs/100/proof-of-delivery",
        json={
            "action_id": "pod-2",
            "photo_upload_ids": [],
            "timestamp": "2026-03-25T09:25:00Z",
        },
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422
```

- [ ] **Step 2: Implement app/routers/pod.py**

```python
import base64
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_driver
from app.database import get_db
from app.models import Driver, Action, Upload
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
    # Idempotent check
    existing = db.query(Action).filter_by(action_id=body.action_id).first()
    if existing:
        return PodResponse(**json.loads(existing.result))

    # Verify job exists
    picking = odoo.get_job_detail(job_id, driver.odoo_shipper_value)
    if not picking:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Job not found"})

    # Sync photos to Odoo
    photos_synced = 0
    for upload_id in body.photo_upload_ids:
        upload = db.query(Upload).filter_by(upload_id=upload_id, driver_id=driver.id).first()
        if not upload:
            continue
        with open(upload.file_path, "rb") as f:
            data_b64 = base64.b64encode(f.read()).decode()
        odoo.create_attachment(job_id, f"pod_{upload_id}.jpg", data_b64, upload.mimetype)
        upload.linked_job_id = job_id
        photos_synced += 1

    # Sync signature
    signature_synced = False
    if body.signature_upload_id:
        sig_upload = db.query(Upload).filter_by(upload_id=body.signature_upload_id, driver_id=driver.id).first()
        if sig_upload:
            with open(sig_upload.file_path, "rb") as f:
                sig_b64 = base64.b64encode(f.read()).decode()
            odoo.save_signature(job_id, sig_b64)
            sig_upload.linked_job_id = job_id
            signature_synced = True

    # Log action
    result_data = {
        "action_id": body.action_id,
        "job_id": job_id,
        "accepted": True,
        "photos_synced": photos_synced,
        "signature_synced": signature_synced,
    }
    db.add(Action(
        action_id=body.action_id,
        driver_id=driver.id,
        job_id=job_id,
        action_type="proof_of_delivery",
        payload=json.dumps(body.model_dump(), default=str),
        result=json.dumps(result_data),
    ))
    db.commit()

    return PodResponse(**result_data)
```

- [ ] **Step 3: Mount in main.py and run tests**

```bash
pytest tests/test_pod.py -v
# Expected: all PASS
```

- [ ] **Step 4: Commit**

```bash
git add services/driver-api/
git commit -m "feat: add proof-of-delivery endpoint with Odoo attachment sync"
```

---

## Task 11: Cash Collection Endpoint

**Files:**
- Create: `services/driver-api/app/routers/cash.py`
- Create: `services/driver-api/tests/test_cash.py`

- [ ] **Step 1: Write test_cash.py**

```python
import json
from unittest.mock import patch


@patch("app.routers.cash.odoo")
def test_cash_collection(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = {
        "id": 100, "x_studio_shipper": "耀", "sale_id": [1, "SO-1"]
    }
    mock_odoo.resolve_collection.return_value = (True, "cash", 3985.0)

    resp = client.post(
        "/api/v1/jobs/100/cash-collection",
        json={
            "action_id": "cash-1",
            "amount": 3985.00,
            "method": "cash",
            "reference": "Received from customer",
            "timestamp": "2026-03-25T09:27:00Z",
        },
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["amount"] == 3985.0
    mock_odoo.save_cash_collection.assert_called_once()


@patch("app.routers.cash.odoo")
def test_cash_not_required(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = {
        "id": 100, "x_studio_shipper": "耀", "sale_id": [1, "SO-1"]
    }
    mock_odoo.resolve_collection.return_value = (False, None, None)

    resp = client.post(
        "/api/v1/jobs/100/cash-collection",
        json={
            "action_id": "cash-2",
            "amount": 100,
            "method": "cash",
            "reference": "test",
            "timestamp": "2026-03-25T09:27:00Z",
        },
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["error"] == "collection_not_required"
```

- [ ] **Step 2: Implement app/routers/cash.py**

```python
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_driver
from app.database import get_db
from app.models import Driver, Action
from app.odoo_client import odoo
from app.schemas import CashRequest, CashResponse

router = APIRouter(tags=["cash"])


@router.post("/jobs/{job_id}/cash-collection", response_model=CashResponse)
def collect_cash(
    job_id: int,
    body: CashRequest,
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    # Idempotent check
    existing = db.query(Action).filter_by(action_id=body.action_id).first()
    if existing:
        return CashResponse(**json.loads(existing.result))

    # Verify job
    picking = odoo.get_job_detail(job_id, driver.odoo_shipper_value)
    if not picking:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Job not found"})

    # Verify collection is required
    sale_id = picking["sale_id"][0] if picking.get("sale_id") else None
    required, _, _ = odoo.resolve_collection(sale_id)
    if not required:
        raise HTTPException(
            status_code=422,
            detail={"error": "collection_not_required", "message": "This job does not require cash collection"},
        )

    # Validate method
    if body.method not in ("cash", "cheque"):
        raise HTTPException(
            status_code=422,
            detail={"error": "validation_error", "message": "Method must be 'cash' or 'cheque'"},
        )

    # Write to Odoo
    odoo.save_cash_collection(job_id, body.amount, body.method, body.reference)

    # Log action
    result_data = {
        "action_id": body.action_id,
        "job_id": job_id,
        "accepted": True,
        "amount": body.amount,
        "method": body.method,
    }
    db.add(Action(
        action_id=body.action_id,
        driver_id=driver.id,
        job_id=job_id,
        action_type="cash_collection",
        payload=json.dumps(body.model_dump(), default=str),
        result=json.dumps(result_data),
    ))
    db.commit()

    return CashResponse(**result_data)
```

- [ ] **Step 3: Mount in main.py and run tests**

```bash
pytest tests/test_cash.py -v
# Expected: all PASS
```

- [ ] **Step 4: Commit**

```bash
git add services/driver-api/
git commit -m "feat: add cash collection endpoint with COD validation"
```

---

## Task 12: Sync Batch & Status Endpoints

**Files:**
- Create: `services/driver-api/app/routers/sync.py`
- Create: `services/driver-api/tests/test_sync.py`

- [ ] **Step 1: Write test_sync.py**

```python
from unittest.mock import patch


def test_sync_status(client, seeded_db, auth_token):
    resp = client.get(
        "/api/v1/sync/status",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["pending_actions"] == 0


@patch("app.routers.status.odoo")
def test_batch_sync(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = {
        "id": 100, "x_studio_driver_status": "assigned", "x_studio_shipper": "耀"
    }
    resp = client.post(
        "/api/v1/sync/batch",
        json={
            "actions": [
                {
                    "action_id": "batch-1",
                    "endpoint": "/jobs/100/status",
                    "method": "POST",
                    "body": {
                        "action_id": "batch-1",
                        "status": "accepted",
                        "timestamp": "2026-03-25T09:00:00Z",
                    },
                }
            ]
        },
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["synced"] == 1
    assert data["failed"] == 0
```

- [ ] **Step 2: Implement app/routers/sync.py**

```python
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.auth import get_current_driver
from app.database import get_db
from app.models import Driver, Action
from app.schemas import BatchRequest, BatchResponse, BatchResult, SyncStatusResponse

router = APIRouter(tags=["sync"])


@router.get("/sync/status", response_model=SyncStatusResponse)
def sync_status(driver: Driver = Depends(get_current_driver), db: Session = Depends(get_db)):
    last_action = (
        db.query(Action)
        .filter_by(driver_id=driver.id)
        .order_by(Action.created_at.desc())
        .first()
    )
    return SyncStatusResponse(
        driver_id=driver.id,
        last_sync_at=last_action.created_at if last_action else None,
        pending_actions=0,
        last_error=None,
    )


@router.post("/sync/batch", response_model=BatchResponse)
def batch_sync(
    body: BatchRequest,
    request: Request,
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    from fastapi.testclient import TestClient

    results = []
    synced = 0
    failed = 0

    for action in body.actions:
        # Route each action to its endpoint using the internal app
        url = f"/api/v1{action.endpoint}"
        headers = {"Authorization": request.headers.get("Authorization", "")}

        try:
            with TestClient(request.app, raise_server_exceptions=False) as internal:
                if action.method.upper() == "POST":
                    if action.endpoint == "/uploads" and action.file:
                        import base64
                        file_bytes = base64.b64decode(action.file)
                        file_type = action.body.get("type", "photo") if action.body else "photo"
                        resp = internal.post(
                            url,
                            files={"file": ("batch_upload.jpg", file_bytes, "image/jpeg")},
                            data={"type": file_type},
                            headers=headers,
                        )
                    else:
                        resp = internal.post(url, json=action.body, headers=headers)
                else:
                    resp = internal.get(url, headers=headers)

            if resp.status_code == 200:
                resp_data = resp.json()
                results.append(BatchResult(
                    action_id=action.action_id,
                    accepted=True,
                    replayed=resp_data.get("replayed", False),
                    upload_id=resp_data.get("upload_id"),
                ))
                synced += 1
            else:
                detail = resp.json().get("detail", {})
                error_info = detail if isinstance(detail, dict) else {"error": "unknown", "message": str(detail)}
                results.append(BatchResult(
                    action_id=action.action_id,
                    accepted=False,
                    error=error_info.get("error", "unknown"),
                    message=error_info.get("message", ""),
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
```

- [ ] **Step 3: Mount in main.py and run all tests**

```bash
pytest tests/ -v
# Expected: all PASS
```

- [ ] **Step 4: Commit**

```bash
git add services/driver-api/
git commit -m "feat: add sync batch and sync status endpoints"
```

---

## Task 13: Integration Test with Test Odoo

**Files:**
- Create: `services/driver-api/tests/test_odoo_integration.py`

- [ ] **Step 1: Write integration test**

```python
"""Integration test against the test Odoo instance.
Run with: pytest tests/test_odoo_integration.py -v --run-integration
Skip by default in CI.
"""
import pytest
from app.odoo_client import OdooClient

import os
pytestmark = pytest.mark.skipif(
    not os.environ.get("RUN_INTEGRATION"),
    reason="Set RUN_INTEGRATION=1 to run Odoo integration tests",
)


def test_fetch_jobs():
    client = OdooClient()
    jobs = client.get_driver_jobs("耀", "pending")
    assert isinstance(jobs, list)
    # Just verify the call works — may return empty if no jobs assigned to 耀


def test_resolve_collection_cod():
    client = OdooClient()
    # SO-25-36295 has payment_term_id=11 (COD cash) in test Odoo
    required, method, amount = client.resolve_collection(113606)
    # This tests against known test data
    assert required is True
    assert method == "cash"
```

- [ ] **Step 2: Run unit tests (should all pass without integration)**

```bash
pytest tests/ -v --ignore=tests/test_odoo_integration.py
# Expected: all PASS
```

- [ ] **Step 4: Commit**

```bash
git add services/driver-api/
git commit -m "feat: add integration test scaffold for test Odoo instance"
```

---

## Task 14: Final Wiring and Smoke Test

**Files:**
- Modify: `services/driver-api/app/main.py` (final version)

- [ ] **Step 1: Final main.py**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.database import create_tables
from app.routers import auth as auth_router
from app.routers import jobs as jobs_router
from app.routers import status as status_router
from app.routers import uploads as uploads_router
from app.routers import pod as pod_router
from app.routers import cash as cash_router
from app.routers import sync as sync_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


app = FastAPI(title="Driver API", version="0.1.0", lifespan=lifespan)

app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(jobs_router.router, prefix="/api/v1")
app.include_router(status_router.router, prefix="/api/v1")
app.include_router(uploads_router.router, prefix="/api/v1")
app.include_router(pod_router.router, prefix="/api/v1")
app.include_router(cash_router.router, prefix="/api/v1")
app.include_router(sync_router.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 2: Run full test suite**

```bash
cd services/driver-api
pytest tests/ -v --ignore=tests/test_odoo_integration.py
# Expected: ALL PASS
```

- [ ] **Step 3: Smoke test with uvicorn**

```bash
python -m scripts.seed_drivers
uvicorn app.main:app --port 8000 &

# Health check
curl http://localhost:8000/health

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "+85200000001", "pin": "1234"}'

# Expected: {"token": "eyJ...", "driver": {"id": 1, "name": "耀", ...}}

kill %1
```

- [ ] **Step 4: Commit**

```bash
git add services/driver-api/
git commit -m "feat: complete driver-api v1 with all endpoints wired"
```

- [ ] **Step 5: Create .env.example**

```bash
cat > services/driver-api/.env.example << 'EOF'
DRIVER_API_DATABASE_URL=sqlite:///./driver_api.db
DRIVER_API_JWT_SECRET=change-me-in-production
DRIVER_API_ODOO_URL=https://hlm260321.odoo.com
DRIVER_API_ODOO_DB=hlm260321
DRIVER_API_ODOO_USERNAME=your-email@example.com
DRIVER_API_ODOO_API_KEY=your-api-key
DRIVER_API_UPLOAD_DIR=./uploads
EOF
```

- [ ] **Step 6: Final commit**

```bash
git add services/driver-api/.env.example
git commit -m "docs: add .env.example for driver-api configuration"
```
