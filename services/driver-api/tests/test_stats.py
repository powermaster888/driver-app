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
