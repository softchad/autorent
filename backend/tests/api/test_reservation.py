import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.models.location import Location

client = TestClient(app)


# "autouse=True" - paleidžiama AUTOMATIŠKAI prieš VISUS šio failo testus; automobiliui (dabartine_vieta_id NOT NULL) reikia egzistuojančios vietos, o API neturi vietos KŪRIMO endpoint'o, tad ji įterpiama TIESIAI per db_session.
@pytest.fixture(scope="module", autouse=True)
def ensure_pristatymo_vieta(db_session):
    vieta = db_session.query(Location).filter_by(vietos_id=1).first()
    if not vieta:
        vieta = Location(
            vietos_id=1,
            pavadinimas="Testo vieta",
            adresas="Test gatvė 1",
            miestas="Vilnius",
        )
        db_session.add(vieta)
        db_session.commit()
    yield vieta


# Sukuria NAUJĄ klientą ir automobilį kiekvienam testui (ne scope="module" - tyčia, kad create/delete testai žemiau nesikirstų dėl TO PATIES automobilio).
@pytest.fixture
def example_reservation_data(auth_headers):
    cl_resp = client.post(
        "/api/v1/clients/",
        json={
            "vardas": "Testas",
            "pavarde": "Rezervavicius",
            "el_pastas": f"rez{uuid.uuid4().hex[:8]}@test.lt",
            "telefono_nr": "+37060000011",
            "slaptazodis": "SlaptasRez123!",
            "gimimo_data": "2000-01-01",
            "registracijos_data": "2024-06-01",
        },
        headers=auth_headers,
    )
    kliento_id = cl_resp.json()["kliento_id"]

    car_resp = client.post(
        "/api/v1/cars/",
        json={
            "marke": "Toyota",
            "modelis": "Aygo",
            "metai": 2022,
            "numeris": f"RES{uuid.uuid4().hex[:3].upper()}",
            "vin_kodas": uuid.uuid4().hex[:16].upper(),
            "spalva": "Raudona",
            "kebulo_tipas": "Hečbekas",
            "pavaru_deze": "mechaninė",
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
            "dabartine_vieta_id": 1,
            "pastabos": "Rez test",
        },
        headers=auth_headers,
    )
    automobilio_id = car_resp.json()["automobilio_id"]

    return {
        "kliento_id": kliento_id,
        "automobilio_id": automobilio_id,
        "rezervacijos_pradzia": "2024-06-01",
        "rezervacijos_pabaiga": "2024-06-03",
        "busena": "laukia",
    }


# Pagrindinis "laimingas kelias" - rezervacija sukuriama su nurodytais kliento/automobilio ID.
def test_create_reservation(example_reservation_data, auth_headers):
    response = client.post(
        "/api/v1/reservations/",
        json=example_reservation_data,
        headers=auth_headers,
    )
    assert response.status_code == 200, response.json()
    data = response.json()
    assert "rezervacijos_id" in data
    assert data["kliento_id"] == example_reservation_data["kliento_id"]
    assert data["automobilio_id"] == example_reservation_data["automobilio_id"]


# Patikrina, kad sąrašas grąžina sąrašą (netikrina TURINIO - tam skirti konkretesni testai žemiau ir test_reservation_extended skyriuose).
def test_get_all_reservations(auth_headers):
    response = client.get("/api/v1/reservations/", headers=auth_headers)
    assert response.status_code == 200, response.json()
    assert isinstance(response.json(), list)


# Pilnas kūrimo-ištrynimo ciklas VIENAME teste - sukurta rezervacija realiai DINGSTA iš sąrašo po ištrynimo.
def test_delete_reservation(example_reservation_data, auth_headers):
    res_resp = client.post(
        "/api/v1/reservations/",
        json=example_reservation_data,
        headers=auth_headers,
    )
    assert res_resp.status_code == 200, res_resp.json()
    res_id = res_resp.json()["rezervacijos_id"]

    del_resp = client.delete(f"/api/v1/reservations/{res_id}", headers=auth_headers)
    assert del_resp.status_code == 200

    get_all = client.get("/api/v1/reservations/", headers=auth_headers).json()
    ids = [r["rezervacijos_id"] for r in get_all]
    assert res_id not in ids


# ================================================================
# Konflikto/statuso/404 testai - naudoja res_dependencies/created_reservation (VIENAS bendras klientas/automobilis visam skyriui, ne naujas kiekvienam testui kaip example_reservation_data aukščiau).
# ================================================================

