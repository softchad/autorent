import pytest


@pytest.fixture
def ensure_test_client(client, auth_headers):
    resp = client.get("/api/v1/clients/", headers=auth_headers)
    klientai = resp.json() if isinstance(resp.json(), list) else []

    if not klientai:
        resp = client.post(
            "/api/v1/clients/",
            json={
                "vardas": "Test", "pavarde": "User",
                "el_pastas": "support_client@example.com",
                "telefono_nr": "+37060000000", "slaptazodis": "Support123!",
                "gimimo_data": "1990-01-01", "registracijos_data": "2024-06-01",
                "bonus_taskai": 0,
            },
            headers=auth_headers,
        )
        assert resp.status_code in [200, 201], resp.json()
        klientai = [resp.json()]

    return klientai


@pytest.fixture
def ensure_test_employee(client, auth_headers):
    resp = client.get("/api/v1/employees/", headers=auth_headers)
    darbuotojai = resp.json() if isinstance(resp.json(), list) else []

    if not darbuotojai:
        resp = client.post(
            "/api/v1/employees/",
            json={
                "vardas": "Test", "pavarde": "Darbuotojas",
                "el_pastas": "testemployee_support@example.com",
                "telefono_nr": "+37061111111", "pareigos": "Emplo",
                "atlyginimas": 1000, "isidarbinimo_data": "2020-01-01",
                "slaptazodis": "Testas123!",
            },
            headers=auth_headers,
        )
        assert resp.status_code in [200, 201], resp.json()
        darbuotojai = [resp.json()]

    return darbuotojai


@pytest.fixture
def valid_ids(ensure_test_client, ensure_test_employee):
    return {
        "kliento_id": ensure_test_client[0]["kliento_id"],
        "darbuotojo_id": ensure_test_employee[0]["darbuotojo_id"],
    }


@pytest.fixture
def support_sample(valid_ids):
    return {
        "kliento_id": valid_ids["kliento_id"],
        "darbuotojo_id": valid_ids["darbuotojo_id"],
        "tema": "Testavimo klausimas",
        "pranesimas": "Testas",
    }


def test_create_support(client, auth_headers, support_sample):
    resp = client.post("/api/v1/support/", json=support_sample, headers=auth_headers)
    assert resp.status_code == 200, resp.json()
    data = resp.json()
    assert data["tema"] == support_sample["tema"]
    assert "links" in data


def test_get_all_supports(client, auth_headers):
    resp = client.get("/api/v1/support/", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    if body:
        assert "links" in body[0]


def test_get_support_by_id(client, auth_headers, valid_ids):
    support = {
        "kliento_id": valid_ids["kliento_id"],
        "darbuotojo_id": valid_ids["darbuotojo_id"],
        "tema": "GET testas",
        "pranesimas": "GET pagal id",
    }
    resp = client.post("/api/v1/support/", json=support, headers=auth_headers)
    assert resp.status_code == 200
    sup_id = resp.json()["uzklausos_id"]

    resp2 = client.get(f"/api/v1/support/{sup_id}", headers=auth_headers)
    assert resp2.status_code == 200
    data = resp2.json()
    assert data["uzklausos_id"] == sup_id
    assert data["tema"] == "GET testas"
    assert "links" in data


def test_get_support_not_found(client, auth_headers):
    resp = client.get("/api/v1/support/9999999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Support request not found"


def test_answer_to_support(client, auth_headers, valid_ids):
    support = {
        "kliento_id": valid_ids["kliento_id"],
        "darbuotojo_id": valid_ids["darbuotojo_id"],
        "tema": "Atsakymo testas",
        "pranesimas": "Ar veikia PATCH?",
    }
    resp = client.post("/api/v1/support/", json=support, headers=auth_headers)
    assert resp.status_code == 200
    sup_id = resp.json()["uzklausos_id"]

    answer = {"atsakymas": "Taip, veikia.", "darbuotojo_id": valid_ids["darbuotojo_id"]}
    resp2 = client.patch(f"/api/v1/support/{sup_id}", json=answer, headers=auth_headers)
    assert resp2.status_code == 200
    data = resp2.json()
    assert data["atsakymas"] == "Taip, veikia."
    assert "links" in data


def test_answer_to_support_not_found(client, auth_headers, valid_ids):
    answer = {"atsakymas": "Test", "darbuotojo_id": valid_ids["darbuotojo_id"]}
    resp = client.patch("/api/v1/support/9999999", json=answer, headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Support request not found"


def test_get_unanswered_supports(client, auth_headers):
    resp = client.get("/api/v1/support/unanswered", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    if body:
        assert "links" in body[0]
