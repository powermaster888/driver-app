from fastapi import APIRouter, Depends
from app.auth import get_current_driver
from app.models import Driver
from app.odoo_client import odoo, DELIVERY_PICKING_TYPES

router = APIRouter(tags=["stats"])


@router.get("/me/stats")
def get_driver_stats(driver: Driver = Depends(get_current_driver)):
    try:
        base_domain = [
            ("x_studio_shipper", "=", driver.odoo_shipper_value),
            ("state", "=", "done"),
            ("picking_type_id", "in", DELIVERY_PICKING_TYPES),
        ]

        # Total completed deliveries
        completed = odoo.execute(
            "stock.picking", "search_count", base_domain
        )

        # On-time calculation: compare actual_delivery_date vs scheduled_date
        # Odoo search domain can't compare two fields, so we fetch records with dates
        on_time = 0
        if completed > 0:
            done_ids = odoo.execute(
                "stock.picking", "search", base_domain, {"limit": 500}
            )
            if done_ids:
                records = odoo.execute(
                    "stock.picking", "read", [done_ids],
                    ["x_studio_actual_delivery_date", "scheduled_date"]
                )
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

        on_time_rate = round((on_time / completed * 100), 1) if completed > 0 else 0

        return {
            "total_deliveries": completed,
            "on_time_rate": on_time_rate,
            "rating": None,
        }
    except Exception:
        return {
            "total_deliveries": 0,
            "on_time_rate": 0,
            "rating": None,
        }