# Grąžina UNIKALŲ el. paštą kiekvienam kvietimui - el_pastas yra UNIQUE DB lygmeniu, tad be šito testai susidurtų su "jau užregistruotas" klaida.
def unique_email():
    return f"{uuid.uuid4().hex[:8]}@test.lt"


# Grąžina pilną automobilio šabloną su UNIKALIU numeriu/VIN - naudojama res_dependencies žemiau.
def unique_car_data():
    return {
        "marke": "Honda", "modelis": "Jazz", "metai": 2021,
        "numeris": f"V{uuid.uuid4().hex[:6].upper()}",
        "vin_kodas": uuid.uuid4().hex[:17].upper(),
        "spalva": "Pilka", "kebulo_tipas": "Hečbekas",
        "pavaru_deze": "mechaninė", "variklio_turis": 1.3,
        "galia_kw": 75, "kuro_tipas": "benzinas",
        "rida": 5000, "sedimos_vietos": 5,
        "klimato_kontrole": False, "navigacija": False,
        "kaina_parai": 40.0, "automobilio_statusas": "laisvas",
        "technikines_galiojimas": "2026-12-31",
        "dabartine_vieta_id": 1, "pastabos": None,
    }


# scope="module" - VIENAS klientas ir VIENAS automobilis bendrai naudojami VISUOSE žemiau esančiuose testuose (žr. created_reservation žemiau), ne po naują kiekvienam; abu ištrinami TIK po VISŲ šio skyriaus testų.
@pytest.fixture(scope="module")
def res_dependencies(client, auth_headers):
    cl_resp = client.post("/api/v1/clients/", json={
        "vardas": "Rezervuotojas", "pavarde": "Testinis",
        "el_pastas": unique_email(), "telefono_nr": "+37060000077",
        "gimimo_data": "1988-03-10",
    }, headers=auth_headers)
    assert cl_resp.status_code == 200, cl_resp.json()
    kliento_id = cl_resp.json()["kliento_id"]

    car_resp = client.post("/api/v1/cars/", json=unique_car_data(), headers=auth_headers)
    assert car_resp.status_code == 200, car_resp.json()
    automobilio_id = car_resp.json()["automobilio_id"]

    yield kliento_id, automobilio_id

    client.delete(f"/api/v1/clients/{kliento_id}", headers=auth_headers)
    client.delete(f"/api/v1/cars/{automobilio_id}", headers=auth_headers)


# BE scope="module" (numatytasis "function") - KIEKVIENAS testas gauna SAVO NAUJĄ rezervaciją (tam pačiam res_dependencies klientui/automobiliui), kuri ištrinama IŠ KARTO po to testo, ne laukia visų kitų.
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

