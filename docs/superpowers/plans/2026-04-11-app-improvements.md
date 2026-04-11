# App Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the on-time calculation bug, replace dangerous mock fallback with cached Odoo responses, add resumable completion flow with completion_id, and add photo preview with retake in the mobile completion screen.

**Architecture:** Four independent improvements. Tasks 1-2 are backend-only (API). Task 3 spans both API and mobile. Task 4 is mobile-only. Each can be tested in isolation.

**Tech Stack:** Python/FastAPI/SQLAlchemy (backend), React Native/Expo/Tamagui (mobile), pytest (tests)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `services/driver-api/app/routers/stats.py` | Fix on-time date comparison |
| Create | `services/driver-api/tests/test_stats.py` | Tests for on-time calculation |
| Modify | `services/driver-api/app/models.py` | Add CachedJobList model |
| Modify | `services/driver-api/app/routers/jobs.py` | Cache Odoo responses, return stale on failure |
| Modify | `services/driver-api/app/schemas.py` | Add `stale`/`cached_at` fields to JobListResponse, add CompletionStatusResponse |
| Delete | `services/driver-api/_mock_jobs.py` | Remove hardcoded mock data |
| Delete | `services/driver-api/app/routers/_mock.py` | Remove mock router helper |
| Modify | `services/driver-api/tests/test_jobs.py` | Update tests for cache fallback |
| Modify | `services/driver-api/app/routers/status.py` | Add completion_id grouping and prerequisite check endpoint |
| Create | `services/driver-api/tests/test_completion.py` | Tests for completion_id flow |
| Modify | `apps/driver-mobile/app/jobs/[id]/complete.tsx` | Add photo preview with retake |

---

### Task 1: Fix on-time rate calculation bug

The `stats.py` endpoint compares `x_studio_actual_delivery_date` (a date string like `"2026-04-11"`) with `scheduled_date` (a datetime string like `"2026-04-11 08:00:00"`) using `<=`. This gives wrong results because `"2026-04-11" <= "2026-04-11 08:00:00"` is `True` in Python string comparison (space < digit), but `"2026-04-12" <= "2026-04-11 23:59:59"` is `False` even though 2026-04-12 might be on-time by date. The fix: truncate both to date-only (`YYYY-MM-DD`) before comparing.

**Files:**
- Modify: `services/driver-api/app/routers/stats.py:35-41`
- Create: `services/driver-api/tests/test_stats.py`

- [ ] **Step 1: Write the failing test**

Create `services/driver-api/tests/test_stats.py`:

```python
from unittest.mock import patch


@patch("app.routers.stats.odoo")
def test_on_time_compares_dates_not_datetimes(mock_odoo, client, seeded_db, auth_token):
    """Actual='2026-04-11' should be on-time when scheduled='2026-04-11 23:59:59'."""
    mock_odoo.execute.side_effect = lambda model, method, *args, **kwargs: {
        ("stock.picking", "search_count"): 1,
        ("stock.picking", "search"): [1],
        ("stock.picking", "read"): [
            {
                "id": 1,
                "x_studio_actual_delivery_date": "2026-04-11",
                "scheduled_date": "2026-04-11 23:59:59",
            }
        ],
    }.get((model, method), 0)

    resp = client.get("/api/v1/me/stats", headers={"Authorization": f"Bearer {auth_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["on_time_rate"] == 100.0


@patch("app.routers.stats.odoo")
def test_late_delivery_detected(mock_odoo, client, seeded_db, auth_token):
    """Actual='2026-04-12' should be late when scheduled='2026-04-11 08:00:00'."""
    mock_odoo.execute.side_effect = lambda model, method, *args, **kwargs: {
        ("stock.picking", "search_count"): 1,
        ("stock.picking", "search"): [1],
        ("stock.picking", "read"): [
            {
                "id": 1,
                "x_studio_actual_delivery_date": "2026-04-12",
                "scheduled_date": "2026-04-11 08:00:00",
            }
        ],
    }.get((model, method), 0)

    resp = client.get("/api/v1/me/stats", headers={"Authorization": f"Bearer {auth_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["on_time_rate"] == 0.0


@patch("app.routers.stats.odoo")
def test_stats_odoo_unreachable(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.execute.side_effect = Exception("connection failed")

    resp = client.get("/api/v1/me/stats", headers={"Authorization": f"Bearer {auth_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_deliveries"] == 0
    assert data["on_time_rate"] == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/driver-api && uv run pytest tests/test_stats.py -v`
Expected: `test_on_time_compares_dates_not_datetimes` FAILS (the current string comparison gives wrong result for edge cases where scheduled has time component)

- [ ] **Step 3: Fix the date comparison**

