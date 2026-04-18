import pytest
import uuid


# ----------------------------------------------------------------
# Pagalbiniai duomenys
# ----------------------------------------------------------------

def unique_numeris():
    return f"V{uuid.uuid4().hex[:6].upper()}"


def unique_vin():
    return uuid.uuid4().hex[:17].upper()


VALID_CAR = {
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

VALID_CLIENT = {
    "vardas": "Testas", "pavarde": "Validuotojas",
    "el_pastas": "valid@test.lt",
    "telefono_nr": "+37060000001",
    "gimimo_data": "1990-01-01",
    "bonus_taskai": 0,
}

VALID_EMPLOYEE = {
    "vardas": "Darbuotojas", "pavarde": "Testinis",
    "el_pastas": "emp.valid@test.lt",
    "telefono_nr": "+37060000002",
    "pareigos": "Vadybininkas",
    "atlyginimas": 1500.0,
    "isidarbinimo_data": "2023-01-01",
    "slaptazodis": "Slaptas123!",
}


@pytest.fixture(scope="module", autouse=True)
def ensure_location(db_session):
    from app.models import Location
    vieta = db_session.query(Location).filter_by(vietos_id=1).first()
    if not vieta:
        vieta = Location(vietos_id=1, pavadinimas="Testo vieta", adresas="Test g. 1", miestas="Vilnius")
        db_session.add(vieta)
        db_session.commit()


# ================================================================
# Automobilio validacija
# ================================================================

def test_car_invalid_metai_too_old(client, auth_headers):
    data = {**VALID_CAR, "numeris": unique_numeris(), "vin_kodas": unique_vin(), "metai": 1800}
    resp = client.post("/api/v1/cars/", json=data, headers=auth_headers)
    assert resp.status_code == 422


def test_car_invalid_metai_future(client, auth_headers):
    data = {**VALID_CAR, "numeris": unique_numeris(), "vin_kodas": unique_vin(), "metai": 2099}
    resp = client.post("/api/v1/cars/", json=data, headers=auth_headers)
    assert resp.status_code == 422


def test_car_invalid_kaina_zero(client, auth_headers):
    data = {**VALID_CAR, "numeris": unique_numeris(), "vin_kodas": unique_vin(), "kaina_parai": 0}
    resp = client.post("/api/v1/cars/", json=data, headers=auth_headers)
    assert resp.status_code == 422


def test_car_invalid_kaina_negative(client, auth_headers):
    data = {**VALID_CAR, "numeris": unique_numeris(), "vin_kodas": unique_vin(), "kaina_parai": -10}
    resp = client.post("/api/v1/cars/", json=data, headers=auth_headers)
    assert resp.status_code == 422


def test_car_invalid_rida_negative(client, auth_headers):
    data = {**VALID_CAR, "numeris": unique_numeris(), "vin_kodas": unique_vin(), "rida": -1}
    resp = client.post("/api/v1/cars/", json=data, headers=auth_headers)
    assert resp.status_code == 422


def test_car_invalid_sedimos_vietos_too_few(client, auth_headers):
    data = {**VALID_CAR, "numeris": unique_numeris(), "vin_kodas": unique_vin(), "sedimos_vietos": 1}
    resp = client.post("/api/v1/cars/", json=data, headers=auth_headers)
    assert resp.status_code == 422


def test_car_invalid_sedimos_vietos_too_many(client, auth_headers):
    data = {**VALID_CAR, "numeris": unique_numeris(), "vin_kodas": unique_vin(), "sedimos_vietos": 10}
    resp = client.post("/api/v1/cars/", json=data, headers=auth_headers)
    assert resp.status_code == 422


def test_car_invalid_pavarų_deze(client, auth_headers):
    data = {**VALID_CAR, "numeris": unique_numeris(), "vin_kodas": unique_vin(), "pavarų_deze": "robotas"}
    resp = client.post("/api/v1/cars/", json=data, headers=auth_headers)
    assert resp.status_code == 422


def test_car_invalid_kuro_tipas(client, auth_headers):
    data = {**VALID_CAR, "numeris": unique_numeris(), "vin_kodas": unique_vin(), "kuro_tipas": "vandenilis"}
    resp = client.post("/api/v1/cars/", json=data, headers=auth_headers)
    assert resp.status_code == 422


def test_car_invalid_statusas(client, auth_headers):
    data = {**VALID_CAR, "numeris": unique_numeris(), "vin_kodas": unique_vin(), "automobilio_statusas": "parduotas"}
    resp = client.post("/api/v1/cars/", json=data, headers=auth_headers)
    assert resp.status_code == 422


def test_car_valid_passes(client, auth_headers):
    data = {**VALID_CAR, "numeris": unique_numeris(), "vin_kodas": unique_vin()}
    resp = client.post("/api/v1/cars/", json=data, headers=auth_headers)
    assert resp.status_code == 200
    client.delete(f"/api/v1/cars/{resp.json()['automobilio_id']}", headers=auth_headers)


# ================================================================
# Kliento validacija
# ================================================================

def test_client_invalid_vardas_too_short(client, auth_headers):
    data = {**VALID_CLIENT, "el_pastas": f"{uuid.uuid4().hex[:6]}@test.lt", "vardas": "A"}
    resp = client.post("/api/v1/clients/", json=data, headers=auth_headers)
    assert resp.status_code == 422


def test_client_invalid_bonus_negative(client, auth_headers):
    data = {**VALID_CLIENT, "el_pastas": f"{uuid.uuid4().hex[:6]}@test.lt", "bonus_taskai": -5}
    resp = client.post("/api/v1/clients/", json=data, headers=auth_headers)
    assert resp.status_code == 422


def test_client_invalid_email(client, auth_headers):
    data = {**VALID_CLIENT, "el_pastas": "ne-el-pastas"}
    resp = client.post("/api/v1/clients/", json=data, headers=auth_headers)
    assert resp.status_code == 422


# ================================================================
# Darbuotojo validacija
# ================================================================

def test_employee_invalid_atlyginimas_zero(client, auth_headers):
    data = {**VALID_EMPLOYEE, "el_pastas": f"{uuid.uuid4().hex[:6]}@test.lt", "atlyginimas": 0}
    resp = client.post("/api/v1/employees/", json=data, headers=auth_headers)
    assert resp.status_code == 422


def test_employee_invalid_atlyginimas_negative(client, auth_headers):
    data = {**VALID_EMPLOYEE, "el_pastas": f"{uuid.uuid4().hex[:6]}@test.lt", "atlyginimas": -100}
    resp = client.post("/api/v1/employees/", json=data, headers=auth_headers)
    assert resp.status_code == 422


def test_employee_short_password(client, auth_headers):
    data = {**VALID_EMPLOYEE, "el_pastas": f"{uuid.uuid4().hex[:6]}@test.lt", "slaptazodis": "abc"}
    resp = client.post("/api/v1/employees/", json=data, headers=auth_headers)
    assert resp.status_code == 422


# ================================================================
# Užsakymo validacija
# ================================================================

def test_order_invalid_busena(client, auth_headers):
    data = {
        "kliento_id": 1, "automobilio_id": 1, "darbuotojo_id": 1,
        "nuomos_data": "2025-01-01", "grazinimo_data": "2025-01-05",
        "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
        "bendra_kaina": 100.0, "uzsakymo_busena": "neteisinga",
        "turi_papildomas_paslaugas": False,
    }
    resp = client.post("/api/v1/orders/", json=data, headers=auth_headers)
    assert resp.status_code == 422


def test_order_grazinimo_before_nuomos(client, auth_headers):
    data = {
        "kliento_id": 1, "automobilio_id": 1, "darbuotojo_id": 1,
        "nuomos_data": "2025-01-10", "grazinimo_data": "2025-01-05",
        "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
        "bendra_kaina": 100.0, "uzsakymo_busena": "laukiama",
        "turi_papildomas_paslaugas": False,
    }
    resp = client.post("/api/v1/orders/", json=data, headers=auth_headers)
    assert resp.status_code == 422


# ================================================================
# Rezervacijos validacija
# ================================================================

def test_reservation_invalid_busena(client, auth_headers):
    data = {
        "kliento_id": 1, "automobilio_id": 1,
        "rezervacijos_pradzia": "2025-06-01",
        "rezervacijos_pabaiga": "2025-06-05",
        "busena": "neteisinga",
    }
    resp = client.post("/api/v1/reservations/", json=data, headers=auth_headers)
    assert resp.status_code == 422


def test_reservation_end_before_start(client, auth_headers):
    data = {
        "kliento_id": 1, "automobilio_id": 1,
        "rezervacijos_pradzia": "2025-06-10",
        "rezervacijos_pabaiga": "2025-06-05",
        "busena": "laukia",
    }
    resp = client.post("/api/v1/reservations/", json=data, headers=auth_headers)
    assert resp.status_code == 422
