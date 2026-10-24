"""Kliento (ne darbuotojo) rezervacijų testai - /api/v1/customer/reservations endpoint'ai."""
import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app
from app.models.location import Location

client = TestClient(app)


# "autouse=True" - paleidžiama AUTOMATIŠKAI prieš VISUS šio failo testus; automobiliui (žr. _make_car žemiau) reikia egzistuojančios vietos (dabartine_vieta_id NOT NULL), o API neturi vietos KŪRIMO endpoint'o, tad ji įterpiama TIESIAI per db_session.
@pytest.fixture(scope="module", autouse=True)
def ensure_pristatymo_vieta(db_session):
    vieta = db_session.query(Location).filter_by(vietos_id=1).first()
    if not vieta:
        vieta = Location(vietos_id=1, pavadinimas="Testo vieta", adresas="Test g. 1", miestas="Vilnius")
        db_session.add(vieta)
        db_session.commit()
    yield vieta


# Sukuria automobilį ADMIN teisėmis - "statusas" parametras leidžia testams paprašyti JAU "servise"/"remonte" automobilio, patikrinti blokavimą pagal fizinę būseną (žr. test_create_customer_reservation_blocked_status_rejected žemiau).
def _make_car(auth_headers, kaina_parai=50.0, statusas="laisvas"):
    resp = client.post(
        "/api/v1/cars/",
        json={
            "marke": "Toyota",
            "modelis": "Aygo",
            "metai": 2022,
            "numeris": f"CUS{uuid4().hex[:3].upper()}",
            "vin_kodas": uuid4().hex[:16].upper(),
            "spalva": "Mėlyna",
            "kebulo_tipas": "Hečbekas",
            "pavaru_deze": "mechaninė",
            "variklio_turis": 1.0,
            "galia_kw": 53,
            "kuro_tipas": "benzinas",
            "rida": 5000,
            "sedimos_vietos": 4,
            "klimato_kontrole": False,
            "navigacija": False,
            "kaina_parai": kaina_parai,
            "automobilio_statusas": statusas,
            "technikines_galiojimas": "2030-12-31",
            "dabartine_vieta_id": 1,
            "pastabos": "Customer reservation test",
        },
        headers=auth_headers,
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["automobilio_id"]


# Užregistruoja NAUJĄ klientą (atsitiktiniu el. paštu, nebent nurodytas konkretus) ir grąžina TIK jo tokeną - šiems testams kliento_id nereikia, tik Authorization antraštė.
def _customer_token(email=None):
    email = email or f"rez{uuid4().hex[:8]}@example.com"
    resp = client.post(
        "/api/v1/customer/register",
        json={
            "vardas": "Klientas",
            "pavarde": "Testuotojas",
            "el_pastas": email,
            "telefono_nr": "+37061234567",
            "gimimo_data": "1995-01-01",
            "slaptazodis": "Testinis123!",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


# Pagrindinis "laimingas kelias" - patikrina IR patį sukūrimą, IR kainos paskaičiavimą (dienu_skaicius * kaina_parai), kurį serveris skaičiuoja PATS, ne priima iš kliento.
def test_create_customer_reservation(auth_headers):
    car_id = _make_car(auth_headers)
    token = _customer_token()
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post(
        "/api/v1/customer/reservations",
        json={"automobilio_id": car_id, "date_from": "2027-01-10", "date_to": "2027-01-15"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["automobilio_id"] == car_id
    assert body["busena"] == "laukia"
    assert body["dienu_skaicius"] == 5
    assert body["viso_kaina"] == pytest.approx(5 * 50.0)


# date_from == date_to (nulinis laikotarpis) - _validate_date_range turi atmesti, nereikalaujant tikro persidengimo su KITA rezervacija.
def test_create_customer_reservation_invalid_dates(auth_headers):
    car_id = _make_car(auth_headers)
    token = _customer_token()
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post(
        "/api/v1/customer/reservations",
        json={"automobilio_id": car_id, "date_from": "2027-02-10", "date_to": "2027-02-10"},
        headers=headers,
    )
    assert resp.status_code == 400


# Rezervacijos sukūrimo metu užfiksuotas paros tarifas turi išlikti toks pats customer.py atsakyme, net darbuotojui pakeitus automobilio kainą.
def test_reservation_price_unaffected_by_later_car_price_change(auth_headers):
    car_id = _make_car(auth_headers, kaina_parai=50.0)
    token = _customer_token()
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = client.post(
        "/api/v1/customer/reservations",
        json={"automobilio_id": car_id, "date_from": "2027-03-10", "date_to": "2027-03-15"},
        headers=headers,
    )
    assert create_resp.status_code == 200, create_resp.text
    original_total = create_resp.json()["viso_kaina"]
    assert original_total == pytest.approx(5 * 50.0)

    patch_resp = client.put(f"/api/v1/cars/{car_id}", json={"kaina_parai": 200.0}, headers=auth_headers)
    assert patch_resp.status_code == 200, patch_resp.text

    list_resp = client.get("/api/v1/customer/reservations", headers=headers)
    assert list_resp.status_code == 200
    listed = list_resp.json()[0]
    assert listed["kaina_parai"] == 50.0
    assert listed["viso_kaina"] == pytest.approx(5 * 50.0)


# Klientų rezervacijų API turi atmesti pradžią praeityje ir tiesioginei HTTP užklausai, kuriai frontend kalendoriaus apribojimai netaikomi.
def test_create_customer_reservation_rejects_past_date(auth_headers):
    car_id = _make_car(auth_headers)
    token = _customer_token()
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post(
        "/api/v1/customer/reservations",
        json={"automobilio_id": car_id, "date_from": "2001-01-01", "date_to": "2001-01-02"},
        headers=headers,
    )
    assert resp.status_code == 422


# Neegzistuojantis automobilio_id turi grąžinti aiškų 404, ne sulūžti ar tyliai sukurti rezervaciją be galiojančio automobilio.
def test_create_customer_reservation_car_not_found(auth_headers):
    token = _customer_token()
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post(
        "/api/v1/customer/reservations",
        json={"automobilio_id": 999999, "date_from": "2027-03-01", "date_to": "2027-03-05"},
        headers=headers,
    )
    assert resp.status_code == 404


# "servise" automobilis blokuojamas dėl FIZINĖS būsenos, NEPRIKLAUSOMAI nuo pasirinktų datų - skirtingai nei datų persidengimo patikra žemiau.
def test_create_customer_reservation_blocked_status_rejected(auth_headers):
    car_id = _make_car(auth_headers, statusas="servise")
    token = _customer_token()
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post(
        "/api/v1/customer/reservations",
        json={"automobilio_id": car_id, "date_from": "2027-04-01", "date_to": "2027-04-05"},
        headers=headers,
    )
    assert resp.status_code == 409


# PATS svarbiausias šio endpoint'o taisyklė - antra rezervacija TAM PAČIAM automobiliui persidengiančiomis datomis turi atmesti, net jei klientas kitas.
def test_create_customer_reservation_overlap_rejected(auth_headers):
    car_id = _make_car(auth_headers)
    token = _customer_token()
    headers = {"Authorization": f"Bearer {token}"}

    first = client.post(
        "/api/v1/customer/reservations",
        json={"automobilio_id": car_id, "date_from": "2027-05-10", "date_to": "2027-05-15"},
        headers=headers,
    )
    assert first.status_code == 200, first.text

    second = client.post(
        "/api/v1/customer/reservations",
        json={"automobilio_id": car_id, "date_from": "2027-05-12", "date_to": "2027-05-20"},
        headers=headers,
    )
    assert second.status_code == 409


# Saugumo riba - klientas B neturi matyti kliento A rezervacijų, net jei abu kviečia TĄ PATĮ sąrašo endpoint'ą.
def test_get_customer_reservations_only_own(auth_headers):
    car_id = _make_car(auth_headers)
    token_a = _customer_token("klientas.a@example.com")
    token_b = _customer_token("klientas.b@example.com")

    client.post(
        "/api/v1/customer/reservations",
        json={"automobilio_id": car_id, "date_from": "2027-06-01", "date_to": "2027-06-03"},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    resp_a = client.get("/api/v1/customer/reservations", headers={"Authorization": f"Bearer {token_a}"})
    resp_b = client.get("/api/v1/customer/reservations", headers={"Authorization": f"Bearer {token_b}"})
    assert resp_a.status_code == 200 and len(resp_a.json()) >= 1
    assert resp_b.status_code == 200 and resp_b.json() == []


# Sąrašo (GET) kelias be tokeno - tikrina get_current_customer sargą.
def test_customer_reservations_require_customer_token():
    resp = client.get("/api/v1/customer/reservations")
    assert resp.status_code == 401


# Kūrimo (POST) kelias be tokeno - ATSKIRAS testas nuo aukščiau, nes abu endpoint'ai (GET/POST) turi SAVO Depends(get_current_customer) patikrą, kuri gali būti pamiršta pridėti vienam iš jų.
def test_create_customer_reservation_requires_customer_token(auth_headers):
    car_id = _make_car(auth_headers)
    resp = client.post(
        "/api/v1/customer/reservations",
        json={"automobilio_id": car_id, "date_from": "2027-08-01", "date_to": "2027-08-05"},
    )
    assert resp.status_code == 401


# Automobilis UŽIMTAS dėl AKTYVAUS UŽSAKYMO (ne rezervacijos) - tikrina, kad customer.py bendra laisvumo patikra apima IR Uzsakymai lentelę, ne tik Rezervavimas.
def test_create_customer_reservation_blocked_by_active_order(auth_headers, db_session):
    from app.models.employee import Employee

    car_id = _make_car(auth_headers)

    order_client_resp = client.post(
        "/api/v1/clients/",
        json={
            "vardas": "Uzsakymo", "pavarde": "Klientas",
            "el_pastas": f"order{uuid4().hex[:8]}@example.com",
            "telefono_nr": "+37060000099", "slaptazodis": "SlaptasOrd123!",
            "gimimo_data": "1990-01-01", "registracijos_data": "2024-06-01",
        },
        headers=auth_headers,
    )
    order_client_id = order_client_resp.json()["kliento_id"]
    emp = db_session.query(Employee).filter_by(pareigos="Administratorius").first()

    order_resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": order_client_id, "automobilio_id": car_id, "darbuotojo_id": emp.darbuotojo_id,
            "nuomos_data": "2027-07-01", "grazinimo_data": "2027-07-05",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 100.0, "uzsakymo_busena": "vykdoma", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert order_resp.status_code == 200, order_resp.text

    token = _customer_token()
    resp = client.post(
        "/api/v1/customer/reservations",
        json={"automobilio_id": car_id, "date_from": "2027-07-02", "date_to": "2027-07-04"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409
