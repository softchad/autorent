import pytest
import uuid


# Automobilis BŪTINAI turi dabartine_vieta_id (žr. models/car.py nullable=False) - bet API neturi lokacijų KŪRIMO endpoint'o (tik getLocations skaitymui, žr. car.py), tad testams vietą reikia įterpti TIESIAI per db_session, ne per HTTP kreipinį.
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


# Bendras šablonas visiems testams - KIEKVIENAS testas PATS pakeičia "numeris"/"vin_kodas" į unikalius (uuid), kitaip antras testas sukuriantis automobilį susidurtų su TA PAČIA dublikato klaida, kurią ištestuoja test_create_car_duplicate_numeris_rejected faile gale.
CAR_SAMPLE = {
    "marke": "Toyota",
    "modelis": "Corolla",
    "metai": 2022,
    "numeris": "TEST123",
    "vin_kodas": "JH4TB2H26CC000000",
    "spalva": "Mėlyna",
    "kebulo_tipas": "Sedanas",
    "pavaru_deze": "automatinė",
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


# scope="module" - sukuriamas VIENĄ kartą ir bendrai naudojamas KELIOSE šio failo testų funkcijose (žr. test_get_all_cars/test_update_car/test_update_car_rejects_invalid_values žemiau), ne po vieną naują automobilį kiekvienam atskirai; "yield" + delete po jo - savaiminis susitvarkymas po VISŲ testų, kurie jį naudoja.
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


# Savo ATSKIRAS automobilis (ne created_car_id) - šis testas PATS ištrina, ką sukūrė, kad nepaliktų "našlaičio" įrašo kitiems testams.
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
    assert resp.json()["detail"] == "Automobilis nerastas"


@pytest.mark.parametrize("field,value", [
    ("kuro_tipas", "visiskai_neteisinga"),
    ("pavaru_deze", "lygtinė"),
    ("rida", -500),
    ("sedimos_vietos", 99),
    ("galia_kw", -10),
])
def test_update_car_rejects_invalid_values(client, created_car_id, auth_headers, field, value):
    # CarUpdate PRIEŠ šį testą neturėjo šių validatorių - bloga reikšmė įsirašytų į DB ir SULAUŽYTŲ atsakymo validaciją (CarOut), vietoj aiškaus 422 čia pat.
    resp = client.put(f"/api/v1/cars/{created_car_id}", json={field: value}, headers=auth_headers)
    assert resp.status_code == 422


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


def test_delete_car_not_found(client, auth_headers):
    resp = client.delete("/api/v1/cars/999999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Automobilis nerastas"


# PASTABA: šis testas TYČIA sudėtas PAČIAME GALE, nes jo IntegrityError/rollback kelias šio modulio bendroje transakcijoje nutrina VISŲ ANKSTESNIŲ šio failo testų duomenis (žr. analogišką pastabą test_employee.py faile) - po jo šiame faile daugiau TESTŲ NEBERAŠOMA.
def test_create_car_duplicate_numeris_rejected(client, ensure_place_exists, auth_headers):
    car_data = CAR_SAMPLE.copy()
    car_data["numeris"] = f"TEST{uuid.uuid4().hex[:6].upper()}"
    car_data["vin_kodas"] = (f"JH4TB2H26C{uuid.uuid4().hex[:7].upper()}")[:17]
    created = client.post("/api/v1/cars/", json=car_data, headers=auth_headers)
    assert created.status_code == 200, created.json()

    # Tas pats numeris, bet KITAS vin_kodas - numeris irgi UNIQUE, tad turi atmesti.
    duplicate = car_data.copy()
    duplicate["vin_kodas"] = (f"JH4TB2H26D{uuid.uuid4().hex[:7].upper()}")[:17]
    resp = client.post("/api/v1/cars/", json=duplicate, headers=auth_headers)
    assert resp.status_code == 409

# update_car lygiai tą pačią IntegrityError->409 logiką naudoja PUT kelyje (žr. car.py) - čia NEbandoma automatiniu testu dėl aukščiau paaiškintos transakcijų ribos; dar NEpatikrinta rankiniu būdu prieš tikrą MySQL DB, reikia padaryti prieš gynimą.
