import pytest
from fastapi.testclient import TestClient
from app.main import app
from uuid import uuid4
from app.api.deps import get_db
from app.models.location import Location

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def ensure_pristatymo_vieta():
    db = next(get_db())
    vieta = db.query(Location).filter_by(vietos_id=1).first()
    if not vieta:
        vieta = Location(
            vietos_id=1,
            pavadinimas="Testo vieta",
            adresas="Test gatvė 1",
            miestas="Vilnius",
        )
        db.add(vieta)
        db.commit()
    yield vieta


@pytest.fixture
def example_reservation_data(auth_headers):
    vietos_id = 1

    cl_resp = client.post(
        "/api/v1/clients/",
        json={
            "vardas": "Testas",
            "pavarde": "Rezervavicius",
            "el_pastas": f"rez{uuid4().hex[:8]}@test.lt",
            "telefono_nr": "+37060000011",
            "slaptazodis": "SlaptasRez123!",
            "gimimo_data": "2000-01-01",
            "registracijos_data": "2024-06-01",
            "bonus_taskai": 0,
        },
        headers=auth_headers,
    )
    cl_json = cl_resp.json()
    kliento_id = cl_json.get("kliento_id") or cl_json.get("id")
    assert kliento_id is not None, f"Nėra kliento_id! resp: {cl_json}"

    car_resp = client.post(
        "/api/v1/cars/",
        json={
            "marke": "Toyota",
            "modelis": "Aygo",
            "metai": 2022,
            "numeris": f"RES{uuid4().hex[:3].upper()}",
            "vin_kodas": uuid4().hex[:16].upper(),
            "spalva": "Raudona",
            "kebulo_tipas": "Hečbekas",
            "pavarų_deze": "mechaninė",
            "variklio_turis": 1.0,
            "galia_kw": 53,
            "kuro_tipas": "benzinas",
            "rida": 10000,
            "sedimos_vietos": 4,
            "klimato_kontrole": False,
            "navigacija": False,
            "kaina_parai": 29.99,
            "automobilio_statusas": "laisvas",
            "technikines_galiojimas": "2025-12-31",
            "dabartine_vieta_id": vietos_id,
            "pastabos": "Rez test",
        },
        headers=auth_headers,
    )
    car_json = car_resp.json()
    automobilio_id = car_json.get("automobilio_id") or car_json.get("id")
    assert automobilio_id is not None, f"Nėra automobilio_id! resp: {car_json}"

    return {
        "kliento_id": kliento_id,
        "automobilio_id": automobilio_id,
        "rezervacijos_pradzia": "2024-06-01",
        "rezervacijos_pabaiga": "2024-06-03",
        "busena": "laukia",
    }


def test_create_reservation(example_reservation_data, auth_headers):
    response = client.post(
        "/api/v1/reservations/",
        json=example_reservation_data,
        headers=auth_headers,
    )
    assert response.status_code in [200, 201], response.json()
    data = response.json()
    assert "rezervacijos_id" in data
    assert data["kliento_id"] == example_reservation_data["kliento_id"]
    assert data["automobilio_id"] == example_reservation_data["automobilio_id"]


def test_get_all_reservations(auth_headers):
    response = client.get("/api/v1/reservations/", headers=auth_headers)
    assert response.status_code == 200, response.json()
    assert isinstance(response.json(), list)


def test_get_reservation_by_id(example_reservation_data, auth_headers):
    res_resp = client.post(
        "/api/v1/reservations/",
        json=example_reservation_data,
        headers=auth_headers,
    )
    assert res_resp.status_code in [200, 201], res_resp.json()
    res_id = res_resp.json()["rezervacijos_id"]

    get_resp = client.get(f"/api/v1/reservations/{res_id}", headers=auth_headers)
    assert get_resp.status_code == 200, get_resp.json()
    assert get_resp.json()["rezervacijos_id"] == res_id


def test_delete_reservation(example_reservation_data, auth_headers):
    res_resp = client.post(
        "/api/v1/reservations/",
        json=example_reservation_data,
        headers=auth_headers,
    )
    assert res_resp.status_code in [200, 201], res_resp.json()
    res_id = res_resp.json()["rezervacijos_id"]

    del_resp = client.delete(f"/api/v1/reservations/{res_id}", headers=auth_headers)
    assert del_resp.status_code in [200, 204], del_resp.json() if del_resp.content else None

    get_all = client.get("/api/v1/reservations/", headers=auth_headers).json()
    ids = [r["rezervacijos_id"] for r in get_all]
    assert res_id not in ids