# Bandymas atnaujinti NEEGZISTUOJANČIĄ rezervaciją turi grąžinti aiškų 404.
def test_update_reservation_not_found(client, auth_headers):
    resp = client.put(
        "/api/v1/reservations/999999",
        json={"busena": "patvirtinta"},
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Rezervacija nerasta"


# Bandymas ištrinti NEEGZISTUOJANČIĄ rezervaciją turi grąžinti aiškų 404.
def test_delete_reservation_not_found(client, auth_headers):
    resp = client.delete("/api/v1/reservations/999999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Rezervacija nerasta"


# ================================================================
# Statuso atnaujinimas
# ================================================================

# Pagrindinis "laimingas kelias" - busena pasikeičia į VALID_BUSENA reikšmę.
def test_update_reservation_busena(client, auth_headers, created_reservation):
    resp = client.put(
        f"/api/v1/reservations/{created_reservation}",
        json={"busena": "patvirtinta"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["busena"] == "patvirtinta"


# Neatpažinta busena turi atmesti su 422 (Pydantic validate_busena, žr. schemas/reservation.py).
def test_update_reservation_invalid_busena(client, auth_headers, created_reservation):
    resp = client.put(
        f"/api/v1/reservations/{created_reservation}",
        json={"busena": "neteisinga"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


# Pabaigos data ANKSTESNĖ nei pradžios - endpoint'as pats sujungia naujas reikšmes su esamomis PRIEŠ tikrinant (žr. update_reservation reservation.py faile), tad šis patikrinimas veikia IR dalinio atnaujinimo atveju.
def test_update_reservation_date_validation(client, auth_headers, created_reservation):
    resp = client.put(
        f"/api/v1/reservations/{created_reservation}",
        json={"rezervacijos_pradzia": "2030-07-10", "rezervacijos_pabaiga": "2030-07-05"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


# ================================================================
# Persidengimo (konflikto) patikra
# ================================================================

# PATI svarbiausia šio endpoint'o taisyklė - nauja rezervacija TAM PAČIAM automobiliui persidengiančiomis datomis (su created_reservation) turi atmesti.
def test_create_reservation_conflict_rejected(client, auth_headers, created_reservation, res_dependencies):
    kliento_id, automobilio_id = res_dependencies
    resp = client.post(
        "/api/v1/reservations/",
        json={
            "kliento_id": kliento_id, "automobilio_id": automobilio_id,
            "rezervacijos_pradzia": "2030-07-03", "rezervacijos_pabaiga": "2030-07-07",
            "busena": "laukia",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409


# "other" rezervacija perkeliama TIESIAI į created_reservation užimtas datas - turi būti atmesta, nepriklausomai nuo to, kad JI PATI anksčiau neturėjo konflikto (tikrina, kad persidengimo patikra vyksta IR update, ne tik create kelyje).
def test_update_reservation_conflict_rejected(client, auth_headers, created_reservation, res_dependencies):
    kliento_id, automobilio_id = res_dependencies
    other_resp = client.post(
        "/api/v1/reservations/",
        json={
            "kliento_id": kliento_id, "automobilio_id": automobilio_id,
            "rezervacijos_pradzia": "2030-08-01", "rezervacijos_pabaiga": "2030-08-05",
            "busena": "laukia",
        },
        headers=auth_headers,
    )
    assert other_resp.status_code == 200, other_resp.json()
    other_id = other_resp.json()["rezervacijos_id"]

    resp = client.put(
        f"/api/v1/reservations/{other_id}",
        json={"rezervacijos_pradzia": "2030-07-02", "rezervacijos_pabaiga": "2030-07-04"},
        headers=auth_headers,
    )
    assert resp.status_code == 409

    client.delete(f"/api/v1/reservations/{other_id}", headers=auth_headers)


# "Uzsakymai" lentelėje JAU yra aktyvus (vykdoma) užsakymas tam pačiam automobiliui/datoms - nauja REZERVACIJA tomis pačiomis dienomis turi būti atmesta, net jei Rezervavimas lentelėje pačioje nieko nėra (žr. availability_service.car_has_conflict - tikrina ABI lenteles, ne tik Rezervavimas).
def test_create_reservation_rejected_when_car_has_active_order(client, auth_headers, res_dependencies):
    kliento_id, automobilio_id = res_dependencies
    emp_resp = client.post("/api/v1/employees/", json={
        "vardas": "Testas", "pavarde": "Darbuotojas",
        "el_pastas": f"ordconflict{uuid.uuid4().hex[:6]}@viko.lt",
        "slaptazodis": "slaptas123!", "telefono_nr": "+37060000003",
        "pareigos": "Vadybininkas", "atlyginimas": 1800.00, "isidarbinimo_data": "2023-01-01",
    }, headers=auth_headers)
    assert emp_resp.status_code == 200, emp_resp.json()
    emp_id = emp_resp.json()["darbuotojo_id"]

    order_resp = client.post("/api/v1/orders/", json={
        "kliento_id": kliento_id, "automobilio_id": automobilio_id, "darbuotojo_id": emp_id,
        "nuomos_data": "2031-09-01", "grazinimo_data": "2031-09-05",
        "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
        "bendra_kaina": 100.0, "uzsakymo_busena": "vykdoma", "turi_papildomas_paslaugas": False,
    }, headers=auth_headers)
    assert order_resp.status_code == 200, order_resp.json()
    order_id = order_resp.json()["uzsakymo_id"]

    resp = client.post("/api/v1/reservations/", json={
        "kliento_id": kliento_id, "automobilio_id": automobilio_id,
        "rezervacijos_pradzia": "2031-09-02", "rezervacijos_pabaiga": "2031-09-04",
        "busena": "laukia",
    }, headers=auth_headers)
    assert resp.status_code == 409

    client.delete(f"/api/v1/orders/{order_id}", headers=auth_headers)


# Patikrina, kad getLatestReservations grąžina papildomą AUTOMOBILIO/KLIENTO info (JOIN, žr. get_latest_reservations_with_details) - ne tik pačios rezervacijos laukus.
def test_get_latest_reservations(client, auth_headers, created_reservation):
    resp = client.get("/api/v1/reservations/latest", params={"limit": 50}, headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()
    assert isinstance(items, list)
    match = next(r for r in items if r["rezervacijos_id"] == created_reservation)
    assert "marke" in match and "vardas" in match