In `services/driver-api/app/routers/stats.py`, replace lines 35-41:

```python
                for rec in records:
                    actual = rec.get("x_studio_actual_delivery_date")
                    scheduled = rec.get("scheduled_date")
                    if actual and scheduled:
                        # Compare date strings (ISO format sorts lexicographically)
                        if actual <= scheduled:
                            on_time += 1
                    elif actual and not scheduled:
                        # No scheduled date = consider on-time
                        on_time += 1
```

with:

```python
                for rec in records:
                    actual = rec.get("x_studio_actual_delivery_date")
                    scheduled = rec.get("scheduled_date")
                    if actual and scheduled:
                        # Truncate both to YYYY-MM-DD for date-only comparison
                        # actual is date ("2026-04-11"), scheduled is datetime ("2026-04-11 08:00:00")
                        actual_date = actual[:10]
                        scheduled_date = scheduled[:10]
                        if actual_date <= scheduled_date:
                            on_time += 1
                    elif actual and not scheduled:
                        # No scheduled date = consider on-time
                        on_time += 1
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/driver-api && uv run pytest tests/test_stats.py -v`
Expected: All 3 tests PASS

- [ ] **Step 5: Run full test suite for regressions**

Run: `cd services/driver-api && uv run pytest -v`
Expected: All existing tests still pass

- [ ] **Step 6: Commit**

```bash
cd /Users/bill/Developer/work/mobile/driver-app
git add services/driver-api/app/routers/stats.py services/driver-api/tests/test_stats.py
git commit -m "fix: truncate to date-only in on-time rate calculation

actual_delivery_date is a date string, scheduled_date is a datetime string.
String comparison gave wrong results for cross-midnight scheduled times."
```

---

### Task 2: Replace mock fallback with cached Odoo responses

When Odoo is unreachable, the jobs endpoint currently returns 5 hardcoded fake jobs as if they were real. This is dangerous in production. Instead, cache the last successful Odoo response per driver+scope in SQLite and return it with a `stale: true` flag when Odoo fails.

**Files:**
- Modify: `services/driver-api/app/models.py`
- Modify: `services/driver-api/app/schemas.py`
- Modify: `services/driver-api/app/routers/jobs.py`
- Delete: `services/driver-api/_mock_jobs.py`
- Delete: `services/driver-api/app/routers/_mock.py`
- Modify: `services/driver-api/tests/test_jobs.py`

- [ ] **Step 1: Add CachedJobList model**

In `services/driver-api/app/models.py`, add after the `Upload` class:

```python
class CachedJobList(Base):
    __tablename__ = "cached_job_lists"

    id: Mapped[int] = mapped_column(primary_key=True)
    driver_id: Mapped[int] = mapped_column(Integer, index=True)
    scope: Mapped[str] = mapped_column(String(20))
    response_json: Mapped[str] = mapped_column(Text)
    cached_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
```

- [ ] **Step 2: Add stale/cached_at to JobListResponse schema**

In `services/driver-api/app/schemas.py`, replace the `JobListResponse` class:

```python
class JobListResponse(BaseModel):
    jobs: list[JobSummary]
    fetched_at: datetime
    stale: bool = False
    cached_at: datetime | None = None
```

- [ ] **Step 3: Write the failing test for cache fallback**

Replace `services/driver-api/tests/test_jobs.py` content with:

