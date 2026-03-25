# Driver App Plan

## 1. Product direction

### Goal
Build a **universal delivery driver app** for Healthy Living that works on **iOS and Android**.

### Primary business outcomes
1. Replace paper / WhatsApp-based delivery completion workflow
2. Give the office reliable proof-of-delivery records
3. Give the office reliable cash collection records

### Chosen architecture
**Thin mobile client + Odoo-backed API layer**

Rationale:
- Odoo remains the source of truth
- the mobile app stays focused on execution, not ERP complexity
- a thin API layer translates Odoo data into a driver-friendly contract
- future Android/web/admin surfaces can reuse the same backend contract

---

## 2. Confirmed v1 scope

### In scope
- driver login
- assigned deliveries
- today + pending jobs as the main list
- recent history lookup
- delivery detail screen
- status updates
- proof of delivery capture
- cash collection capture
- offline capture with later sync
- sync back into Odoo

### Out of scope for v1
- route optimization
- fleet tracking
- in-app chat
- advanced device management / MDM
- broad ERP/admin functionality in the mobile app
- overcomplicated dispatcher workflow if Odoo already assigns jobs

---

## 3. Confirmed business decisions

### Assignment source
- **Odoo** is the source of truth for delivery assignment
- Deliveries are assigned via `x_studio_shipper` field on `stock.picking` (selection dropdown)
- Assignment may happen late (day-of); many pending deliveries are unassigned

### Driver/device model
- **3 drivers** initially: 耀 (Yiu), 盧生 (Lo Sang), Barry
- **BYOD phones**
- The same `x_studio_shipper` field also holds third-party couriers (SF Express, JD 京東, GOGO Van/X) — the driver app is only for internal drivers

### Proof of delivery rules
- **required:** delivery photo
- **optional:** recipient signature (Odoo `stock.picking.signature` field exists but is unused today)
- **optional:** delivery notes

### Cash collection rules
Cash collection is required when the sales order `payment_term_id` is:
- `11` = 貨到付款 - 現金 (COD - Cash)
- `12` = 貨到付款 - 支票 (COD - Cheque)

Required fields:
- amount (from `sale_order.amount_total`)
- payment method (cash or cheque, derived from payment term)
- reference / notes

Optional fields:
- photo

### Offline behavior
- allow offline capture and temporary local save
- sync automatically later when network returns

### Multi-warehouse
Deliveries originate from multiple warehouses:
- HQ (picking_type_id=2)
- KT (picking_type_id=8)
- YL (picking_type_id=13)
- TP (picking_type_id=50)

Drivers should see the source warehouse for pickup routing.

---

## 4. Recommended technology stack

### Mobile app
- **Expo**
- **React Native**
- **Tamagui**
- **TanStack Query**
- **Zustand**
- likely `expo-router`

### Backend
- **FastAPI**
- thin API layer in front of Odoo
- connects to Odoo via XML-RPC (Odoo 19 on odoo.com SaaS)
- owns its own lightweight database for driver auth and sync queue

### System of record
- **Odoo** (Odoo 19, hosted on odoo.com)
- Production: `https://healthyliving.odoo.com`
- Test: `https://hlm260321.odoo.com`

### Why this stack
- Expo speeds up cross-platform development and device integration
- React Native keeps one app for iOS + Android
- Tamagui gives a proper cross-platform design system
- React Query is ideal for remote job data + sync state
- Zustand is enough for lightweight UI/app state
- FastAPI is a clean fit for validation, orchestration, and Odoo translation work

---

## 5. UX direction

This app should feel like a **field operations tool**, not a mini ERP.

### Design principles
- large touch targets
- one primary action per screen
- minimal typing
- strong status visibility
- camera-first completion flow
- obvious sync state
- optimized for one-handed real-world use

### UX priorities
- drivers should complete delivery tasks quickly
- the app should reduce ambiguity, not create more office cleanup
- bad mobile signal should not destroy the workflow

---

## 6. System architecture

### A. Mobile app responsibilities
- authenticate driver
- show assigned jobs
- show delivery details
- capture status updates
- capture POD photo/signature/notes
- capture cash collection details
- queue offline actions
- show pending sync / synced states clearly

### B. Driver API responsibilities
- authenticate driver accounts
- expose a mobile-friendly API contract
- validate allowed status transitions
- accept attachment uploads
- accept cash collection payloads
- handle idempotent sync writes
- translate mobile actions into Odoo writes

### C. Odoo responsibilities
- source of truth for assignments
- delivery/order/customer data
- canonical delivery status
- canonical proof/cash records after sync

### Design rule
**The mobile app should operate on job-oriented resources, not raw Odoo models.**

---

## 7. API philosophy

