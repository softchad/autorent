import pytest
import uuid


def unique_email():
    return f"{uuid.uuid4().hex[:8]}@test.lt"


CLIENT_BASE = {
    "vardas": "Tomas",
    "pavarde": "Testavičius",
    "telefono_nr": "+37060000099",
    "gimimo_data": "1990-06-15",
    "bonus_taskai": 0,
}


@pytest.fixture(scope="module")
def client_id(client, auth_headers):
    data = {**CLIENT_BASE, "el_pastas": unique_email()}
    resp = client.post("/api/v1/clients/", json=data, headers=auth_headers)
    assert resp.status_code == 200, resp.json()
    cid = resp.json()["kliento_id"]
    yield cid
    client.delete(f"/api/v1/clients/{cid}", headers=auth_headers)


# ================================================================
# Kliento atnaujinimas
# ================================================================

def test_update_client_vardas(client, client_id, auth_headers):
    resp = client.put(
        f"/api/v1/clients/{client_id}",
        json={"vardas": "Atnaujintas"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["vardas"] == "Atnaujintas"
    assert "links" in resp.json()


def test_update_client_bonus_taskai(client, client_id, auth_headers):
    resp = client.put(
        f"/api/v1/clients/{client_id}",
        json={"bonus_taskai": 150},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["bonus_taskai"] == 150


def test_update_client_not_found(client, auth_headers):
    resp = client.put(
        "/api/v1/clients/999999",
        json={"vardas": "Niekas"},
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Client not found"


def test_update_client_invalid_bonus(client, client_id, auth_headers):
    resp = client.put(
        f"/api/v1/clients/{client_id}",
        json={"bonus_taskai": -10},
        headers=auth_headers,
    )
    assert resp.status_code == 422


# ================================================================
# Kliento užsakymai (per orders endpointą)
# ================================================================

def test_client_id_persists_after_update(client, client_id, auth_headers):
    resp = client.get(f"/api/v1/clients/{client_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["kliento_id"] == client_id
