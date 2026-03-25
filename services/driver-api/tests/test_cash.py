from unittest.mock import patch


@patch("app.routers.cash.odoo")
def test_cash_collection(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = {
        "id": 100,
        "x_studio_shipper": "\u8000",
        "sale_id": [1, "SO-1"],
    }
    mock_odoo.resolve_collection.return_value = (True, "cash", 3985.0)
    resp = client.post(
        "/api/v1/jobs/100/cash-collection",
        json={
            "action_id": "cash-1",
            "amount": 3985.00,
            "method": "cash",
            "reference": "Received",
            "timestamp": "2026-03-25T09:27:00Z",
        },
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["amount"] == 3985.0
    mock_odoo.save_cash_collection.assert_called_once()


@patch("app.routers.cash.odoo")
def test_cash_not_required(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = {
        "id": 100,
        "x_studio_shipper": "\u8000",
        "sale_id": [1, "SO-1"],
    }
    mock_odoo.resolve_collection.return_value = (False, None, None)
    resp = client.post(
        "/api/v1/jobs/100/cash-collection",
        json={
            "action_id": "cash-2",
            "amount": 100,
            "method": "cash",
            "reference": "test",
            "timestamp": "2026-03-25T09:27:00Z",
        },
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"] == "collection_not_required"
