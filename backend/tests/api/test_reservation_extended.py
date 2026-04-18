import pytest
import uuid


def unique_email():
    return f"{uuid.uuid4().hex[:8]}@test.lt"


def unique_car_data():
    return {
        "marke": "Honda", "modelis": "Jazz", "metai": 2021,
        "numeris": f"V{uuid.uuid4().hex[:6].upper()}",
        "vin_kodas": uuid.uuid4().hex[:17].upper(),
        "spalva": "Pilka", "kebulo_tipas": "Hečbekas",
        "pavarų_deze": "mechaninė", "variklio_turis": 1.3,
        "galia_kw": 75, "kuro_tipas": "benzinas",
        "rida": 5000, "sedimos_vietos": 5,
        "klimato_kontrole": False, "navigacija": False,
        "kaina_parai": 40.0, "automobilio_statusas": "laisvas",
        "technikines_galiojimas": "2026-12-31",
        "dabartine_vieta_id": 1, "pastabos": None,
    }


@pytest.fixture(scope="module", autouse=True)
def ensure_location(db_session):
    from app.models import Location
    vieta = db_session.query(Location).filter_by(vietos_id=1).first()
    if not vieta:
        vieta = Location(vietos_id=1, pavadinimas="Testo vieta", adresas="Test g. 1", miestas="Vilnius")
        db_session.add(vieta)
        db_session.commit()


@pytest.fixture(scope="module")
def res_dependencies(client, auth_headers):
    cl_resp = client.post("/api/v1/clients/", json={
        "vardas": "Rezervuotojas", "pavarde": "Testinis",
        "el_pastas": unique_email(), "telefono_nr": "+37060000077",
        "gimimo_data": "1988-03-10", "bonus_taskai": 0,
    }, headers=auth_headers)
    assert cl_resp.status_code == 200, cl_resp.json()
    kliento_id = cl_resp.json()["kliento_id"]

    car_resp = client.post("/api/v1/cars/", json=unique_car_data(), headers=auth_headers)
    assert car_resp.status_code == 200, car_resp.json()
    automobilio_id = car_resp.json()["automobilio_id"]

    yield kliento_id, automobilio_id

    client.delete(f"/api/v1/clients/{kliento_id}", headers=auth_headers)
    client.delete(f"/api/v1/cars/{automobilio_id}", headers=auth_headers)


@pytest.fixture()
def created_reservation(client, auth_headers, res_dependencies):
    kliento_id, automobilio_id = res_dependencies
    resp = client.post("/api/v1/reservations/", json={
        "kliento_id": kliento_id,
        "automobilio_id": automobilio_id,
        "rezervacijos_pradzia": "2030-07-01",
        "rezervacijos_pabaiga": "2030-07-05",
        "busena": "laukia",
    }, headers=auth_headers)
    assert resp.status_code == 200, resp.json()
    rid = resp.json()["rezervacijos_id"]
    yield rid
    client.delete(f"/api/v1/reservations/{rid}", headers=auth_headers)


# ================================================================
# 404 atvejai
# ================================================================

def test_get_reservation_not_found(client, auth_headers):
    resp = client.get("/api/v1/reservations/999999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Reservation not found"


def test_update_reservation_not_found(client, auth_headers):
    resp = client.put(
        "/api/v1/reservations/999999",
        json={"busena": "patvirtinta"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_delete_reservation_not_found(client, auth_headers):
    resp = client.delete("/api/v1/reservations/999999", headers=auth_headers)
    assert resp.status_code == 404


# ================================================================
# Statuso atnaujinimas
# ================================================================

def test_update_reservation_busena(client, auth_headers, created_reservation):
    resp = client.put(
        f"/api/v1/reservations/{created_reservation}",
        json={"busena": "patvirtinta"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["busena"] == "patvirtinta"


def test_update_reservation_invalid_busena(client, auth_headers, created_reservation):
    resp = client.put(
        f"/api/v1/reservations/{created_reservation}",
        json={"busena": "neteisinga"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


# ================================================================
# Kainos pasiūlymas (quote)
# ================================================================

def test_quote_basic(client, auth_headers, res_dependencies):
    _, automobilio_id = res_dependencies
    resp = client.get(
        f"/api/v1/reservations/quote?car_id={automobilio_id}&date_from=2030-08-01&date_to=2030-08-05",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["days"] == 4
    assert data["base_total"] == pytest.approx(4 * 40.0)
    assert data["payable_total"] <= data["base_total"]


def test_quote_with_discount_code(client, auth_headers, res_dependencies):
    _, automobilio_id = res_dependencies
    resp = client.get(
        f"/api/v1/reservations/quote?car_id={automobilio_id}&date_from=2030-08-01&date_to=2030-08-05&discount=WELCOME10",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["discount_total_percent"] == pytest.approx(10.0)


def test_quote_invalid_range(client, auth_headers, res_dependencies):
    _, automobilio_id = res_dependencies
    resp = client.get(
        f"/api/v1/reservations/quote?car_id={automobilio_id}&date_from=2030-08-10&date_to=2030-08-01",
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_quote_car_not_found(client, auth_headers):
    resp = client.get(
        "/api/v1/reservations/quote?car_id=999999&date_from=2030-08-01&date_to=2030-08-05",
        headers=auth_headers,
    )
    assert resp.status_code == 404