The API should expose driver-safe resources such as:
- `POST /auth/login`
- `GET /me/jobs?scope=today|pending|recent`
- `GET /jobs/:id`
- `POST /jobs/:id/status`
- `POST /jobs/:id/proof-of-delivery`
- `POST /jobs/:id/cash-collection`
- `GET /sync/status`
- `POST /sync/batch`

### Important API behaviors
- support client-generated action IDs
- support retries without duplicate side effects
- validate required completion data
- keep auditability of who did what and when

---

## 8. Authentication model

### Decision: API-layer auth

Odoo has no user accounts for drivers. The `x_studio_shipper` field is a text selection, not a user relation. Auth lives in the FastAPI layer.

### Driver table (API database)
- id
- name
- phone
- pin_hash (bcrypt)
- odoo_shipper_value (e.g. "耀", "盧生", "Barry")
- active flag

### Auth flow
1. Driver enters phone + 4–6 digit PIN
2. API validates against driver table
3. Returns JWT token (long-lived, refreshable)
4. API uses `odoo_shipper_value` to filter deliveries from Odoo

### Initial driver data
| Name | Odoo Shipper Value |
|------|-------------------|
| 耀 (Yiu) | `耀` |
| 盧生 (Lo Sang) | `盧生` |
| Barry | `Barry` |

---

## 9. Odoo integration layer

### Odoo model: `stock.picking` (outgoing)

The driver app's "Delivery Job" maps to outgoing stock pickings. The API translates between Odoo's complex model and a clean mobile contract.

### Field mapping: Odoo → API response

| API Field | Odoo Source | Type |
|---|---|---|
| `job_id` | `stock.picking.id` | int |
| `odoo_reference` | `stock.picking.name` | str (e.g. "DO-26-09921") |
| `sales_order_ref` | `stock.picking.origin` | str (e.g. "SO-26-04591") |
| `customer_name` | `res.partner.display_name` (via `partner_id`) | str |
| `phone` | `res.partner.phone` | str |
| `address` | `res.partner.street` + `street2` | str |
| `delivery_notes` | `x_studio_do_note` + `note` | str |
| `additional_info` | `x_studio_hapo` | str (web order ref, etc.) |
| `account_no` | `x_studio_account_no` | str |
| `collection_required` | Derived: `sale_order.payment_term_id` in [11, 12] | bool |
| `collection_method` | `payment_term_id=11` → cash, `12` → cheque | str |
| `expected_collection_amount` | `sale_order.amount_total` | float |
| `status` | API-managed (see status mapping) | str |
| `odoo_state` | `stock.picking.state` | str |
| `scheduled_date` | `stock.picking.scheduled_date` | datetime |
| `warehouse` | `picking_type_id.warehouse_id.name` | str (HQ/KT/YL/TP) |
| `items` | `stock.move` lines (product name, qty) | list |

### Writing back to Odoo

| Driver Action | Odoo Write |
|---|---|
| Mark delivered | `state` → `done`, set `x_studio_actual_delivery_date` |
| Upload POD photo | Create `ir.attachment` on `stock.picking` |
| Capture signature | Write to `stock.picking.signature` (binary) |
| Record cash collection | Write custom fields (see below) |
| Mark failed | Write failure reason to `x_studio_do_note` |

### New Odoo custom fields needed

Add to `stock.picking`:
- `x_studio_driver_status` (selection) — granular driver workflow status for office visibility
- `x_studio_cash_amount` (float) — collected cash/cheque amount
- `x_studio_cash_method` (selection: cash/cheque) — payment method collected
- `x_studio_cash_reference` (char) — reference or note for collection
- `x_studio_cash_collected_at` (datetime) — when collection happened

### POD storage

Photos are stored as `ir.attachment` records linked to the `stock.picking`:
- `res_model` = `stock.picking`
- `res_id` = picking ID
- `datas` = base64-encoded photo
- `mimetype` = `image/jpeg`

Signatures use the existing `stock.picking.signature` binary field.

---

## 10. Core data model

### Driver (API database)
- id
- name
- phone
- pin_hash
- odoo_shipper_value
- active flag

### Delivery Job (API response, assembled from Odoo)
- job_id (stock.picking.id)
- odoo_reference
- sales_order_ref
- assigned_driver_id
- customer_name
- phone
- address
- delivery_notes
- additional_info
- account_no
- collection_required
- collection_method (cash / cheque)
- expected_collection_amount
- status (API-managed)
- scheduled_date
- warehouse
- items (product name + qty list)
- last_synced_at

### Proof of Delivery
- pod_id
- job_id
- photo (required) → stored as `ir.attachment`
- signature (optional) → stored in `stock.picking.signature`
- note (optional)
- captured_at
- synced_at

