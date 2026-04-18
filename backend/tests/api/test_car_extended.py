import pytest
import uuid


CAR_BASE = {
    "marke": "Toyota", "modelis": "Corolla", "metai": 2022,
    "spalva": "Balta", "kebulo_tipas": "Sedanas",
    "pavarų_deze": "automatinė", "variklio_turis": 1.8,
    "galia_kw": 103, "kuro_tipas": "benzinas",
    "rida": 10000, "sedimos_vietos": 5,
    "klimato_kontrole": True, "navigacija": False,
    "kaina_parai": 50.0, "automobilio_statusas": "laisvas",
    "technikines_galiojimas": "2026-12-31",
    "dabartine_vieta_id": 1, "pastabos": None,
}


def unique_car():
    return {**CAR_BASE,
            "numeris": f"V{uuid.uuid4().hex[:6].upper()}",
            "vin_kodas": uuid.uuid4().hex[:17].upper()}


@pytest.fixture(scope="module", autouse=True)
def ensure_location(db_session):
    from app.models import Location
    vieta = db_session.query(Location).filter_by(vietos_id=1).first()
    if not vieta:
        vieta = Location(vietos_id=1, pavadinimas="Testo vieta", adresas="Test g. 1", miestas="Vilnius")
        db_session.add(vieta)
        db_session.commit()


@pytest.fixture(scope="module")
def car_id(client, auth_headers):
    resp = client.post("/api/v1/cars/", json=unique_car(), headers=auth_headers)
    assert resp.status_code == 200, resp.json()
    cid = resp.json()["automobilio_id"]
    yield cid
    client.delete(f"/api/v1/cars/{cid}", headers=auth_headers)


# ================================================================
# Paieška
# ================================================================

def test_search_by_marke(client, car_id, auth_headers):
    resp = client.get("/api/v1/cars/search?marke=Toyota", headers=auth_headers)
    assert resp.status_code == 200
    cars = resp.json()
    assert any(c["automobilio_id"] == car_id for c in cars)
    assert all(c["marke"] == "Toyota" for c in cars)


def test_search_by_kuro_tipas(client, car_id, auth_headers):
    resp = client.get("/api/v1/cars/search?kuro_tipas=benzinas", headers=auth_headers)
    assert resp.status_code == 200
    cars = resp.json()
    assert any(c["automobilio_id"] == car_id for c in cars)


def test_search_no_match(client, auth_headers):
    resp = client.get("/api/v1/cars/search?marke=Niekada_neegzistavo", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_search_by_metai(client, car_id, auth_headers):
    resp = client.get("/api/v1/cars/search?metai=2022", headers=auth_headers)
    assert resp.status_code == 200
    cars = resp.json()
    assert any(c["automobilio_id"] == car_id for c in cars)


# ================================================================
# Laisvi automobiliai
# ================================================================

def test_available_cars_valid_range(client, auth_headers):
    resp = client.get(
        "/api/v1/cars/available?date_from=2030-01-01&date_to=2030-01-05",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_available_cars_invalid_range(client, auth_headers):
    resp = client.get(
        "/api/v1/cars/available?date_from=2030-01-05&date_to=2030-01-01",
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_available_cars_same_day(client, auth_headers):
    resp = client.get(
        "/api/v1/cars/available?date_from=2030-01-01&date_to=2030-01-01",
        headers=auth_headers,
    )
    assert resp.status_code == 400


# ================================================================
# Utilizacija
# ================================================================

def test_utilization_returns_list(client, auth_headers):
    resp = client.get(
        "/api/v1/cars/utilization?date_from=2025-01-01&date_to=2025-12-31",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert all("car_id" in row and "utilization_pct" in row for row in data)


def test_utilization_invalid_range(client, auth_headers):
    resp = client.get(
        "/api/v1/cars/utilization?date_from=2025-12-31&date_to=2025-01-01",
        headers=auth_headers,
    )
    assert resp.status_code == 400


# ================================================================
# Statuso atnaujinimas
# ================================================================

def test_update_status_valid(client, car_id, auth_headers):
    resp = client.patch(
        f"/api/v1/cars/{car_id}/status",
        json={"status": "servise"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["automobilio_statusas"] == "servise"

    # Grąžinti pradinį statusą
    client.patch(
        f"/api/v1/cars/{car_id}/status",
        json={"status": "laisvas"},
        headers=auth_headers,
    )


def test_update_status_not_found(client, auth_headers):
    resp = client.patch(
        "/api/v1/cars/999999/status",
        json={"status": "laisvas"},
        headers=auth_headers,
    )
    assert resp.status_code == 404
