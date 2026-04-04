"""Thin wrapper around Odoo XML-RPC. All Odoo complexity lives here."""
import time
import xmlrpc.client
from app.config import settings

# Simple in-memory cache with TTL
_cache: dict[str, tuple[float, any]] = {}
CACHE_TTL = 30  # seconds


def _cache_get(key: str):
    if key in _cache:
        ts, val = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return val
        del _cache[key]
    return None


def _cache_set(key: str, val):
    _cache[key] = (time.time(), val)

DELIVERY_PICKING_TYPES = [2, 8, 13, 50]
COD_PAYMENT_TERMS = {11: "cash", 12: "cheque"}
WAREHOUSE_NAMES = {2: "HQ", 8: "KT", 13: "YL", 50: "TP"}


class OdooClient:
    def __init__(self):
        self.url = settings.odoo_url
        self.db = settings.odoo_db
        self.username = settings.odoo_username
        self.api_key = settings.odoo_api_key
        self._uid = None
        self._models = None

    @property
    def uid(self):
        if self._uid is None:
            common = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/common")
            self._uid = common.authenticate(self.db, self.username, self.api_key, {})
        return self._uid

    @property
    def models(self):
        if self._models is None:
            self._models = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/object")
        return self._models

    def _reset_connection(self):
        """Reset cached connection on failure."""
        self._uid = None
        self._models = None

    def execute(self, model, method, *args, **kwargs):
        """Execute with 1 automatic retry on connection failure."""
        try:
            return self.models.execute_kw(self.db, self.uid, self.api_key, model, method, list(args), kwargs)
        except (ConnectionError, OSError, xmlrpc.client.ProtocolError) as e:
            # Connection went stale — reset and retry once
            self._reset_connection()
            return self.models.execute_kw(self.db, self.uid, self.api_key, model, method, list(args), kwargs)

    def search_read(self, model, domain, fields, **kwargs):
        return self.execute(model, "search_read", domain, fields=fields, **kwargs)

    def read(self, model, ids, fields):
        """Read with cache — partners and SOs rarely change."""
        if model in ("res.partner", "sale.order"):
            cache_key = f"read:{model}:{sorted(ids)}:{sorted(fields)}"
            cached = _cache_get(cache_key)
            if cached is not None:
                return cached
            result = self.execute(model, "read", ids, fields=fields)
            _cache_set(cache_key, result)
            return result
        return self.execute(model, "read", ids, fields=fields)

    def write(self, model, ids, vals):
        return self.execute(model, "write", ids, vals)

    def create(self, model, vals):
        return self.execute(model, "create", [vals])

    def get_driver_jobs(self, shipper_value, scope, use_cache=True):
        from datetime import datetime, timedelta, timezone
        domain = [
            ("picking_type_id", "in", DELIVERY_PICKING_TYPES),
            ("x_studio_shipper", "=", shipper_value),
        ]
        if scope == "today":
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d 00:00:00")
            tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d 00:00:00")
            domain += [("scheduled_date", ">=", today), ("scheduled_date", "<", tomorrow), ("state", "in", ["confirmed", "assigned"])]
        elif scope == "pending":
            domain += [("state", "in", ["confirmed", "assigned"])]
        elif scope == "recent":
            week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d 00:00:00")
            domain += [("state", "=", "done"), ("date_done", ">=", week_ago)]
        elif scope == "upcoming":
            tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d 00:00:00")
            week_ahead = (datetime.now(timezone.utc) + timedelta(days=8)).strftime("%Y-%m-%d 00:00:00")
            domain += [
                ("scheduled_date", ">=", tomorrow),
                ("scheduled_date", "<", week_ahead),
                ("state", "in", ["confirmed", "assigned"]),
            ]
        elif scope == "all":
            domain += [("state", "=", "done")]
            # No date filter — fetch all completed, limited to 100
        fields = ["name", "origin", "state", "partner_id", "scheduled_date", "sale_id", "x_studio_shipper", "x_studio_do_note", "note", "x_studio_actual_delivery_date", "x_studio_hapo", "x_studio_account_no", "x_studio_driver_status", "picking_type_id", "move_ids"]
        cache_key = f"jobs:{shipper_value}:{scope}"
        if use_cache:
            cached = _cache_get(cache_key)
            if cached is not None:
                return cached
        limit = 100 if scope == "all" else 0
        kwargs = {"order": "scheduled_date asc"}
        if limit:
            kwargs["limit"] = limit
        result = self.search_read("stock.picking", domain, fields, **kwargs)
        _cache_set(cache_key, result)
        return result

    def get_job_detail(self, picking_id, shipper_value):
        results = self.search_read("stock.picking", [("id", "=", picking_id), ("x_studio_shipper", "=", shipper_value)],
            ["name", "origin", "state", "partner_id", "scheduled_date", "sale_id", "x_studio_shipper", "x_studio_do_note", "note", "x_studio_actual_delivery_date", "x_studio_hapo", "x_studio_account_no", "x_studio_driver_status", "picking_type_id", "move_ids"])
        return results[0] if results else None

    def get_partner(self, partner_id):
        results = self.read("res.partner", [partner_id], ["display_name", "phone", "street", "street2", "partner_latitude", "partner_longitude"])
        return results[0] if results else {}

    def get_sale_order(self, sale_id):
        results = self.read("sale.order", [sale_id], ["name", "amount_total", "payment_term_id"])
        return results[0] if results else {}

    def get_move_lines(self, move_ids):
        moves = self.read("stock.move", move_ids, ["product_id", "product_uom_qty"])
        # Batch-fetch product barcodes
        product_ids = list({m["product_id"][0] for m in moves if m.get("product_id")})
        barcode_map: dict[int, str | None] = {}
        if product_ids:
            try:
                products = self.execute("product.product", "read", product_ids, fields=["barcode"])
                barcode_map = {p["id"]: p.get("barcode") or None for p in products}
            except Exception:
                pass
        for m in moves:
            pid = m["product_id"][0] if m.get("product_id") else None
            m["barcode"] = barcode_map.get(pid) if pid else None
        return moves

    def resolve_collection(self, sale_id):
        if not sale_id:
            return False, None, None
        so = self.get_sale_order(sale_id)
        if not so or not so.get("payment_term_id"):
            return False, None, None
        term_id = so["payment_term_id"][0]
        if term_id in COD_PAYMENT_TERMS:
            return True, COD_PAYMENT_TERMS[term_id], so.get("amount_total", 0)
        return False, None, None

    def mark_delivered(self, picking_id):
        from datetime import date

        # Read current state — reserve stock if not yet assigned
        picking = self.read("stock.picking", [picking_id], ["state"])
        if picking and picking[0].get("state") == "confirmed":
            self.execute("stock.picking", "action_assign", [picking_id])

        # Validate the picking
        result = self.execute("stock.picking", "button_validate", [picking_id])

        # Handle wizard response (Odoo may return an action dict for immediate transfer)
        if isinstance(result, dict) and result.get("res_model"):
            wizard_model = result["res_model"]
            wizard_id = result.get("res_id")
            if wizard_id:
                self.execute(wizard_model, "process", [wizard_id])
            else:
                # Create and process the wizard
                context = result.get("context", {})
                wizard_id = self.models.execute_kw(
                    self.db, self.uid, self.api_key,
                    wizard_model, "create", [{}], {"context": context}
                )
                self.models.execute_kw(
                    self.db, self.uid, self.api_key,
                    wizard_model, "process", [[wizard_id]], {"context": context}
                )

        # Set delivery date and status
        self.write("stock.picking", [picking_id], {
            "x_studio_actual_delivery_date": date.today().isoformat(),
            "x_studio_driver_status": "delivered",
        })

    def update_driver_status(self, picking_id, status, note=None):
        vals = {"x_studio_driver_status": status}
        if note:
            existing = self.read("stock.picking", [picking_id], ["x_studio_do_note"])
            existing_note = existing[0].get("x_studio_do_note") or "" if existing else ""
            vals["x_studio_do_note"] = f"{existing_note} | {note}" if existing_note else note
        self.write("stock.picking", [picking_id], vals)

    def save_cash_collection(self, picking_id, amount, method, reference):
        from datetime import datetime, timezone
        self.write("stock.picking", [picking_id], {
            "x_studio_cash_amount": amount, "x_studio_cash_method": method,
            "x_studio_cash_reference": reference,
            "x_studio_cash_collected_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        })

    def create_attachment(self, picking_id, filename, data_b64, mimetype):
        return self.create("ir.attachment", {"name": filename, "res_model": "stock.picking", "res_id": picking_id, "datas": data_b64, "mimetype": mimetype})

    def save_signature(self, picking_id, signature_b64):
        self.write("stock.picking", [picking_id], {"signature": signature_b64})


odoo = OdooClient()