```python
from unittest.mock import patch, MagicMock

MOCK_PICKING = {
    "id": 120723, "name": "DO-26-09394", "origin": "SO-26-10732", "state": "assigned",
    "partner_id": [151221, "陳生"], "scheduled_date": "2026-03-25 10:03:36",
    "sale_id": [124482, "SO-26-10732"], "x_studio_shipper": "耀",
    "x_studio_do_note": "請打電話先", "note": False,
    "x_studio_actual_delivery_date": False, "x_studio_hapo": "網站訂單: 319602",
    "x_studio_account_no": "H44501", "x_studio_driver_status": False,
    "picking_type_id": [2, "HQ: Delivery Orders"], "move_ids": [317020, 317021],
}
MOCK_PARTNER = {"id": 151221, "display_name": "陳生", "phone": "+852 91234567", "street": "Room B03, 5/F, Ka To Factory Building", "street2": False}
MOCK_SO = {"id": 124482, "name": "SO-26-10732", "amount_total": 3985.0, "payment_term_id": [11, "貨到付款 - 現金"]}
MOCK_MOVES = [
    {"id": 317020, "product_id": [47322, "[MEKI-0038] 日本 Terumo Syringe - 3ml"], "product_uom_qty": 10, "barcode": "4901234567890"},
    {"id": 317021, "product_id": [47323, "[MEKI-0039] 日本 Terumo Syringe - 5ml"], "product_uom_qty": 10, "barcode": None},
]


@patch("app.routers.jobs.odoo")
def test_list_jobs(mock_odoo, client, auth_token):
    mock_odoo.get_driver_jobs.return_value = [MOCK_PICKING]
    mock_odoo.read.side_effect = lambda model, ids, fields: {
        "res.partner": [MOCK_PARTNER],
        "sale.order": [MOCK_SO],
    }.get(model, [])

    resp = client.get("/api/v1/me/jobs?scope=today", headers={"Authorization": f"Bearer {auth_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["jobs"]) == 1
    job = data["jobs"][0]
    assert job["job_id"] == 120723
    assert job["odoo_reference"] == "DO-26-09394"
    assert job["warehouse"] == "HQ"
    assert job["collection_required"] is True
    assert job["collection_method"] == "cash"
    assert job["expected_collection_amount"] == 3985.0
    assert job["customer_name"] == "陳生"
    assert data["fetched_at"] is not None
    assert data["stale"] is False


@patch("app.routers.jobs.odoo")
def test_get_job_detail(mock_odoo, client, auth_token):
    mock_odoo.get_job_detail.return_value = MOCK_PICKING
    mock_odoo.read.side_effect = lambda model, ids, fields: {
        "res.partner": [MOCK_PARTNER],
        "sale.order": [MOCK_SO],
    }.get(model, [])
    mock_odoo.get_move_lines.return_value = MOCK_MOVES

    resp = client.get("/api/v1/jobs/120723", headers={"Authorization": f"Bearer {auth_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["job_id"] == 120723
    assert len(data["items"]) == 2
    assert "Terumo Syringe - 3ml" in data["items"][0]["product_name"]
    assert data["items"][0]["barcode"] == "4901234567890"
    assert "Terumo Syringe - 5ml" in data["items"][1]["product_name"]
    assert data["items"][1]["barcode"] is None
    assert data["delivery_notes"] == "請打電話先"
    assert data["account_no"] == "H44501"


@patch("app.routers.jobs.odoo")
def test_get_job_not_found(mock_odoo, client, auth_token):
    mock_odoo.get_job_detail.return_value = None

    resp = client.get("/api/v1/jobs/999999", headers={"Authorization": f"Bearer {auth_token}"})
    assert resp.status_code == 404
    assert resp.json()["error"] == "not_found"


@patch("app.routers.jobs.odoo")
def test_list_jobs_invalid_scope(mock_odoo, client, auth_token):
    resp = client.get("/api/v1/me/jobs?scope=invalid", headers={"Authorization": f"Bearer {auth_token}"})
    assert resp.status_code == 422


@patch("app.routers.jobs.odoo")
def test_odoo_down_returns_cached_jobs(mock_odoo, client, auth_token):
    """First call succeeds (populates cache), second call with Odoo down returns cached data."""
    mock_odoo.get_driver_jobs.return_value = [MOCK_PICKING]
    mock_odoo.read.side_effect = lambda model, ids, fields: {
        "res.partner": [MOCK_PARTNER],
        "sale.order": [MOCK_SO],
    }.get(model, [])

    # First call — populates cache
    resp1 = client.get("/api/v1/me/jobs?scope=today", headers={"Authorization": f"Bearer {auth_token}"})
    assert resp1.status_code == 200
    assert resp1.json()["stale"] is False

    # Odoo goes down
    mock_odoo.get_driver_jobs.side_effect = Exception("connection refused")

    # Second call — returns cached
    resp2 = client.get("/api/v1/me/jobs?scope=today", headers={"Authorization": f"Bearer {auth_token}"})
    assert resp2.status_code == 200
    data = resp2.json()
    assert data["stale"] is True
    assert data["cached_at"] is not None
    assert len(data["jobs"]) == 1
    assert data["jobs"][0]["job_id"] == 120723


@patch("app.routers.jobs.odoo")
def test_odoo_down_no_cache_returns_empty(mock_odoo, client, auth_token):
    """If Odoo is down and no cache exists, return empty list with stale flag."""
    mock_odoo.get_driver_jobs.side_effect = Exception("connection refused")

    resp = client.get("/api/v1/me/jobs?scope=today", headers={"Authorization": f"Bearer {auth_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["stale"] is True
    assert data["jobs"] == []
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd services/driver-api && uv run pytest tests/test_jobs.py -v`
Expected: `test_odoo_down_returns_cached_jobs` and `test_odoo_down_no_cache_returns_empty` FAIL, `test_list_jobs` FAILS on missing `stale` field

- [ ] **Step 5: Rewrite jobs router with cache fallback**

Replace `services/driver-api/app/routers/jobs.py`:

```python
import json
import xmlrpc.client
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_driver
from app.database import get_db
from app.errors import APIError
from app.models import CachedJobList, Driver
from app.odoo_client import odoo, WAREHOUSE_NAMES, COD_PAYMENT_TERMS
from app.schemas import JobSummary, JobDetail, JobItem, JobListResponse

router = APIRouter(tags=["jobs"])


def _batch_build_summaries(pickings: list[dict]) -> list[JobSummary]:
    """Build summaries for multiple pickings with batch Odoo calls (2 calls instead of 2N)."""
    if not pickings:
        return []

    # Collect unique partner IDs and sale order IDs
    partner_ids = list({p["partner_id"][0] for p in pickings if p.get("partner_id")})
    sale_ids = list({p["sale_id"][0] for p in pickings if p.get("sale_id")})

    # Batch fetch partners (1 call)
    partners_map: dict[int, dict] = {}
    if partner_ids:
        try:
            partners = odoo.read("res.partner", partner_ids, ["display_name", "phone", "street", "street2", "partner_latitude", "partner_longitude"])
            partners_map = {p["id"]: p for p in partners}
        except Exception:
            pass

    # Batch fetch sale orders for cash collection (1 call)
    sales_map: dict[int, dict] = {}
    if sale_ids:
        try:
            sales = odoo.read("sale.order", sale_ids, ["name", "amount_total", "payment_term_id"])
            sales_map = {s["id"]: s for s in sales}
        except Exception:
            pass

    # Build summaries from cached data
    jobs = []
    for picking in pickings:
        partner_id = picking["partner_id"][0] if picking.get("partner_id") else None
        partner = partners_map.get(partner_id, {}) if partner_id else {}

        sale_id = picking["sale_id"][0] if picking.get("sale_id") else None
        so = sales_map.get(sale_id, {}) if sale_id else {}

        # Resolve collection from cached SO
        collection_required = False
        collection_method = None
        expected_amount = None
        if so and so.get("payment_term_id"):
            term_id = so["payment_term_id"][0]
            if term_id in COD_PAYMENT_TERMS:
                collection_required = True
                collection_method = COD_PAYMENT_TERMS[term_id]
                expected_amount = so.get("amount_total", 0)

        pt_id = picking["picking_type_id"][0] if picking.get("picking_type_id") else None
        address_parts = [partner.get("street"), partner.get("street2")]
        address = ", ".join(p for p in address_parts if p) or None
        driver_status = picking.get("x_studio_driver_status") or "assigned"

        lat = partner.get("partner_latitude") or None
        lng = partner.get("partner_longitude") or None
        # Odoo stores 0.0 when unset — treat as null
        if lat == 0.0 and lng == 0.0:
            lat = None
            lng = None

        jobs.append(JobSummary(
            job_id=picking["id"],
            odoo_reference=picking["name"],
            sales_order_ref=picking.get("origin"),
            customer_name=partner.get("display_name", picking["partner_id"][1] if picking.get("partner_id") else "Unknown"),
            phone=partner.get("phone") or None,
            address=address,
            latitude=lat,
            longitude=lng,
            warehouse=WAREHOUSE_NAMES.get(pt_id, "Unknown"),
            scheduled_date=picking["scheduled_date"],
            status=driver_status,
            collection_required=collection_required,
            collection_method=collection_method,
            expected_collection_amount=expected_amount,
        ))

    return jobs


def _save_cache(db: Session, driver_id: int, scope: str, response: JobListResponse):
    """Save or update cached job list for this driver+scope."""
    existing = db.query(CachedJobList).filter(
        CachedJobList.driver_id == driver_id,
        CachedJobList.scope == scope,
    ).first()
    response_json = response.model_dump_json()
    if existing:
        existing.response_json = response_json
        existing.cached_at = datetime.now(timezone.utc)
    else:
        db.add(CachedJobList(
            driver_id=driver_id,
            scope=scope,
            response_json=response_json,
        ))
    db.commit()


def _load_cache(db: Session, driver_id: int, scope: str) -> JobListResponse | None:
    """Load cached job list for this driver+scope."""
    cached = db.query(CachedJobList).filter(
        CachedJobList.driver_id == driver_id,
        CachedJobList.scope == scope,
    ).first()
    if not cached:
        return None
    data = json.loads(cached.response_json)
    data["stale"] = True
    data["cached_at"] = cached.cached_at.isoformat()
    return JobListResponse(**data)


@router.get("/me/jobs", response_model=JobListResponse)
def list_jobs(
    scope: Literal["today", "pending", "recent", "all", "upcoming"] = "today",
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    try:
        pickings = odoo.get_driver_jobs(driver.odoo_shipper_value, scope)
    except (xmlrpc.client.Fault, Exception):
        # Odoo unreachable — return cached response or empty list
        cached = _load_cache(db, driver.id, scope)
        if cached:
            return cached
        return JobListResponse(
            jobs=[], fetched_at=datetime.now(timezone.utc), stale=True,
        )

    jobs = _batch_build_summaries(pickings)
    response = JobListResponse(jobs=jobs, fetched_at=datetime.now(timezone.utc))

    # Cache the successful response
    _save_cache(db, driver.id, scope, response)

    return response


@router.get("/jobs/{job_id}", response_model=JobDetail)
def get_job(job_id: int, driver: Driver = Depends(get_current_driver)):
    try:
        picking = odoo.get_job_detail(job_id, driver.odoo_shipper_value)
    except (xmlrpc.client.Fault, Exception):
        raise APIError(502, "odoo_error", "Cannot reach server — please try again later")
    if not picking:
        raise APIError(404, "not_found", "This job was not found or is not assigned to you")

    summaries = _batch_build_summaries([picking])
    summary = summaries[0] if summaries else None
    if not summary:
        raise APIError(500, "build_error", "Failed to build job summary")

    try:
        moves = odoo.get_move_lines(picking.get("move_ids", []))
    except (xmlrpc.client.Fault, Exception):
        moves = []

    items = [
        JobItem(
            product_name=m["product_id"][1] if m.get("product_id") else "Unknown",
            quantity=m.get("product_uom_qty", 0),
            move_id=m.get("id"),
            barcode=m.get("barcode"),
        )
        for m in moves
    ]

    return JobDetail(
        **summary.model_dump(),
        delivery_notes=picking.get("x_studio_do_note") or None,
        additional_info=picking.get("x_studio_hapo") or None,
        account_no=picking.get("x_studio_account_no") or None,
        items=items,
    )
```