### Cash Collection
- collection_id
- job_id
- amount
- payment_method (cash / cheque)
- reference_or_note
- photo (optional) → stored as `ir.attachment`
- captured_at
- synced_at

### Sync Action
- action_id
- job_id
- action_type
- payload
- created_at
- sync_status
- retry_count
- last_error

---

## 11. Workflow state machine

### Decision: API owns the workflow

The API layer manages all 7 driver statuses. Odoo only has 5 states (draft/confirmed/assigned/done/cancel), so intermediate driver statuses (accepted, on_the_way, arrived) cannot be stored in Odoo's native `state` field.

The API writes to Odoo only at terminal transitions.

### Status mapping

| App Status | Odoo `state` Write | Odoo `x_studio_driver_status` Write |
|---|---|---|
| assigned | — (read from Odoo) | — |
| accepted | no change | `accepted` |
| on_the_way | no change | `on_the_way` |
| arrived | no change | `arrived` |
| delivered | → `done` + set `x_studio_actual_delivery_date` | `delivered` |
| failed | write reason to `x_studio_do_note` | `failed` |
| returned | TBD (possibly `cancel`) | `returned` |

### Recommended statuses
- assigned
- accepted
- on_the_way
- arrived
- delivered
- failed
- returned

### Allowed transitions
- assigned -> accepted
- accepted -> on_the_way
- on_the_way -> arrived
- arrived -> delivered
- arrived -> failed
- on_the_way -> failed
- failed -> returned

### Guardrails for `delivered`
To mark a job as delivered, require:
- at least 1 delivery photo
- optional signature
- optional note
- if collection is required:
  - amount
  - payment method (cash or cheque)
  - reference/note
  - optional photo

### Guardrails for `failed`
Require:
- failure reason
- optional note
- optional photo

Reason: otherwise drivers will choose meaningless failure states and create cleanup work later.

---

## 12. Offline-first sync model

### Flow
1. user action is saved locally first
2. job becomes `pending sync`
3. action is queued with a unique `action_id`
4. app retries automatically
5. API accepts idempotent retries
6. server confirms and local item becomes `synced`

### UX requirement
The app must clearly show:
- saved locally
- pending sync
- synced
- sync failed

Never pretend the server confirmed something when it did not.

### Failure cases to design for
- photo captured but upload pending
- delivered marked locally but not yet synced
- duplicate retries after unstable connection
- server-side/Odoo rejection because record state changed
- logout while critical actions remain unsynced

### Recommended rule
Warn loudly or block logout if there are unsynced critical delivery-completion actions.

---

## 13. Recommended app sections

### Main app sections
1. Login
2. My Jobs
3. Job Detail
4. Complete Delivery
5. Recent History
6. Sync Status / Pending Uploads

### Job detail should include
- customer name
- phone (tap-to-call)
- address (tap-to-navigate)
- delivery reference (DO number + SO number)
- account number (if exists)
- warehouse source (HQ/KT/YL/TP)
- product line items (name + qty)
- notes (delivery notes + additional info)
- collection requirement / amount / method if relevant
- current status
- quick actions

### Complete delivery flow should prioritize
1. photo capture
2. optional signature
3. optional notes
4. cash collection details if required
5. save / sync confirmation

---

## 14. Risks and anti-patterns to avoid

### Avoid
- direct raw Odoo coupling from mobile
- too many statuses
- hidden sync failures
- requiring too much typing at the doorstep
- building admin/dispatcher features into v1 mobile
- pretending offline support exists without a real queue and retry model

### Most likely project risk
Trying to make the mobile app handle ERP complexity directly. That is how this kind of tool becomes slow, brittle, and painful.

---

## 15. Remaining planning steps

Resolved:
- ~~define exact Odoo records the driver API will read/write~~ → `stock.picking` (outgoing), see §9
- ~~define the mobile `DeliveryJob` contract returned by API~~ → see §9 field mapping
- ~~define attachment handling (photo/signature storage and mapping)~~ → `ir.attachment` + `signature` field, see §9
- ~~define auth model for BYOD drivers~~ → API-layer phone+PIN auth, see §8

Still needed:
1. design the mobile screen flow in detail (wireframes)
2. create Odoo custom fields (`x_studio_driver_status`, cash collection fields) in test instance
3. write implementation plan
4. scaffold repo structure for mobile app + FastAPI service

---

## 16. Current recommendation summary

**Build a universal mobile driver app using Expo + React Native + Tamagui, backed by a FastAPI layer that translates between a clean mobile workflow and Odoo.**

The system should be:
- job-centric
- offline-capable
- strict about proof/cash capture
- visually simple
- operationally boring in the best possible way

That is the version most likely to ship fast and not become a cleanup nightmare later.
