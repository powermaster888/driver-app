import io


def test_upload_photo(client, seeded_db, auth_token):
    file_data = io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 100)
    resp = client.post(
        "/api/v1/uploads",
        files={"file": ("test.jpg", file_data, "image/jpeg")},
        data={"type": "photo"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "photo"
    assert "upload_id" in data


def test_upload_too_large(client, seeded_db, auth_token):
    file_data = io.BytesIO(b"\x00" * (11 * 1024 * 1024))
    resp = client.post(
        "/api/v1/uploads",
        files={"file": ("big.jpg", file_data, "image/jpeg")},
        data={"type": "photo"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 413
    assert resp.json()["error"] == "file_too_large"


def test_upload_no_auth(client):
    file_data = io.BytesIO(b"\x00" * 10)
    resp = client.post(
        "/api/v1/uploads",
        files={"file": ("test.jpg", file_data, "image/jpeg")},
        data={"type": "photo"},
    )
    assert resp.status_code in (401, 403)


def test_upload_invalid_mime_for_photo(client, seeded_db, auth_token):
    file_data = io.BytesIO(b"\x00" * 100)
    resp = client.post(
        "/api/v1/uploads",
        files={"file": ("test.pdf", file_data, "application/pdf")},
        data={"type": "photo"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"] == "validation_error"


def test_upload_signature_must_be_png(client, seeded_db, auth_token):
    file_data = io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 100)
    resp = client.post(
        "/api/v1/uploads",
        files={"file": ("sig.jpg", file_data, "image/jpeg")},
        data={"type": "signature"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"] == "validation_error"


def test_upload_signature_png_ok(client, seeded_db, auth_token):
    file_data = io.BytesIO(b"\x89PNG" + b"\x00" * 100)
    resp = client.post(
        "/api/v1/uploads",
        files={"file": ("sig.png", file_data, "image/png")},
        data={"type": "signature"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["type"] == "signature"
