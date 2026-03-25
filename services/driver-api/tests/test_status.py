from unittest.mock import patch

MOCK_PICKING_ASSIGNED = {
    "id": 120723, "name": "DO-26-09394", "origin": "SO-26-10732", "state": "assigned",
    "partner_id": [151221, "陳生"], "scheduled_date": "2026-03-25 10:03:36",
    "sale_id": [124482, "SO-26-10732"], "x_studio_shipper": "耀",
    "x_studio_do_note": False, "note": False,
    "x_studio_actual_delivery_date": False, "x_studio_hapo": False,
    "x_studio_account_no": "H44501", "x_studio_driver_status": "assigned",
    "picking_type_id": [2, "HQ: Delivery Orders"], "move_ids": [317020],
}

MOCK_PICKING_ARRIVED = {
    **MOCK_PICKING_ASSIGNED,
    "x_studio_driver_status": "arrived",
}


@patch("app.routers.status.odoo")
def test_status_update(mock_odoo, client, seeded_db, auth_token, db):
    mock_odoo.get_job_detail.return_value = MOCK_PICKING_ASSIGNED

    resp = client.post(
        "/api/v1/jobs/120723/status",
        json={"action_id": "act-001", "status": "accepted", "timestamp": "2026-03-25T12:00:00Z"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["action_id"] == "act-001"
    assert data["status"] == "accepted"
    assert data["accepted"] is True
    assert data["replayed"] is False
    mock_odoo.update_driver_status.assert_called_once_with(120723, "accepted", None)


@patch("app.routers.status.odoo")
def test_invalid_transition(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = MOCK_PICKING_ASSIGNED

    resp = client.post(
        "/api/v1/jobs/120723/status",
        json={"action_id": "act-002", "status": "delivered", "timestamp": "2026-03-25T12:00:00Z"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 409


@patch("app.routers.status.odoo")
def test_idempotent_replay(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = MOCK_PICKING_ASSIGNED

    # First request
    client.post(
        "/api/v1/jobs/120723/status",
        json={"action_id": "act-003", "status": "accepted", "timestamp": "2026-03-25T12:00:00Z"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )

    # Replay with same action_id
    resp = client.post(
        "/api/v1/jobs/120723/status",
        json={"action_id": "act-003", "status": "accepted", "timestamp": "2026-03-25T12:00:00Z"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["replayed"] is True


@patch("app.routers.status.odoo")
def test_failed_requires_reason(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = MOCK_PICKING_ARRIVED

    resp = client.post(
        "/api/v1/jobs/120723/status",
        json={"action_id": "act-004", "status": "failed", "timestamp": "2026-03-25T12:00:00Z"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422
