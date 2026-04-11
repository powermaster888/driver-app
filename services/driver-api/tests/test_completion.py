from unittest.mock import patch

MOCK_PICKING_ARRIVED = {
    "id": 120723, "name": "DO-26-09394", "origin": "SO-26-10732", "state": "assigned",
    "partner_id": [151221, "陳生"], "scheduled_date": "2026-03-25 10:03:36",
    "sale_id": [124482, "SO-26-10732"], "x_studio_shipper": "耀",
    "x_studio_do_note": False, "note": False,
    "x_studio_actual_delivery_date": False, "x_studio_hapo": False,
    "x_studio_account_no": "H44501", "x_studio_driver_status": "arrived",
    "picking_type_id": [2, "HQ: Delivery Orders"], "move_ids": [317020],
}


@patch("app.routers.status.odoo")
def test_completion_status_empty(mock_odoo, client, seeded_db, auth_token):
    """No actions submitted yet — nothing is ready."""
    mock_odoo.get_job_detail.return_value = MOCK_PICKING_ARRIVED
    mock_odoo.resolve_collection.return_value = (True, "cash", 3985.0)

    resp = client.get(
        "/api/v1/jobs/120723/completion/comp-001",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["completion_id"] == "comp-001"
    assert data["has_pod"] is False
    assert data["has_cash"] is False
    assert data["has_status"] is False
    assert data["collection_required"] is True
    assert data["ready"] is False


@patch("app.routers.status.odoo")
def test_completion_status_with_pod(mock_odoo, client, seeded_db, auth_token, db):
    """After POD is submitted, has_pod should be True."""
    from app.models import Action
    import json

    action = Action(
        action_id="pod-001",
        driver_id=1,
        job_id=120723,
        action_type="proof_of_delivery",
        payload="{}",
        result=json.dumps({"photos_synced": 1}),
        completion_id="comp-002",
    )
    db.add(action)
    db.commit()

    mock_odoo.get_job_detail.return_value = MOCK_PICKING_ARRIVED
    mock_odoo.resolve_collection.return_value = (False, None, None)

    resp = client.get(
        "/api/v1/jobs/120723/completion/comp-002",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_pod"] is True
    assert data["collection_required"] is False
    assert data["ready"] is True


@patch("app.routers.status.odoo")
def test_completion_status_cod_needs_cash(mock_odoo, client, seeded_db, auth_token, db):
    """COD job with POD but no cash — not ready."""
    from app.models import Action
    import json

    action = Action(
        action_id="pod-003",
        driver_id=1,
        job_id=120723,
        action_type="proof_of_delivery",
        payload="{}",
        result=json.dumps({"photos_synced": 1}),
        completion_id="comp-003",
    )
    db.add(action)
    db.commit()

    mock_odoo.get_job_detail.return_value = MOCK_PICKING_ARRIVED
    mock_odoo.resolve_collection.return_value = (True, "cash", 3985.0)

    resp = client.get(
        "/api/v1/jobs/120723/completion/comp-003",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_pod"] is True
    assert data["has_cash"] is False
    assert data["collection_required"] is True
    assert data["ready"] is False
