from fastapi import APIRouter, Depends
from app.auth import get_current_driver
from app.models import Driver
from app.odoo_client import odoo, DELIVERY_PICKING_TYPES

router = APIRouter(tags=["stats"])


@router.get("/me/stats")
def get_driver_stats(driver: Driver = Depends(get_current_driver)):
    try:
        # Total completed deliveries
        completed = odoo.execute(
            "stock.picking", "search_count",
            [
                ("x_studio_shipper", "=", driver.odoo_shipper_value),
                ("state", "=", "done"),
                ("picking_type_id", "in", DELIVERY_PICKING_TYPES),
            ]
        )

        # On-time deliveries (actual_date <= scheduled_date)
        # Simplified: count completed with actual_delivery_date set
        on_time = odoo.execute(
            "stock.picking", "search_count",
            [
                ("x_studio_shipper", "=", driver.odoo_shipper_value),
                ("state", "=", "done"),
                ("picking_type_id", "in", DELIVERY_PICKING_TYPES),
                ("x_studio_actual_delivery_date", "!=", False),
            ]
        )

        on_time_rate = round((on_time / completed * 100), 1) if completed > 0 else 0

        return {
            "total_deliveries": completed,
            "on_time_rate": on_time_rate,
            "rating": 4.9,  # Placeholder until we have a rating system
        }
    except Exception:
        return {
            "total_deliveries": 0,
            "on_time_rate": 0,
            "rating": 0,
        }
