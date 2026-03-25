# Odoo Integration Spec

How the Driver API reads from and writes to Odoo.

---

## Odoo Environment

- **Version:** Odoo 19 (odoo.com SaaS)
- **Production:** `https://healthyliving.odoo.com`
- **Test:** `https://hlm260321.odoo.com`
- **Protocol:** XML-RPC
- **Company:** Healthy Living Medical Supplies Ltd (id=1, HKD)

---

## Core Odoo Model: `stock.picking`

Outgoing stock pickings represent delivery orders. Filter: `picking_type_code = "outgoing"` and exclude PoS order types.

### Relevant picking types (delivery orders only)

| ID | Name | Warehouse |
|----|------|-----------|
| 2  | HQ: Delivery Orders | HQ |
| 8  | KT: Delivery Orders | KT |
| 13 | YL: Delivery Orders | YL |
| 50 | TP: Delivery Orders | TP |

### Key fields on `stock.picking`

| Field | Type | Description |
|-------|------|-------------|
| `name` | char | DO reference (e.g. "DO-26-09921") |
| `origin` | char | Source SO reference (e.g. "SO-26-04591") |
| `state` | selection | draft / confirmed / assigned / done / cancel |
| `partner_id` | many2one → res.partner | Customer / delivery contact |
| `scheduled_date` | datetime | Planned delivery date |
| `date_done` | datetime | Completion timestamp (set when state → done) |
| `sale_id` | many2one → sale.order | Linked sales order |
| `picking_type_id` | many2one → stock.picking.type | Operation type (warehouse source) |
| `signature` | binary | Recipient signature (exists but currently unused) |
| `is_signed` | boolean | Whether signature was captured |
| `note` | html | General notes |
| `move_ids` | one2many → stock.move | Product line items |
| `x_studio_shipper` | selection | Driver/carrier assignment |
| `x_studio_do_note` | char | Internal delivery note |
| `x_studio_actual_delivery_date` | date | Actual delivery date |
| `x_studio_hapo` | char | Additional info (web order ref, etc.) |
| `x_studio_account_no` | char | Customer account number |
| `x_studio_ha_no_no` | char | HA / hospital reference number |
| `x_studio_field_contact_1` | many2one → res.partner | Additional contact |
| `x_studio_field_hA1TX` | many2one → hr.employee | Employee (exists but never populated) |

### `x_studio_shipper` selection values

| Value | Type | Driver App? |
|-------|------|-------------|
| `耀` | Internal driver | Yes |
| `盧生` | Internal driver | Yes |
| `Barry` | Internal driver | Yes |
| `SF Express` | Third-party courier | No |
| `JD 京東` | Third-party courier | No |
| `GOGO Van` | Third-party courier | No |
| `GOGO X` | Third-party courier | No |
| `客自取/歸還` | Customer pickup | No |

---

## Related Models

### `res.partner` (customer/contact)

Accessed via `stock.picking.partner_id`. Note: Odoo 19 has no `mobile` field on `res.partner`.

| Field | Type | Description |
|-------|------|-------------|
| `display_name` | char | Full name |
| `street` | char | Address line 1 |
| `street2` | char | Address line 2 |
| `city` | char | City |
| `phone` | char | Phone number (e.g. "+852 96638085") |
| `email` | char | Email |
| `type` | selection | Address type (delivery / invoice / contact) |
| `parent_id` | many2one | Parent company/contact |

### `sale.order` (sales order)

Accessed via `stock.picking.sale_id`.

| Field | Type | Description |
|-------|------|-------------|
| `name` | char | SO reference (e.g. "SO-26-04591") |
| `amount_total` | monetary | Total order amount (HKD) |
| `payment_term_id` | many2one → account.payment.term | Payment terms |
| `partner_shipping_id` | many2one → res.partner | Delivery address |
| `x_studio_contact_phone` | char | Contact phone |
| `x_studio_inco_term` | char | Additional info (web order ref) |

### `account.payment.term` (payment terms)

| ID | Name | Cash Collection Required? |
|----|------|--------------------------|
| 9  | 已付 (Paid) | No |
| 11 | 貨到付款 - 現金 (COD - Cash) | **Yes → cash** |
| 12 | 貨到付款 - 支票 (COD - Cheque) | **Yes → cheque** |
| 16 | Prepaid | No |
| 17 | 已取 (Collected) | No |
| 21 | Bank Transfer | No |
| 29 | Net 30 | No |

### `stock.move` (product line items)

Accessed via `stock.picking.move_ids`.

| Field | Type | Description |
|-------|------|-------------|
| `product_id` | many2one → product.product | Product (name includes SKU) |
| `product_uom_qty` | float | Ordered quantity |
| `quantity` | float | Delivered quantity |
| `state` | selection | Line item status |
| `sale_line_id` | many2one → sale.order.line | Link to SO line |