- [ ] **Step 6: Delete mock files**

```bash
rm services/driver-api/_mock_jobs.py
rm services/driver-api/app/routers/_mock.py
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd services/driver-api && uv run pytest tests/test_jobs.py -v`
Expected: All 6 tests PASS

- [ ] **Step 8: Run full test suite for regressions**

Run: `cd services/driver-api && uv run pytest -v`
Expected: All tests pass. If any test imports from `_mock_jobs` or `_mock`, it will fail — those references should be gone now.

- [ ] **Step 9: Commit**

```bash
cd /Users/bill/Developer/work/mobile/driver-app
git add services/driver-api/app/models.py services/driver-api/app/schemas.py services/driver-api/app/routers/jobs.py services/driver-api/tests/test_jobs.py
git rm services/driver-api/_mock_jobs.py services/driver-api/app/routers/_mock.py
git commit -m "fix: replace mock job fallback with cached Odoo responses

When Odoo is unreachable, return the last successful response with
stale=true and cached_at timestamp instead of hardcoded fake jobs.
If no cache exists, return an empty list. Drivers can still work
their known jobs since status/POD actions queue locally anyway."
```

---

### Task 3: Add resumable completion flow with completion_id

The current completion flow makes 3 separate API calls (upload photos, submit POD, update status). If the app crashes mid-flow, the driver must redo everything. Instead, the client sends a `completion_id` with all related calls, and a new endpoint lets the client check what a completion still needs.

**Files:**
- Modify: `services/driver-api/app/schemas.py`
- Modify: `services/driver-api/app/routers/status.py`
- Create: `services/driver-api/tests/test_completion.py`
- Modify: `apps/driver-mobile/app/jobs/[id]/complete.tsx`
- Modify: `apps/driver-mobile/src/api/status.ts`

- [ ] **Step 1: Add completion_id to schemas**

In `services/driver-api/app/schemas.py`, add `completion_id` to `StatusRequest`, `PodRequest`, and `CashRequest`, and add a new response schema.

Add to `StatusRequest` (after `note`):
```python
    completion_id: str | None = None
```

Add to `PodRequest` (after `timestamp`):
```python
    completion_id: str | None = None
```

Add to `CashRequest` (after `timestamp`):
```python
    completion_id: str | None = None
```

Add a new schema after `SyncStatusResponse`:
```python
class CompletionStatusResponse(BaseModel):
    completion_id: str
    job_id: int
    has_pod: bool = False
    has_cash: bool = False
    has_status: bool = False
    collection_required: bool = False
    ready: bool = False
```

- [ ] **Step 2: Add completion_id to Action model**

In `services/driver-api/app/models.py`, add to the `Action` class after `result`:

```python
    completion_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
```

- [ ] **Step 3: Write the failing tests**

Create `services/driver-api/tests/test_completion.py`:

