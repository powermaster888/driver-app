# Driver API Contract Design

Defines the HTTP API contract between the mobile app and the FastAPI driver-api service.

## Design Decisions

- **Pattern:** Hybrid REST + Batch — individual endpoints for real-time use, batch endpoint for offline queue replay
- **File uploads:** Separate upload endpoint returns `upload_id`, referenced in subsequent requests
- **Idempotency:** All write endpoints accept client-generated `action_id` UUIDs; replayed actions return the original result
- **Auth:** Phone + PIN → JWT (30-day, refreshable)
- **Errors:** Consistent JSON shape with typed error codes

---

## Base URL

```
https://<driver-api-host>/api/v1
```

All requests (except `/auth/login`) require `Authorization: Bearer <token>`.

---

## Endpoints

### 1. `POST /auth/login`

Authenticate a driver and receive a JWT token.

**Request:**
```json
{
  "phone": "+85291234567",
  "pin": "1234"
}
```

**Response 200:**
```json
{
  "token": "eyJhbG...",
  "driver": {
    "id": 1,
    "name": "耀",
    "phone": "+85291234567"
  }
}
```

**Response 401:**
```json
{
  "error": "invalid_credentials",
  "message": "Phone or PIN is incorrect"
}
```

**Notes:**
- JWT is long-lived (30 days)
- No separate refresh endpoint for v1

---

### 2. `GET /me/jobs?scope=today|pending|recent`

List jobs assigned to the authenticated driver.

**Query parameters:**
| Param | Values | Description |
|-------|--------|-------------|
| `scope` | `today` | Scheduled for today, any non-terminal status |
| | `pending` | Assigned, not yet completed |
| | `recent` | Completed in last 7 days |

**Response 200:**
```json
{
  "jobs": [
    {
      "job_id": 120723,
      "odoo_reference": "DO-26-09394",
      "sales_order_ref": "SO-26-10732",
      "customer_name": "陳生",
      "phone": "+852 91234567",
      "address": "Room B03, 5/F, Ka To Factory Building",
      "warehouse": "HQ",
      "scheduled_date": "2026-03-25T10:03:36Z",
      "status": "assigned",
      "collection_required": true,
      "collection_method": "cash",
      "expected_collection_amount": 3985.00,
      "sync_status": "synced"
    }
  ],
  "fetched_at": "2026-03-25T08:00:00Z"
}
```

**Notes:**
- List payload is lightweight — no items, POD, or cash detail
- `sync_status` reflects whether the latest driver action for this job has been synced to Odoo

---

### 3. `GET /jobs/:id`

Full job detail including product line items.

**Response 200:**
```json
{
  "job_id": 120723,
  "odoo_reference": "DO-26-09394",
  "sales_order_ref": "SO-26-10732",
  "customer_name": "陳生",
  "phone": "+852 91234567",
  "address": "Room B03, 5/F, Ka To Factory Building",
  "warehouse": "HQ",
  "scheduled_date": "2026-03-25T10:03:36Z",
  "status": "assigned",
  "delivery_notes": "請打電話先",
  "additional_info": "網站訂單: 319602",
  "account_no": "H44501",
  "collection_required": true,
  "collection_method": "cash",
  "expected_collection_amount": 3985.00,
  "items": [
    {
      "product_name": "[MEKI-0038] 日本 Terumo Syringe 螺絲咀針筒 - 3ml",
      "quantity": 10
    },
    {
      "product_name": "[MEKI-0039] 日本 Terumo Syringe 螺絲咀針筒 - 5ml",
      "quantity": 10
    }
  ],
  "proof_of_delivery": null,
  "cash_collection": null,
  "sync_status": "synced"
}
```

**Response 404:**
```json
{
  "error": "not_found",
  "message": "Job not found or not assigned to this driver"
}
```

---

### 4. `POST /jobs/:id/status`

Update a job's workflow status.

**Request:**
```json
{
  "action_id": "a1b2c3d4-uuid-generated-by-client",
  "status": "on_the_way",
  "timestamp": "2026-03-25T09:15:00Z"
}
```

**Request (for `failed` status — `reason` required):**
```json
{
  "action_id": "...",
  "status": "failed",
  "reason": "customer_not_home",
  "note": "Tried calling twice, no answer",
  "timestamp": "2026-03-25T11:30:00Z"
}
```

