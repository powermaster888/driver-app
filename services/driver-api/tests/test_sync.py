from unittest.mock import patch


def test_sync_status(client, seeded_db, auth_token):
    resp = client.get("/api/v1/sync/status", headers={"Authorization": f"Bearer {auth_token}"})
    assert resp.status_code == 200
    assert resp.json()["pending_actions"] == 0


@patch("app.routers.status.odoo")
def test_batch_sync(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = {"id": 100, "x_studio_driver_status": "assigned", "x_studio_shipper": "耀"}
    resp = client.post("/api/v1/sync/batch", json={
        "actions": [{
            "action_id": "batch-1", "endpoint": "/jobs/100/status", "method": "POST",
            "body": {"action_id": "batch-1", "status": "accepted", "timestamp": "2026-03-25T09:00:00Z"}
        }]
    }, headers={"Authorization": f"Bearer {auth_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["synced"] == 1
    assert data["failed"] == 0


@patch("app.routers.status.odoo")
def test_batch_sync_unsupported_endpoint(mock_odoo, client, seeded_db, auth_token):
    resp = client.post("/api/v1/sync/batch", json={
        "actions": [{
            "action_id": "batch-2", "endpoint": "/unknown/endpoint", "method": "POST",
            "body": {}
        }]
    }, headers={"Authorization": f"Bearer {auth_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["failed"] == 1
    assert data["results"][0]["error"] == "unsupported_endpoint"