```python
from unittest.mock import patch

MOCK_PICKING_ARRIVED = {
    "id": 120723, "name": "DO-26-09394", "origin": "SO-26-10732", "state": "assigned",
    "partner_id": [151221, "陳生"], "scheduled_date": "2026-03-25 10:03:36",
    "sale_id": [124482, "SO-26-10732"], "x_studio_shipper": "耀",
    "x_studio_do_note": False, "note": False,
    "x_studio_actual_delivery_date": False, "x_studio_hapo": False,
    "x_studio_account_no": "H44501", "x_studio_driver_status": "arrived",
    "picking_type_id": [2, "HQ: Delivery Orders"], "move_ids": [317020],
}

MOCK_SO_COD = {"id": 124482, "name": "SO-26-10732", "amount_total": 3985.0, "payment_term_id": [11, "貨到付款 - 現金"]}
MOCK_SO_NO_COD = {"id": 124482, "name": "SO-26-10732", "amount_total": 0, "payment_term_id": [1, "Immediate"]}


@patch("app.routers.status.odoo")
def test_completion_status_empty(mock_odoo, client, seeded_db, auth_token):
    """No actions submitted yet — nothing is ready."""
    mock_odoo.get_job_detail.return_value = MOCK_PICKING_ARRIVED
    mock_odoo.resolve_collection.return_value = (True, "cash", 3985.0)

    resp = client.get(
        "/api/v1/jobs/120723/completion/comp-001",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["completion_id"] == "comp-001"
    assert data["has_pod"] is False
    assert data["has_cash"] is False
    assert data["has_status"] is False
    assert data["collection_required"] is True
    assert data["ready"] is False


@patch("app.routers.status.odoo")
def test_completion_status_with_pod(mock_odoo, client, seeded_db, auth_token, db):
    """After POD is submitted, has_pod should be True."""
    from app.models import Action
    import json

    # Simulate a POD action with the completion_id
    action = Action(
        action_id="pod-001",
        driver_id=1,
        job_id=120723,
        action_type="proof_of_delivery",
        payload="{}",
        result=json.dumps({"photos_synced": 1}),
        completion_id="comp-002",
    )
    db.add(action)
    db.commit()

    mock_odoo.get_job_detail.return_value = MOCK_PICKING_ARRIVED
    mock_odoo.resolve_collection.return_value = (False, None, None)

    resp = client.get(
        "/api/v1/jobs/120723/completion/comp-002",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_pod"] is True
    assert data["collection_required"] is False
    assert data["ready"] is True  # POD done, no cash needed


@patch("app.routers.status.odoo")
def test_completion_status_cod_needs_cash(mock_odoo, client, seeded_db, auth_token, db):
    """COD job with POD but no cash — not ready."""
    from app.models import Action
    import json

    action = Action(
        action_id="pod-003",
        driver_id=1,
        job_id=120723,
        action_type="proof_of_delivery",
        payload="{}",
        result=json.dumps({"photos_synced": 1}),
        completion_id="comp-003",
    )
    db.add(action)
    db.commit()

    mock_odoo.get_job_detail.return_value = MOCK_PICKING_ARRIVED
    mock_odoo.resolve_collection.return_value = (True, "cash", 3985.0)

    resp = client.get(
        "/api/v1/jobs/120723/completion/comp-003",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_pod"] is True
    assert data["has_cash"] is False
    assert data["collection_required"] is True
    assert data["ready"] is False
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd services/driver-api && uv run pytest tests/test_completion.py -v`
Expected: FAIL — endpoint doesn't exist yet, completion_id column doesn't exist

- [ ] **Step 5: Add completion status endpoint**

In `services/driver-api/app/routers/status.py`, add `Session` import to the existing import from `app.database`, then add this endpoint after the existing `update_status` function:

Add to imports at top:
```python
from app.schemas import StatusRequest, StatusResponse, CompletionStatusResponse
```

Add at the end of the file:
```python
@router.get("/jobs/{job_id}/completion/{completion_id}", response_model=CompletionStatusResponse)
def get_completion_status(
    job_id: int,
    completion_id: str,
    driver: Driver = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    # Verify job exists
    try:
        picking = odoo.get_job_detail(job_id, driver.odoo_shipper_value)
    except Exception:
        raise APIError(502, "odoo_error", "Cannot reach server — please try again later")
    if not picking:
        raise APIError(404, "not_found", "This job was not found or is not assigned to you")

    # Check what actions exist for this completion_id
    actions = db.query(Action).filter(
        Action.completion_id == completion_id,
        Action.driver_id == driver.id,
        Action.job_id == job_id,
    ).all()

    has_pod = any(a.action_type == "proof_of_delivery" for a in actions)
    has_cash = any(a.action_type == "cash_collection" for a in actions)
    has_status = any(a.action_type == "status_update" for a in actions)

    # Check if cash collection is required
    sale_id = picking["sale_id"][0] if picking.get("sale_id") else None
    try:
        collection_required, _, _ = odoo.resolve_collection(sale_id)
    except Exception:
        collection_required = False

    ready = has_pod and (has_cash or not collection_required)

    return CompletionStatusResponse(
        completion_id=completion_id,
        job_id=job_id,
        has_pod=has_pod,
        has_cash=has_cash,
        has_status=has_status,
        collection_required=collection_required,
        ready=ready,
    )
```