**Response 200:**
```json
{
  "action_id": "a1b2c3d4-uuid-generated-by-client",
  "job_id": 120723,
  "status": "on_the_way",
  "accepted": true
}
```

**Response 200 (idempotent replay):**
```json
{
  "action_id": "a1b2c3d4-uuid-generated-by-client",
  "job_id": 120723,
  "status": "on_the_way",
  "accepted": true,
  "replayed": true
}
```

**Response 409 (invalid transition):**
```json
{
  "error": "invalid_transition",
  "message": "Cannot transition from 'assigned' to 'delivered'",
  "current_status": "assigned",
  "allowed_transitions": ["accepted"]
}
```

**Failure reason enum:**
- `customer_not_home`
- `wrong_address`
- `customer_refused`
- `access_issue`
- `other`

**Allowed transitions:**
```
assigned    → accepted
accepted    → on_the_way
on_the_way  → arrived
on_the_way  → failed
arrived     → delivered
arrived     → failed
failed      → returned
```

**Notes:**
- `timestamp` is when the driver performed the action (may differ from server time due to offline)
- `delivered` status has a prerequisite: POD must be submitted first (at least 1 photo). If collection is required, cash collection must also be submitted.
- Server validates transition is allowed before applying

---

### 5. `POST /uploads`

Upload a file (photo or signature) independently of any job.

**Request:**
```
Content-Type: multipart/form-data

file: <binary>
type: "photo" | "signature"
```

**Response 200:**
```json
{
  "upload_id": "up_7f3a9b2c",
  "type": "photo",
  "size_bytes": 2456789,
  "mimetype": "image/jpeg",
  "uploaded_at": "2026-03-25T09:20:00Z"
}
```

**Response 413:**
```json
{
  "error": "file_too_large",
  "message": "Maximum file size is 10MB",
  "max_bytes": 10485760
}
```

**Notes:**
- Returns an `upload_id` to reference in POD or cash collection requests
- Accepted formats: JPEG, PNG for photos; PNG for signatures
- Max file size: 10MB
- Uploads stored temporarily in API layer until linked to a job, then written to Odoo as `ir.attachment`
- Unlinked uploads garbage-collected after 24 hours

---

### 6. `POST /jobs/:id/proof-of-delivery`

Submit proof of delivery for a job.

**Request:**
```json
{
  "action_id": "pod-uuid-from-client",
  "photo_upload_ids": ["up_7f3a9b2c", "up_8e4b1d3a"],
  "signature_upload_id": "up_9c2f4e5b",
  "note": "Left with reception",
  "timestamp": "2026-03-25T09:25:00Z"
}
```

**Response 200:**
```json
{
  "action_id": "pod-uuid-from-client",
  "job_id": 120723,
  "accepted": true,
  "photos_synced": 2,
  "signature_synced": true
}
```

**Response 422:**
```json
{
  "error": "validation_error",
  "message": "At least 1 photo is required",
  "fields": {
    "photo_upload_ids": "At least 1 upload ID required"
  }
}
```

**Notes:**
- At least 1 `photo_upload_ids` required
- `signature_upload_id` and `note` are optional
- Idempotent via `action_id`
- On sync to Odoo: photos become `ir.attachment` on `stock.picking`, signature writes to `stock.picking.signature`

---

### 7. `POST /jobs/:id/cash-collection`

Record cash or cheque collection for a job.

**Request:**
```json
{
  "action_id": "cash-uuid-from-client",
  "amount": 3985.00,
  "method": "cash",
  "reference": "Received from reception desk",
  "photo_upload_id": "up_1a2b3c4d",
  "timestamp": "2026-03-25T09:27:00Z"
}
```

**Response 200:**
```json
{
  "action_id": "cash-uuid-from-client",
  "job_id": 120723,
  "accepted": true,
  "amount": 3985.00,
  "method": "cash"
}
```

**Response 422:**
```json
{
  "error": "collection_not_required",
  "message": "This job does not require cash collection"
}
```

**Notes:**
- `method`: `"cash"` or `"cheque"`
- `amount`, `method`, `reference` are required
- `photo_upload_id` is optional
- Server validates against the SO's `payment_term_id`
- On sync to Odoo: writes `x_studio_cash_amount`, `x_studio_cash_method`, `x_studio_cash_reference`, `x_studio_cash_collected_at`

