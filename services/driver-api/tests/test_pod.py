import io
from unittest.mock import patch


def _upload(client, auth_token):
    file_data = io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 100)
    resp = client.post(
        "/api/v1/uploads",
        files={"file": ("test.jpg", file_data, "image/jpeg")},
        data={"type": "photo"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    return resp.json()["upload_id"]


@patch("app.routers.pod.odoo")
def test_submit_pod(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = {"id": 100, "x_studio_shipper": "\u8000"}
    upload_id = _upload(client, auth_token)
    resp = client.post(
        "/api/v1/jobs/100/proof-of-delivery",
        json={
            "action_id": "pod-1",
            "photo_upload_ids": [upload_id],
            "note": "Left at door",
            "timestamp": "2026-03-25T09:25:00Z",
        },
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["photos_synced"] == 1


def test_pod_no_photos(client, seeded_db, auth_token):
    resp = client.post(
        "/api/v1/jobs/100/proof-of-delivery",
        json={
            "action_id": "pod-2",
            "photo_upload_ids": [],
            "timestamp": "2026-03-25T09:25:00Z",
        },
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422


@patch("app.routers.pod.odoo")
def test_pod_not_found(mock_odoo, client, seeded_db, auth_token):
    mock_odoo.get_job_detail.return_value = None
    upload_id = _upload(client, auth_token)
    resp = client.post(
        "/api/v1/jobs/999/proof-of-delivery",
        json={
            "action_id": "pod-3",
            "photo_upload_ids": [upload_id],
            "timestamp": "2026-03-25T09:25:00Z",
        },
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 404
    assert resp.json()["error"] == "not_found"