- [ ] **Step 6: Store completion_id when logging actions**

In `services/driver-api/app/routers/status.py`, in the `update_status` function, update the Action creation (around line 124-132) to include `completion_id`:

Replace:
```python
    action = Action(
        action_id=body.action_id,
        driver_id=driver.id,
        job_id=job_id,
        action_type="status_update",
        payload=json.dumps(body.model_dump(), default=str),
        result=json.dumps(result_data),
    )
```

With:
```python
    action = Action(
        action_id=body.action_id,
        driver_id=driver.id,
        job_id=job_id,
        action_type="status_update",
        payload=json.dumps(body.model_dump(), default=str),
        result=json.dumps(result_data),
        completion_id=body.completion_id,
    )
```

Do the same in `services/driver-api/app/routers/pod.py` — update the Action creation (around line 87-100):

Replace:
```python
    action = Action(
        action_id=body.action_id,
        driver_id=driver.id,
        job_id=job_id,
        action_type="proof_of_delivery",
        payload=json.dumps(body.model_dump(), default=str),
        result=json.dumps(result_data),
    )
```

With:
```python
    action = Action(
        action_id=body.action_id,
        driver_id=driver.id,
        job_id=job_id,
        action_type="proof_of_delivery",
        payload=json.dumps(body.model_dump(), default=str),
        result=json.dumps(result_data),
        completion_id=body.completion_id,
    )
```

Do the same in `services/driver-api/app/routers/cash.py` — update the Action creation (around line 70-82):

Replace:
```python
    action = Action(
        action_id=body.action_id,
        driver_id=driver.id,
        job_id=job_id,
        action_type="cash_collection",
        payload=json.dumps(body.model_dump(), default=str),
        result=json.dumps(result_data),
    )
```

With:
```python
    action = Action(
        action_id=body.action_id,
        driver_id=driver.id,
        job_id=job_id,
        action_type="cash_collection",
        payload=json.dumps(body.model_dump(), default=str),
        result=json.dumps(result_data),
        completion_id=body.completion_id,
    )
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd services/driver-api && uv run pytest tests/test_completion.py -v`
Expected: All 3 tests PASS

- [ ] **Step 8: Run full test suite**