---

### 8. `POST /sync/batch`

Replay queued offline actions. Each action maps to an individual endpoint.

**Request:**
```json
{
  "actions": [
    {
      "action_id": "a1-uuid",
      "endpoint": "/jobs/120723/status",
      "method": "POST",
      "body": {
        "action_id": "a1-uuid",
        "status": "arrived",
        "timestamp": "2026-03-25T09:10:00Z"
      }
    },
    {
      "action_id": "a2-uuid",
      "endpoint": "/uploads",
      "method": "POST",
      "body": { "type": "photo" },
      "file": "<base64>"
    },
    {
      "action_id": "a3-uuid",
      "endpoint": "/jobs/120723/proof-of-delivery",
      "method": "POST",
      "body": {
        "action_id": "a3-uuid",
        "photo_upload_ids": ["up_from_a2"],
        "note": "Left at door",
        "timestamp": "2026-03-25T09:12:00Z"
      }
    }
  ]
}
```

**Response 200:**
```json
{
  "results": [
    {
      "action_id": "a1-uuid",
      "accepted": true,
      "replayed": false
    },
    {
      "action_id": "a2-uuid",
      "accepted": true,
      "upload_id": "up_from_a2"
    },
    {
      "action_id": "a3-uuid",
      "accepted": true
    }
  ],
  "synced": 3,
  "failed": 0
}
```

**Response 200 (partial failure):**
```json
{
  "results": [
    {
      "action_id": "a1-uuid",
      "accepted": true
    },
    {
      "action_id": "a2-uuid",
      "accepted": false,
      "error": "invalid_transition",
      "message": "Cannot transition from 'assigned' to 'delivered'"
    }
  ],
  "synced": 1,
  "failed": 1
}
```

**Notes:**
- Actions processed in order (FIFO) — critical for status → POD → cash sequencing
- Each action uses the same validation as its individual endpoint
- Partial failure: successful actions committed, failed ones returned with errors
- Upload actions in batch accept base64 in `file` field (since multipart doesn't work in JSON)
- Already-processed `action_id`s return `replayed: true`
- Mobile app keeps failed actions in local queue for user review

---

### 9. `GET /sync/status`

Check sync state for the authenticated driver.

**Response 200:**
```json
{
  "driver_id": 1,
  "last_sync_at": "2026-03-25T09:30:00Z",
  "pending_actions": 0,
  "last_error": null
}
```

---

## Error Response Contract

All errors follow a consistent shape:

```json
{
  "error": "error_code",
  "message": "Human-readable description",
  "fields": {}
}
```

**Standard error codes:**

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `invalid_credentials` | 401 | Bad phone/PIN |
| `unauthorized` | 401 | Missing or expired token |
| `not_found` | 404 | Job doesn't exist or not assigned to this driver |
| `invalid_transition` | 409 | Status transition not allowed |
| `validation_error` | 422 | Missing required fields |
| `collection_not_required` | 422 | Job doesn't need cash collection |
| `file_too_large` | 413 | Upload exceeds 10MB |
| `odoo_error` | 502 | Odoo rejected the write or is unavailable |

**`odoo_error` note:** When Odoo is down or rejects a write, mobile app should treat as retryable. Validation errors (422) are not retryable without user correction.

---

## Delivery Completion Flow

The typical sequence for completing a delivery:

```
1. POST /jobs/:id/status        → { status: "accepted" }
2. POST /jobs/:id/status        → { status: "on_the_way" }
3. POST /jobs/:id/status        → { status: "arrived" }
4. POST /uploads                → photo 1 → upload_id_1
5. POST /uploads                → photo 2 → upload_id_2
6. POST /uploads                → signature → upload_id_3
7. POST /jobs/:id/proof-of-delivery → { photo_upload_ids: [...], signature_upload_id: ... }
8. POST /jobs/:id/cash-collection   → { amount, method, reference } (if required)
9. POST /jobs/:id/status        → { status: "delivered" }
```

**Prerequisite enforcement:**
- `delivered` status requires POD to be submitted (at least 1 photo)
- If `collection_required`, cash collection must also be submitted before `delivered`
- Server rejects the `delivered` transition with a `validation_error` if prerequisites are not met

**Offline variant:**
All actions queue locally, then replay via `POST /sync/batch` in the same order when connectivity returns.
