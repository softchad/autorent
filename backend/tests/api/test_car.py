import pytest
import uuid


@pytest.fixture(scope="module")
def ensure_place_exists(db_session):
    from app.models import Location

    vieta = db_session.query(Location).filter_by(vietos_id=1).first()
    if not vieta:
        vieta = Location(
            vietos_id=1,
            pavadinimas="Testo vieta",
            adresas="Test gatvė 1, Miestas",
            miestas="Vilnius",
        )
        db_session.add(vieta)
        db_session.commit()
    return vieta


CAR_SAMPLE = {
    "marke": "Toyota",
    "modelis": "Corolla",
    "metai": 2022,
    "numeris": "TEST123",
    "vin_kodas": "JH4TB2H26CC000000",
    "spalva": "Mėlyna",
    "kebulo_tipas": "Sedanas",
    "pavarų_deze": "automatinė",
    "variklio_turis": 1.8,
    "galia_kw": 103,
    "kuro_tipas": "benzinas",
    "rida": 10000,
    "sedimos_vietos": 5,
    "klimato_kontrole": True,
    "navigacija": False,
    "kaina_parai": 50.0,
    "automobilio_statusas": "laisvas",
    "technikines_galiojimas": "2025-12-31",
    "dabartine_vieta_id": 1,
    "pastabos": "Test car",
}


@pytest.fixture(scope="module")
def created_car_id(client, ensure_place_exists, auth_headers):
    car_data = CAR_SAMPLE.copy()
    car_data["numeris"] = f"TEST{uuid.uuid4().hex[:6].upper()}"
    car_data["vin_kodas"] = (f"JH4TB2H26{uuid.uuid4().hex[:8].upper()}")[:17]

    resp = client.post("/api/v1/cars/", json=car_data, headers=auth_headers)
    assert resp.status_code == 200, resp.json()

    car_id = resp.json()["automobilio_id"]
    yield car_id
    client.delete(f"/api/v1/cars/{car_id}", headers=auth_headers)


def test_create_car(client, ensure_place_exists, auth_headers):
    car_data = CAR_SAMPLE.copy()
    car_data["numeris"] = f"TEST{uuid.uuid4().hex[:6].upper()}"
    car_data["vin_kodas"] = (f"JH4TB2H26C{uuid.uuid4().hex[:7].upper()}")[:17]

    resp = client.post("/api/v1/cars/", json=car_data, headers=auth_headers)
    assert resp.status_code == 200, resp.json()

    car_id = resp.json()["automobilio_id"]
    client.delete(f"/api/v1/cars/{car_id}", headers=auth_headers)


def test_get_all_cars(client, created_car_id, auth_headers):
    resp = client.get("/api/v1/cars/", headers=auth_headers)
    assert resp.status_code == 200
    cars = resp.json()
    assert isinstance(cars, list)
    assert any(c["automobilio_id"] == created_car_id for c in cars)
    assert all("links" in c for c in cars)


def test_get_car_by_id(client, created_car_id, auth_headers):
    resp = client.get(f"/api/v1/cars/{created_car_id}", headers=auth_headers)
    assert resp.status_code == 200
    car = resp.json()
    assert car["automobilio_id"] == created_car_id
    assert "links" in car
    assert car["marke"] == CAR_SAMPLE["marke"]


def test_get_car_not_found(client, auth_headers):
    resp = client.get("/api/v1/cars/999999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Car not found"


def test_update_car(client, created_car_id, auth_headers):
    update_data = {"marke": "Honda", "modelis": "Civic"}
    resp = client.put(f"/api/v1/cars/{created_car_id}", json=update_data, headers=auth_headers)
    assert resp.status_code == 200
    car = resp.json()
    assert car["marke"] == "Honda"
    assert car["modelis"] == "Civic"
    assert "links" in car


def test_update_car_not_found(client, auth_headers):
    resp = client.put("/api/v1/cars/999999", json={"marke": "Fake"}, headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Car not found"


def test_update_car_status_not_found(client, auth_headers):
    resp = client.patch(
        "/api/v1/cars/999999/status",
        json={"status": "laisvas"},
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Car not found"


def test_delete_car(client, ensure_place_exists, auth_headers):
    data = CAR_SAMPLE.copy()
    data["numeris"] = "DELETE123"
    data["vin_kodas"] = "JH4TB2H26CC000777"

    create_resp = client.post("/api/v1/cars/", json=data, headers=auth_headers)
    assert create_resp.status_code == 200
    car_id = create_resp.json()["automobilio_id"]

    delete_resp = client.delete(f"/api/v1/cars/{car_id}", headers=auth_headers)
    assert delete_resp.status_code == 200
    assert delete_resp.json()["message"] == "Car deleted successfully"

    get_resp = client.get(f"/api/v1/cars/{car_id}", headers=auth_headers)
    assert get_resp.status_code == 404


def test_delete_car_not_found(client, auth_headers):
    resp = client.delete("/api/v1/cars/999999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Car not found"
