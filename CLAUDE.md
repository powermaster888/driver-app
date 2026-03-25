# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cross-platform delivery driver app for Healthy Living. Replaces paper/WhatsApp delivery completion workflow with reliable proof-of-delivery and cash collection records.

**Status:** Pre-implementation planning phase. No application code yet — only design docs.

## Architecture

**Thin mobile client + Odoo-backed API layer**

- **Mobile app** (`apps/driver-mobile/`): Expo + React Native + Tamagui, with TanStack Query for data fetching and Zustand for UI state. Uses `expo-router`.
- **Backend API** (`services/driver-api/`): FastAPI service that translates between a mobile-friendly job-oriented API and Odoo's models. Connects to Odoo via XML-RPC. Owns its own lightweight database for driver auth and sync queue.
- **System of record:** Odoo 19 (hosted on odoo.com). Owns assignments, delivery/order/customer data, and canonical status.

The mobile app operates on **job-oriented resources** (not raw Odoo models). All Odoo complexity lives in the API layer.

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

## API Surface (Planned)

```
POST /auth/login
GET  /me/jobs?scope=today|pending|recent
GET  /jobs/:id
POST /jobs/:id/status
POST /jobs/:id/proof-of-delivery
POST /jobs/:id/cash-collection
GET  /sync/status
POST /sync/batch
```

All write endpoints must support client-generated action IDs for idempotent retries.
