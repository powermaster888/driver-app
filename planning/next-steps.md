# Next Steps

## Resolved decisions (see docs/driver-app-plan.md)

1. ~~Confirm which Odoo model(s) represent driver-assigned deliveries~~
   → `stock.picking` (outgoing), filtered by `x_studio_shipper` matching driver
2. ~~Decide how driver authentication works for BYOD devices~~
   → API-layer auth: phone + PIN → JWT. Driver table maps to `x_studio_shipper` value.
3. ~~Define exact delivery status mapping between app and Odoo~~
   → API owns 7 statuses; writes `done` to Odoo only at delivery completion.
4. ~~Decide where delivery photos / signatures are stored and how they attach back to Odoo~~
   → Photos as `ir.attachment` on `stock.picking`; signatures via existing `signature` binary field.
5. ~~Cash collection detection~~
   → Derived from `sale_order.payment_term_id`: 11=COD cash, 12=COD cheque. Cash data stored in new custom fields on `stock.picking`.

## Remaining planning tasks

1. Design the mobile screen flow in detail (wireframes)
2. Create Odoo custom fields in test instance (`hlm260321.odoo.com`):
   - `x_studio_driver_status` (selection) on `stock.picking`
   - `x_studio_cash_amount` (float) on `stock.picking`
   - `x_studio_cash_method` (selection) on `stock.picking`
   - `x_studio_cash_reference` (char) on `stock.picking`
   - `x_studio_cash_collected_at` (datetime) on `stock.picking`
3. Define the full API contract (request/response shapes for each endpoint)
4. Write implementation plan
5. Scaffold:
   - `apps/driver-mobile/` — Expo + React Native
   - `services/driver-api/` — FastAPI
   - shared docs / env templates

## Suggested repo shape

- `apps/driver-mobile/`
- `services/driver-api/`
- `docs/`
- `planning/`

## Guiding principle

Keep the mobile app thin.
Put Odoo ugliness in the API layer.
