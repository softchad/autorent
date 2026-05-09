import pytest

CLIENT_SAMPLE = {
    "vardas": "Testas",
    "pavarde": "Kliūzas",
    "el_pastas": "client.test@viko.lt",
    "telefono_nr": "+37060000000",
    "gimimo_data": "1995-01-01",
    "registracijos_data": "2024-06-02T00:00:00",
    "bonus_taskai": 0,
}


@pytest.fixture(scope="module")
def created_client_id(client, auth_headers):
    resp = client.post("/api/v1/clients/", json=CLIENT_SAMPLE, headers=auth_headers)
    assert resp.status_code == 200, resp.json()
    client_obj = resp.json()
    yield client_obj["kliento_id"]
    client.delete(f"/api/v1/clients/{client_obj['kliento_id']}", headers=auth_headers)


def test_create_client(client, auth_headers):
    data = CLIENT_SAMPLE.copy()
    data["el_pastas"] = "client.unique@viko.lt"
    resp = client.post("/api/v1/clients/", json=data, headers=auth_headers)
    assert resp.status_code == 200
    obj = resp.json()
    assert obj["el_pastas"] == data["el_pastas"]
    assert "links" in obj
    client.delete(f"/api/v1/clients/{obj['kliento_id']}", headers=auth_headers)


def test_create_client_missing_required(client, auth_headers):
    data = CLIENT_SAMPLE.copy()
    data.pop("el_pastas")
    resp = client.post("/api/v1/clients/", json=data, headers=auth_headers)
    assert resp.status_code in (400, 422)


def test_get_all_clients(client, created_client_id, auth_headers):
    resp = client.get("/api/v1/clients/", headers=auth_headers)
    assert resp.status_code == 200
    clients = resp.json()
    assert isinstance(clients, list)
    assert any(c["kliento_id"] == created_client_id for c in clients)
    assert all("links" in c for c in clients)


def test_get_client_by_id(client, created_client_id, auth_headers):
    resp = client.get(f"/api/v1/clients/{created_client_id}", headers=auth_headers)
    assert resp.status_code == 200
    cl = resp.json()
    assert cl["kliento_id"] == created_client_id
    assert "links" in cl
    assert cl["vardas"] == CLIENT_SAMPLE["vardas"]


def test_get_client_not_found(client, auth_headers):
    resp = client.get("/api/v1/clients/999999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Client not found"


def test_delete_client(client, auth_headers):
    data = CLIENT_SAMPLE.copy()
    data["el_pastas"] = "client.delete@viko.lt"
    resp = client.post("/api/v1/clients/", json=data, headers=auth_headers)
    assert resp.status_code == 200
    cid = resp.json()["kliento_id"]

    resp = client.delete(f"/api/v1/clients/{cid}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    resp = client.get(f"/api/v1/clients/{cid}", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_client_not_found(client, auth_headers):
    resp = client.delete("/api/v1/clients/999999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Client not found"
