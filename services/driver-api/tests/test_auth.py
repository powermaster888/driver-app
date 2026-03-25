def test_login_success(client, seeded_db):
    resp = client.post("/api/v1/auth/login", json={"phone": "+85200000001", "pin": "1234"})
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["driver"]["name"] == "耀"


def test_login_wrong_pin(client, seeded_db):
    resp = client.post("/api/v1/auth/login", json={"phone": "+85200000001", "pin": "9999"})
    assert resp.status_code == 401
    assert resp.json()["detail"]["error"] == "invalid_credentials"


def test_login_unknown_phone(client, seeded_db):
    resp = client.post("/api/v1/auth/login", json={"phone": "+85299999999", "pin": "1234"})
    assert resp.status_code == 401


def test_protected_endpoint_no_token(client):
    resp = client.get("/api/v1/me/jobs?scope=today")
    assert resp.status_code in (401, 403)


def test_protected_endpoint_with_token(client, seeded_db, auth_token):
    resp = client.get(
        "/api/v1/me/jobs?scope=today",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
