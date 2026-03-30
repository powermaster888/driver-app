from unittest.mock import patch, MagicMock

MOCK_PICKING = {
    "id": 120723, "name": "DO-26-09394", "origin": "SO-26-10732", "state": "assigned",
    "partner_id": [151221, "陳生"], "scheduled_date": "2026-03-25 10:03:36",
    "sale_id": [124482, "SO-26-10732"], "x_studio_shipper": "耀",
    "x_studio_do_note": "請打電話先", "note": False,
    "x_studio_actual_delivery_date": False, "x_studio_hapo": "網站訂單: 319602",
    "x_studio_account_no": "H44501", "x_studio_driver_status": False,
    "picking_type_id": [2, "HQ: Delivery Orders"], "move_ids": [317020, 317021],
}
MOCK_PARTNER = {"id": 151221, "display_name": "陳生", "phone": "+852 91234567", "street": "Room B03, 5/F, Ka To Factory Building", "street2": False}
MOCK_SO = {"id": 124482, "name": "SO-26-10732", "amount_total": 3985.0, "payment_term_id": [11, "貨到付款 - 現金"]}
MOCK_MOVES = [
    {"id": 317020, "product_id": [47322, "[MEKI-0038] 日本 Terumo Syringe - 3ml"], "product_uom_qty": 10, "barcode": "4987350415202"},
    {"id": 317021, "product_id": [47323, "[MEKI-0039] 日本 Terumo Syringe - 5ml"], "product_uom_qty": 10, "barcode": None},
]


@patch("app.routers.jobs.odoo")
def test_list_jobs(mock_odoo, client, auth_token):
    mock_odoo.get_driver_jobs.return_value = [MOCK_PICKING]
    mock_odoo.read.side_effect = lambda model, ids, fields: {
        "res.partner": [MOCK_PARTNER],
        "sale.order": [MOCK_SO],
    }.get(model, [])

    resp = client.get("/api/v1/me/jobs?scope=today", headers={"Authorization": f"Bearer {auth_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["jobs"]) == 1
    job = data["jobs"][0]
    assert job["job_id"] == 120723
    assert job["odoo_reference"] == "DO-26-09394"
    assert job["warehouse"] == "HQ"
    assert job["collection_required"] is True
    assert job["collection_method"] == "cash"
    assert job["expected_collection_amount"] == 3985.0
    assert job["customer_name"] == "陳生"
    assert data["fetched_at"] is not None


@patch("app.routers.jobs.odoo")
def test_get_job_detail(mock_odoo, client, auth_token):
    mock_odoo.get_job_detail.return_value = MOCK_PICKING
    mock_odoo.read.side_effect = lambda model, ids, fields: {
        "res.partner": [MOCK_PARTNER],
        "sale.order": [MOCK_SO],
    }.get(model, [])
    mock_odoo.get_move_lines.return_value = MOCK_MOVES

    resp = client.get("/api/v1/jobs/120723", headers={"Authorization": f"Bearer {auth_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["job_id"] == 120723
    assert len(data["items"]) == 2
    assert "Terumo Syringe - 3ml" in data["items"][0]["product_name"]
    assert data["items"][0]["barcode"] == "4987350415202"
    assert "Terumo Syringe - 5ml" in data["items"][1]["product_name"]
    assert data["items"][1]["barcode"] is None
    assert data["delivery_notes"] == "請打電話先"
    assert data["account_no"] == "H44501"


@patch("app.routers.jobs.odoo")
def test_get_job_not_found(mock_odoo, client, auth_token):
    mock_odoo.get_job_detail.return_value = None

    resp = client.get("/api/v1/jobs/999999", headers={"Authorization": f"Bearer {auth_token}"})
    assert resp.status_code == 404
    assert resp.json()["error"] == "not_found"


@patch("app.routers.jobs.odoo")
def test_list_jobs_invalid_scope(mock_odoo, client, auth_token):
    resp = client.get("/api/v1/me/jobs?scope=invalid", headers={"Authorization": f"Bearer {auth_token}"})
    assert resp.status_code == 422
