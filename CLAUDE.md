# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cross-platform delivery driver app for Healthy Living. Replaces paper/WhatsApp delivery completion workflow with reliable proof-of-delivery and cash collection records. Targets iOS and Android via Expo.

## Development Commands

### Mobile app (`apps/driver-mobile/`)

```bash
cd apps/driver-mobile
npm install            # install dependencies
npx expo start         # start dev server (press i/a/w for iOS/Android/web)
npx expo start --web   # web only
npx expo export --platform web  # build static web export to dist/
npx tsc --noEmit       # type-check
```

### Backend API (`services/driver-api/`)

```bash
cd services/driver-api
uv sync                              # install dependencies (uses uv, not pip)
uv run uvicorn app.main:app --reload # start dev server (default port 8000)
uv run pytest                        # run all tests
uv run pytest tests/test_auth.py     # run single test file
uv run pytest -k test_login          # run tests matching pattern
uv run python scripts/seed_drivers.py # seed driver accounts into local DB
```

Environment variables prefixed with `DRIVER_API_` (see `app/config.py`). Requires `.env` in `services/driver-api/` with `DRIVER_API_ODOO_USERNAME` and `DRIVER_API_ODOO_API_KEY` for Odoo connectivity. Database defaults to SQLite at `./driver_api.db`.

## Architecture

**Thin mobile client + Odoo-backed API layer**

- **Mobile app** (`apps/driver-mobile/`): Expo 52 + React Native + Tamagui (UI), TanStack Query (data fetching), Zustand (client state), expo-router (file-based routing).
- **Backend API** (`services/driver-api/`): FastAPI + SQLAlchemy + SQLite. Translates between a mobile-friendly job-oriented API and Odoo's models via XML-RPC (`app/odoo_client.py`). Owns driver auth (phone+PIN→JWT) and action sync queue.
- **System of record:** Odoo 19 (hosted on odoo.com). Owns assignments, delivery/order/customer data, and canonical status.

The mobile app operates on **job-oriented resources** (not raw Odoo models). All Odoo complexity lives in the API layer.

### Mobile app structure

- `app/` — expo-router pages: `_layout.tsx` (root with auth guard + providers), `login.tsx`, `(tabs)/` (jobs list, history, settings), `jobs/[id]/complete.tsx`, `camera.tsx`, `scanner.tsx`
- `src/api/` — API client modules (auth, jobs, status, pod, cash, sync, uploads, partial)
- `src/store/` — Zustand stores (auth, queue, settings)
- `src/sync/engine.ts` — offline sync engine
- `src/components/` — shared UI components (JobCard, StatusBadge, CashBadge, SyncIndicator, OfflineBanner, etc.)
- `src/theme/` — status color mappings
- `tamagui.config.ts` — theme tokens (light/dark), custom colors: primary, danger, success, warning, muted, surfaceHover, textSecondary

### Backend API structure

- `app/main.py` — FastAPI app setup, CORS, router mounting (all under `/api/v1`)
- `app/routers/` — route handlers: auth, jobs, status, pod, cash, sync, uploads, partial, stats
- `app/models.py` — SQLAlchemy models (Driver, action queue)
- `app/schemas.py` — Pydantic request/response schemas
- `app/state_machine.py` — delivery status transition enforcement
- `app/odoo_client.py` — XML-RPC client for Odoo
- `app/config.py` — settings via pydantic-settings (env prefix: `DRIVER_API_`)
- `tests/` — pytest test suite (auth, jobs, status, pod, cash, sync, uploads, state machine, Odoo integration)
- `scripts/seed_drivers.py` — seed script for driver accounts

## Odoo Environments

- **Production:** `https://healthyliving.odoo.com` — read-only, never write during development
- **Test:** `https://hlm260321.odoo.com` — use for all development and integration testing

MCP server prefixes: `mcp__odoo__` (production), `mcp__odoo_Test__` (test).

## Key Design Decisions

- **Offline-first:** Actions save locally first, queue with unique `action_id`, retry automatically, API accepts idempotent retries. Sync states (saved locally / pending sync / synced / sync failed) must always be visible.
- **Delivery completion guardrails:** `delivered` status requires at least 1 photo; if cash collection is required, amount + payment method + reference are mandatory. `failed` status requires a failure reason.
- **Status state machine:** assigned → accepted → on_the_way → arrived → delivered/failed → returned. Only allowed transitions are enforced. API owns all 7 statuses; only terminal states (`delivered` → `done`) are written to Odoo.
- **Auth:** API-layer auth with phone + PIN → JWT. 3 internal drivers (耀, 盧生, Barry). Each driver maps to an `x_studio_shipper` selection value in Odoo.
- **Photo/signature storage:** Photos stored as `ir.attachment` on `stock.picking`. Signatures use existing `stock.picking.signature` binary field.
- **Cash collection detection:** Derived from `sale_order.payment_term_id` — id 11 = COD cash, id 12 = COD cheque. Cash data stored in custom fields on `stock.picking`.
- **Odoo core model:** `stock.picking` (outgoing) is the delivery record. Product lines via `stock.move`. Customer data via `res.partner`. Sales order via `sale.order`.

## Planning Docs

- `docs/driver-app-plan.md` — full product + technical plan (scope, data model, Odoo integration, API routes, workflow states, sync model)
- `docs/odoo-integration.md` — detailed Odoo field mapping, custom field requirements, and write-back strategy
- `planning/next-steps.md` — pre-implementation planning sequence (resolved + remaining)
