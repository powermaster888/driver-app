"""
End-to-end integration tests against the real Odoo test instance.

These tests hit the actual Odoo XML-RPC API at hlm260321.odoo.com and exercise
the full API stack (FastAPI → OdooClient → Odoo). They are NOT run in CI —
run manually with:

    cd services/driver-api
    source .venv/bin/activate
    uv run pytest tests/test_e2e_odoo.py -v -s

Prerequisites:
  - .env file with valid DRIVER_API_ODOO_* credentials
  - A seeded driver in the local DB (the test seeds one automatically)
"""

import os
import io
import uuid

import pytest
import bcrypt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app
from app.models import Driver
from app.odoo_client import odoo

# Use a separate DB for e2e tests
E2E_DB_URL = "sqlite:///./test_e2e.db"
engine = create_engine(E2E_DB_URL, connect_args={"check_same_thread": False})
E2ESessionLocal = sessionmaker(bind=engine)

# Skip all tests if Odoo credentials aren't configured
pytestmark = pytest.mark.skipif(
    not os.environ.get("DRIVER_API_ODOO_API_KEY") and not odoo.api_key,
    reason="Odoo credentials not configured — skipping e2e tests",
)

# Test driver — uses the "yiu" shipper which has real jobs in the test instance
TEST_DRIVER = {
    "name": "E2E Test Driver",
    "phone": "+85299999999",
    "pin": "9999",
    "odoo_shipper_value": "盧生",
}


def _hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()


@pytest.fixture(autouse=True)
def e2e_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = E2ESessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def e2e_client():
    def _override():
        session = E2ESessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _override
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def seeded_driver(db):
    driver = Driver(
        name=TEST_DRIVER["name"],
        phone=TEST_DRIVER["phone"],
        pin_hash=_hash_pin(TEST_DRIVER["pin"]),
        odoo_shipper_value=TEST_DRIVER["odoo_shipper_value"],
        active=True,
    )
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver


@pytest.fixture
def auth_token(e2e_client, seeded_driver):
    resp = e2e_client.post("/api/v1/auth/login", json={
        "phone": TEST_DRIVER["phone"],
        "pin": TEST_DRIVER["pin"],
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─── Tests ───────────────────────────────────────────────────────────────


class TestOdooConnectivity:
    """Verify basic Odoo XML-RPC connectivity."""

    def test_odoo_authenticate(self):
        uid = odoo.uid
        assert isinstance(uid, int) and uid > 0, "Odoo authentication failed"

    def test_odoo_search_pickings(self):
        results = odoo.search_read(
            "stock.picking",
            [("picking_type_id", "in", [2, 8, 13, 50])],
            ["name", "state"],
            limit=1,
        )
        assert isinstance(results, list)
        if results:
            assert "name" in results[0]
            assert "state" in results[0]

    def test_health_endpoint(self, e2e_client):
        resp = e2e_client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["odoo"] == "connected"


class TestAuthFlow:
    """Test full authentication against seeded driver."""

    def test_login_success(self, e2e_client, seeded_driver):
        resp = e2e_client.post("/api/v1/auth/login", json={
            "phone": TEST_DRIVER["phone"],
            "pin": TEST_DRIVER["pin"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["driver"]["name"] == TEST_DRIVER["name"]

    def test_login_wrong_pin(self, e2e_client, seeded_driver):
        resp = e2e_client.post("/api/v1/auth/login", json={
            "phone": TEST_DRIVER["phone"],
            "pin": "0000",
        })
        assert resp.status_code == 401

    def test_protected_endpoint_without_token(self, e2e_client):
        resp = e2e_client.get("/api/v1/me/jobs?scope=today")
        assert resp.status_code in (401, 403)  # Depends on FastAPI/HTTPBearer version


class TestJobsE2E:
    """Fetch real jobs from Odoo for the test driver."""

    def test_list_jobs_today(self, e2e_client, auth_token):
        resp = e2e_client.get(
            "/api/v1/me/jobs?scope=today",
            headers=_auth_headers(auth_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "jobs" in data
        assert "fetched_at" in data
        assert isinstance(data["jobs"], list)

    def test_list_jobs_pending(self, e2e_client, auth_token):
        resp = e2e_client.get(
            "/api/v1/me/jobs?scope=pending",
            headers=_auth_headers(auth_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["jobs"], list)
        # Pending jobs should have a recognized status
        for job in data["jobs"]:
            assert job["status"] in ("assigned", "accepted", "on_the_way", "arrived", "delivered", "failed")

    def test_list_jobs_recent(self, e2e_client, auth_token):
        resp = e2e_client.get(
            "/api/v1/me/jobs?scope=recent",
            headers=_auth_headers(auth_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["jobs"], list)

    def test_list_jobs_all(self, e2e_client, auth_token):
        resp = e2e_client.get(
            "/api/v1/me/jobs?scope=all",
            headers=_auth_headers(auth_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["jobs"], list)

    def test_job_detail(self, e2e_client, auth_token):
        """Fetch a real job detail if any jobs exist."""
        resp = e2e_client.get(
            "/api/v1/me/jobs?scope=all",
            headers=_auth_headers(auth_token),
        )
        jobs = resp.json()["jobs"]
        if not jobs:
            pytest.skip("No jobs available for detail test")

        job_id = jobs[0]["job_id"]
        detail_resp = e2e_client.get(
            f"/api/v1/jobs/{job_id}",
            headers=_auth_headers(auth_token),
        )
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        assert detail["job_id"] == job_id
        assert "items" in detail
        assert "customer_name" in detail
        assert "warehouse" in detail
        assert "odoo_reference" in detail

    def test_job_detail_not_found(self, e2e_client, auth_token):
        resp = e2e_client.get(
            "/api/v1/jobs/999999999",
            headers=_auth_headers(auth_token),
        )
        # 404 or 502 (Odoo unreachable on field error) are acceptable
        assert resp.status_code in (404, 502)

    def test_job_summaries_have_required_fields(self, e2e_client, auth_token):
        """Every job summary should have all required fields populated."""
        resp = e2e_client.get(
            "/api/v1/me/jobs?scope=all",
            headers=_auth_headers(auth_token),
        )
        for job in resp.json()["jobs"][:5]:  # Check first 5
            assert isinstance(job["job_id"], int)
            assert job["odoo_reference"]  # non-empty
            assert job["customer_name"]  # non-empty
            assert job["warehouse"]  # non-empty
            assert job["scheduled_date"]  # non-empty
            assert job["status"]  # non-empty
            assert isinstance(job["collection_required"], bool)

    def test_job_items_have_barcodes(self, e2e_client, auth_token):
        """Verify that job detail items include barcode field (may be null)."""
        resp = e2e_client.get(
            "/api/v1/me/jobs?scope=all",
            headers=_auth_headers(auth_token),
        )
        jobs = resp.json()["jobs"]
        if not jobs:
            pytest.skip("No jobs available")

        detail_resp = e2e_client.get(
            f"/api/v1/jobs/{jobs[0]['job_id']}",
            headers=_auth_headers(auth_token),
        )
        detail = detail_resp.json()
        for item in detail.get("items", []):
            assert "barcode" in item  # field exists (value can be null)
            assert "product_name" in item
            assert "quantity" in item


class TestUploadE2E:
    """Test file upload (local storage, no Odoo write)."""

    def test_upload_photo(self, e2e_client, auth_token):
        # Create a minimal JPEG-like file (just needs valid content-type)
        fake_jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        resp = e2e_client.post(
            "/api/v1/uploads",
            headers=_auth_headers(auth_token),
            files={"file": ("test.jpg", io.BytesIO(fake_jpeg), "image/jpeg")},
            data={"type": "photo"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["upload_id"].startswith("up_")
        assert data["type"] == "photo"
        assert data["mimetype"] == "image/jpeg"

    def test_upload_invalid_type(self, e2e_client, auth_token):
        fake_jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        resp = e2e_client.post(
            "/api/v1/uploads",
            headers=_auth_headers(auth_token),
            files={"file": ("test.jpg", io.BytesIO(fake_jpeg), "image/jpeg")},
            data={"type": "video"},
        )
        assert resp.status_code == 422


class TestStatsE2E:
    """Test driver stats endpoint against real Odoo data."""

    def test_driver_stats(self, e2e_client, auth_token):
        resp = e2e_client.get(
            "/api/v1/me/stats",
            headers=_auth_headers(auth_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "total_deliveries" in data
        assert "on_time_rate" in data
        assert isinstance(data["total_deliveries"], int)
        assert data["total_deliveries"] >= 0


class TestStatusTransitionE2E:
    """Test status update validation (reads from real Odoo, writes to DB)."""

    def test_invalid_transition_rejected(self, e2e_client, auth_token):
        """Trying to set a job to 'delivered' directly from 'assigned' should fail."""
        # Check if Odoo has the custom driver_status field
        try:
            odoo.search_read("stock.picking", [["id", "<", 1]], ["x_studio_driver_status"], limit=1)
        except Exception:
            pytest.skip("Odoo test instance missing x_studio_driver_status field")
        resp = e2e_client.get(
            "/api/v1/me/jobs?scope=pending",
            headers=_auth_headers(auth_token),
        )
        jobs = resp.json()["jobs"]
        assigned_jobs = [j for j in jobs if j["status"] == "assigned"]
        if not assigned_jobs:
            pytest.skip("No assigned jobs available for transition test")

        job_id = assigned_jobs[0]["job_id"]
        resp = e2e_client.post(
            f"/api/v1/jobs/{job_id}/status",
            headers=_auth_headers(auth_token),
            json={
                "action_id": f"e2e_test_{uuid.uuid4().hex[:8]}",
                "status": "delivered",
                "timestamp": "2026-04-04T12:00:00Z",
            },
        )
        assert resp.status_code == 409
        assert resp.json()["error"] == "invalid_transition"

    def test_valid_accept_transition(self, e2e_client, auth_token):
        """Accept an assigned job — this is safe and reversible in Odoo."""
        # Check if Odoo has the custom driver_status field
        try:
            odoo.search_read("stock.picking", [["id", "<", 1]], ["x_studio_driver_status"], limit=1)
        except Exception:
            pytest.skip("Odoo test instance missing x_studio_driver_status field")
        resp = e2e_client.get(
            "/api/v1/me/jobs?scope=pending",
            headers=_auth_headers(auth_token),
        )
        jobs = resp.json()["jobs"]
        assigned_jobs = [j for j in jobs if j["status"] == "assigned"]
        if not assigned_jobs:
            pytest.skip("No assigned jobs available for accept test")

        job_id = assigned_jobs[0]["job_id"]
        action_id = f"e2e_accept_{uuid.uuid4().hex[:8]}"
        resp = e2e_client.post(
            f"/api/v1/jobs/{job_id}/status",
            headers=_auth_headers(auth_token),
            json={
                "action_id": action_id,
                "status": "accepted",
                "timestamp": "2026-04-04T12:00:00Z",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["accepted"] is True
        assert data["status"] == "accepted"

        # Idempotent replay — same action_id should return replayed=True
        resp2 = e2e_client.post(
            f"/api/v1/jobs/{job_id}/status",
            headers=_auth_headers(auth_token),
            json={
                "action_id": action_id,
                "status": "accepted",
                "timestamp": "2026-04-04T12:00:00Z",
            },
        )
        assert resp2.status_code == 200
        assert resp2.json()["replayed"] is True


class TestSyncE2E:
    """Test sync status endpoint."""

    def test_sync_status(self, e2e_client, auth_token):
        resp = e2e_client.get(
            "/api/v1/sync/status",
            headers=_auth_headers(auth_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "pending_actions" in data
        assert isinstance(data["pending_actions"], int)


class TestCollectionResolution:
    """Verify cash collection detection from Odoo sale orders."""

    def test_collection_fields_present(self, e2e_client, auth_token):
        """Jobs should have collection_required, collection_method, expected_collection_amount."""
        resp = e2e_client.get(
            "/api/v1/me/jobs?scope=all",
            headers=_auth_headers(auth_token),
        )
        jobs = resp.json()["jobs"]
        for job in jobs[:10]:
            assert "collection_required" in job
            assert "collection_method" in job
            assert "expected_collection_amount" in job
            if job["collection_required"]:
                assert job["collection_method"] in ("cash", "cheque", "fps")
                assert job["expected_collection_amount"] is not None
                assert job["expected_collection_amount"] > 0