### `ir.attachment` (file attachments)

Used for POD photos.

| Field | Type | Description |
|-------|------|-------------|
| `res_model` | char | Must be `"stock.picking"` |
| `res_id` | int | The `stock.picking` ID |
| `name` | char | Filename (e.g. "pod_photo_1.jpg") |
| `datas` | binary | Base64-encoded file content |
| `mimetype` | char | e.g. `"image/jpeg"` |

---

## API → Odoo Read Operations

### Fetch driver's jobs

```python
# Get all assigned outgoing pickings for a driver
domain = [
    ("picking_type_code", "=", "outgoing"),
    ("picking_type_id", "in", [2, 8, 13, 50]),  # Exclude PoS types
    ("x_studio_shipper", "=", driver.odoo_shipper_value),
    ("state", "in", ["confirmed", "assigned"]),
    ("scheduled_date", ">=", today_start),
]
fields = [
    "name", "origin", "state", "partner_id", "scheduled_date",
    "sale_id", "x_studio_shipper", "x_studio_do_note",
    "x_studio_actual_delivery_date", "x_studio_hapo",
    "x_studio_account_no", "picking_type_id", "move_ids", "note"
]
```

### Resolve cash collection requirement

```python
# For each picking, check the linked SO's payment term
sale_order = odoo.read("sale.order", picking.sale_id, ["payment_term_id", "amount_total"])
collection_required = sale_order.payment_term_id[0] in [11, 12]
collection_method = "cash" if sale_order.payment_term_id[0] == 11 else "cheque"
expected_amount = sale_order.amount_total
```

---

## API → Odoo Write Operations

### Mark delivered

```python
# 1. Validate picking (triggers stock moves)
odoo.execute("stock.picking", "button_validate", [picking_id])

# 2. Set actual delivery date
odoo.write("stock.picking", [picking_id], {
    "x_studio_actual_delivery_date": date.today().isoformat(),
    "x_studio_driver_status": "delivered",
})
```

### Upload POD photo

```python
odoo.create("ir.attachment", {
    "name": f"pod_{picking_id}_{timestamp}.jpg",
    "res_model": "stock.picking",
    "res_id": picking_id,
    "datas": base64_encoded_photo,
    "mimetype": "image/jpeg",
})
```

### Save signature

```python
odoo.write("stock.picking", [picking_id], {
    "signature": base64_encoded_signature,
})
```

### Record cash collection

```python
odoo.write("stock.picking", [picking_id], {
    "x_studio_cash_amount": amount,
    "x_studio_cash_method": method,  # "cash" or "cheque"
    "x_studio_cash_reference": reference_note,
    "x_studio_cash_collected_at": datetime.now().isoformat(),
})
```

### Update driver status (intermediate)

```python
odoo.write("stock.picking", [picking_id], {
    "x_studio_driver_status": status,  # accepted/on_the_way/arrived/etc.
})
```

### Mark failed

```python
existing_note = odoo.read("stock.picking", picking_id, ["x_studio_do_note"])
odoo.write("stock.picking", [picking_id], {
    "x_studio_do_note": f"{existing_note or ''} | FAILED: {reason}",
    "x_studio_driver_status": "failed",
})
```

---

## New Odoo Custom Fields Required

These must be created in Odoo Studio on the `stock.picking` model before implementation:

| Field | Technical Name | Type | Selection Values |
|-------|---------------|------|-----------------|
| Driver Status | `x_studio_driver_status` | Selection | assigned, accepted, on_the_way, arrived, delivered, failed, returned |
| Cash Amount | `x_studio_cash_amount` | Float | — |
| Cash Method | `x_studio_cash_method` | Selection | cash, cheque |
| Cash Reference | `x_studio_cash_reference` | Char | — |
| Cash Collected At | `x_studio_cash_collected_at` | Datetime | — |

---

## Known Quirks

1. **Odoo 19 renamed `mobile` → removed** on `res.partner`. Use `phone` only.
2. **Odoo 19 renamed `name` → removed** on `stock.move`. Use `display_name` or `description_picking`.
3. **`x_studio_shipper` is a selection, not a relation.** Cannot be queried like a foreign key.
4. **`x_studio_field_hA1TX` (Employee)** exists but is never populated — do not rely on it.
5. **`signature` field** exists on `stock.picking` but no current workflow uses it.
6. **All pending deliveries are typically unassigned** (`x_studio_shipper = false`). Assignment happens late in the workflow.
7. **`note` field** is HTML type — needs sanitization before displaying in mobile app.