Run: `cd services/driver-api && uv run pytest -v`
Expected: All tests pass (existing tests don't send completion_id, which defaults to None — no breakage)

- [ ] **Step 9: Update mobile status API to support completion_id**

In `apps/driver-mobile/src/api/status.ts`, replace the file:

```typescript
import { apiRequest } from './client'

export async function updateStatus(jobId: number, body: {
  action_id: string
  status: string
  timestamp: string
  reason?: string
  note?: string
  completion_id?: string
}) {
  return apiRequest(`/jobs/${jobId}/status`, { method: 'POST', body })
}

export interface CompletionStatus {
  completion_id: string
  job_id: number
  has_pod: boolean
  has_cash: boolean
  has_status: boolean
  collection_required: boolean
  ready: boolean
}

export async function getCompletionStatus(jobId: number, completionId: string) {
  return apiRequest<CompletionStatus>(`/jobs/${jobId}/completion/${completionId}`)
}
```

- [ ] **Step 10: Wire completion_id into the completion screen**

In `apps/driver-mobile/app/jobs/[id]/complete.tsx`, add completion_id generation and pass it through all API calls.

Add after `const storageKey = \`completion_${jobId}\`` (line 51):
```typescript
  const [completionId] = useState(() => generateActionId())
```

Then in `handleSubmit`, add `completion_id: completionId` to the body of each `addAction` call and each direct API call (`submitPod`, `submitCash`, `updateStatus`). Specifically:

In the `addAction` for POD (line 113-123), add `completion_id: completionId` to the body object.

In the `addAction` for cash (line 125-137), add `completion_id: completionId` to the body object.

In the `addAction` for status (line 139-149), add `completion_id: completionId` to the body object.

In the `submitPod` call (line 164-169), add `completion_id: completionId` to the argument object.

In the `submitCash` call (line 181-188), add `completion_id: completionId` to the argument object.

In the `updateStatus` call (line 206-210), add `completion_id: completionId` to the argument object.

- [ ] **Step 11: Commit**

```bash
cd /Users/bill/Developer/work/mobile/driver-app
git add services/driver-api/app/models.py services/driver-api/app/schemas.py \
  services/driver-api/app/routers/status.py services/driver-api/app/routers/pod.py \
  services/driver-api/app/routers/cash.py services/driver-api/tests/test_completion.py \
  apps/driver-mobile/src/api/status.ts apps/driver-mobile/app/jobs/\[id\]/complete.tsx
git commit -m "feat: add resumable completion flow with completion_id

All completion-related actions (POD, cash, status) share a completion_id.
New GET /jobs/:id/completion/:completion_id endpoint reports what's done
vs what's still needed, enabling the app to resume after a crash."
```

---

### Task 4: Add photo preview with retake to completion screen

Currently the camera captures a photo and silently adds it to the list. The driver never sees what they captured. Add a full-screen preview after each capture with "retake" and "use this photo" buttons.

**Files:**
- Modify: `apps/driver-mobile/app/jobs/[id]/complete.tsx`

- [ ] **Step 1: Add preview state and handler**

In `apps/driver-mobile/app/jobs/[id]/complete.tsx`, add a preview state after the existing state declarations (after line 48):

```typescript
  const [previewUri, setPreviewUri] = useState<string | null>(null)
```

Replace the `takePhoto` function (line 83-85):

```typescript
  const takePhoto = async () => {
    const result = await cameraRef.current?.takePictureAsync({ quality: 0.8 })
    if (result?.uri) setPreviewUri(result.uri)
  }

  const acceptPhoto = () => {
    if (previewUri) {
      setPhotos((prev) => [...prev, previewUri])
      setPreviewUri(null)
    }
  }

  const retakePhoto = () => {
    setPreviewUri(null)
  }
```

- [ ] **Step 2: Add preview overlay UI**

In the same file, inside the `{step === 'photos' && (...)}` block, add a preview overlay after the camera view. Insert this after the closing `)}` of the camera permission check block (after line 313) and before the photos thumbnail row:

```tsx
            {previewUri && (
              <YStack
                position="absolute"
                top={0} left={0} right={0} bottom={0}
                backgroundColor="rgba(0,0,0,0.9)"
                justifyContent="center"
                alignItems="center"
                zIndex={100}
                padding={20}
                gap={20}
              >
                <Text fontSize={16} fontWeight="700" color="white">確認照片</Text>
                <Image
                  source={{ uri: previewUri }}
                  style={{ width: '100%', height: 400, borderRadius: 12 }}
                  resizeMode="contain"
                />
                <XStack gap={16} width="100%">
                  <Pressable
                    onPress={retakePhoto}
                    style={{
                      flex: 1, minHeight: 52, borderRadius: 9999,
                      borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
                      justifyContent: 'center', alignItems: 'center',
                    }}
                  >
                    <Text color="white" fontWeight="600" fontSize={16}>重拍</Text>
                  </Pressable>
                  <Pressable
                    onPress={acceptPhoto}
                    style={{
                      flex: 1, minHeight: 52, borderRadius: 9999,
                      backgroundColor: '#22C55E',
                      justifyContent: 'center', alignItems: 'center',
                    }}
                  >
                    <Text color="white" fontWeight="700" fontSize={16}>使用此照片</Text>
                  </Pressable>
                </XStack>
              </YStack>
            )}
```

- [ ] **Step 3: Wrap the photos step content in a relative container**

The preview overlay needs `position: absolute` to work. Wrap the entire photos step `<YStack padding={20} gap={16}>` in a parent with `position: relative`:

Replace:
```tsx
          <YStack padding={20} gap={16}>
```

With:
```tsx
          <YStack padding={20} gap={16} position="relative">
```

- [ ] **Step 4: Test in browser/simulator**

Run: `cd apps/driver-mobile && npx expo start --web`

Test the flow:
1. Navigate to a job → Complete delivery
2. Take a photo — preview should appear full-screen
3. Tap "重拍" — preview dismisses, camera is ready again
4. Take another photo — preview appears
5. Tap "使用此照片" — photo is added to thumbnail row
6. Verify the "下一步" button still works correctly

- [ ] **Step 5: Commit**

```bash
cd /Users/bill/Developer/work/mobile/driver-app
git add apps/driver-mobile/app/jobs/\[id\]/complete.tsx
git commit -m "feat: add photo preview with retake in completion flow

After taking a photo, show a full-screen preview with retake/accept
buttons. Prevents drivers from submitting unusable photos they never
saw — the driver is the quality check."
```
