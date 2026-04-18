import pytest
from fastapi.testclient import TestClient

TEST_USER = {
    "vardas": "Testas",
    "pavarde": "Testavicius",
    "el_pastas": "test.auth@viko.lt",
    "slaptazodis": "Slaptas123!",
    "telefono_nr": "+37061234567",
    "pareigos": "Testuotojas",
    "atlyginimas": 1000,
    "isidarbinimo_data": "2024-01-01"
}


@pytest.fixture(scope="module")
def create_test_user(client: TestClient):
    resp = client.post("/api/v1/register", json=TEST_USER)
    assert resp.status_code in (200, 400)
    yield


def test_register_new_user(client):
    data = TEST_USER.copy()
    import time
    unique_email = f"unikalus_{int(time.time())}@viko.lt"
    data["el_pastas"] = unique_email
    resp = client.post("/api/v1/register", json=data)
    assert resp.status_code == 200


def test_register_duplicate_user(client, create_test_user):
    resp = client.post("/api/v1/register", json=TEST_USER)
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Employee with this email already exists"


def test_login_success(client, create_test_user):
    resp = client.post("/api/v1/login", json={
        "el_pastas": TEST_USER["el_pastas"],
        "slaptazodis": TEST_USER["slaptazodis"]
    })
    assert resp.status_code == 200
    res_json = resp.json()
    assert "access_token" in res_json
    assert len(res_json["access_token"]) > 10


def test_login_wrong_password(client):
    resp = client.post("/api/v1/login", json={
        "el_pastas": TEST_USER["el_pastas"],
        "slaptazodis": "netinkamasSlaptazodis"
    })
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid login credentials"


def test_login_nonexistent_user(client):
    resp = client.post("/api/v1/login", json={
        "el_pastas": "nesamas@viko.lt",
        "slaptazodis": "betkas"
    })
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid login credentials"


def test_me_endpoint_success(client, create_test_user):
    # Pirma prisijungiame
    resp = client.post("/api/v1/login", json={
        "el_pastas": TEST_USER["el_pastas"],
        "slaptazodis": TEST_USER["slaptazodis"]
    })
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/me", headers=headers)
    assert resp.status_code == 200
    profile = resp.json()
    assert profile["el_pastas"] == TEST_USER["el_pastas"]


def test_me_endpoint_unauthorized(client):
    resp = client.get("/api/v1/me")
    assert resp.status_code == 403 or resp.status_code == 401


def test_change_password_success(client, create_test_user):
    resp = client.post("/api/v1/login", json={
        "el_pastas": TEST_USER["el_pastas"],
        "slaptazodis": TEST_USER["slaptazodis"]
    })
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    new_pw = "NaujasSlaptazodis123!"

    resp = client.post("/api/v1/change-password", json={
        "senas_slaptazodis": TEST_USER["slaptazodis"],
        "naujas_slaptazodis": new_pw
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["message"] == "Password updated successfully"

    resp = client.post("/api/v1/login", json={
        "el_pastas": TEST_USER["el_pastas"],
        "slaptazodis": new_pw
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()

    resp = client.post("/api/v1/change-password", json={
        "senas_slaptazodis": new_pw,
        "naujas_slaptazodis": TEST_USER["slaptazodis"]
    }, headers={"Authorization": f"Bearer {resp.json()['access_token']}"})


def test_change_password_wrong_old_pw(client, create_test_user):
    resp = client.post("/api/v1/login", json={
        "el_pastas": TEST_USER["el_pastas"],
        "slaptazodis": TEST_USER["slaptazodis"]
    })
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post("/api/v1/change-password", json={
        "senas_slaptazodis": "blogas123",
        "naujas_slaptazodis": "NaujasSlaptazodis456!"
    }, headers=headers)
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Wrong current password"


def test_logout(client):
    resp = client.post("/api/v1/logout")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Successfully logged out"
