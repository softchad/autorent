# Viešo (be prisijungimo) automobilių katalogo testai - /api/v1/public endpoint'ai.
import pytest
from datetime import date, timedelta
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


# Sukuria automobilį ADMIN teisėmis - parametrai (statusas/vin/numeris/pastabos) leidžia testams paprašyti KONKREČIŲ reikšmių, kai svarbu, KAS tiksliai grąžinama viešame API (žr. test_public_cars_list_excludes_sensitive_fields žemiau).
def _make_car(auth_headers, statusas="laisvas", vin=None, numeris=None, pastabos="Vidinė pastaba, niekam nerodoma"):
    resp = client.post(
        "/api/v1/cars/",
        json={
            "marke": "Toyota", "modelis": "Corolla", "metai": 2021,
            "numeris": numeris or f"PUB{uuid4().hex[:3].upper()}",
            "vin_kodas": vin or uuid4().hex[:16].upper(),
            "spalva": "Juoda", "kebulo_tipas": "Sedanas", "pavaru_deze": "automatinė",
            "variklio_turis": 1.6, "galia_kw": 97, "kuro_tipas": "benzinas",
            "rida": 15000, "sedimos_vietos": 5, "klimato_kontrole": True, "navigacija": True,
            "kaina_parai": 40.00, "automobilio_statusas": statusas,
            "technikines_galiojimas": "2030-12-31", "dabartine_vieta_id": 1,
            "pastabos": pastabos,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


# PATI svarbiausia šio katalogo taisyklė - viešas (be prisijungimo) sąrašas NIEKADA neturi atskleisti VIN, valstybinio numerio ar vidinių darbuotojų pastabų.
def test_public_cars_list_excludes_sensitive_fields(auth_headers):
    car = _make_car(auth_headers, vin="SENSITIVE1234567", numeris="SECRET1")
    resp = client.get("/api/v1/public/cars")
    assert resp.status_code == 200
    body_text = resp.text
    assert "SENSITIVE1234567" not in body_text
    assert "SECRET1" not in body_text
    assert "Vidinė pastaba" not in body_text

    returned = next(c for c in resp.json() if c["automobilio_id"] == car["automobilio_id"])
    assert "vin_kodas" not in returned
    assert "numeris" not in returned
    assert "pastabos" not in returned


# Be datų - tik "laisvas" automobiliai rodomi pagal nutylėjimą (only_available=True numatytasis), "servise" automobilis paslepiamas.
def test_public_cars_only_available_by_default(auth_headers):
    laisvas = _make_car(auth_headers, statusas="laisvas")
    servise = _make_car(auth_headers, statusas="servise")

    resp = client.get("/api/v1/public/cars")
    ids = {c["automobilio_id"] for c in resp.json()}
    assert laisvas["automobilio_id"] in ids
    assert servise["automobilio_id"] not in ids


# Su datomis ir only_available=False - automobilis, kuris NETURI konflikto, turi gautis "laisvas_pasirinktu_laikotarpiu": True.
def test_public_cars_date_range_marks_availability(auth_headers):
    car = _make_car(auth_headers)
    resp = client.get(
        "/api/v1/public/cars",
        params={"date_from": "2027-07-01", "date_to": "2027-07-05", "only_available": False},
    )
    assert resp.status_code == 200
    returned = next(c for c in resp.json() if c["automobilio_id"] == car["automobilio_id"])
    assert returned["laisvas_pasirinktu_laikotarpiu"] is True


# Dvi netinkamų datų formos - vienodos datos (nulinis laikotarpis) IR TIK VIENA data nurodyta (žr. _validate_date_range public.py faile).
def test_public_cars_invalid_date_range_rejected():
    resp = client.get("/api/v1/public/cars", params={"date_from": "2027-07-10", "date_to": "2027-07-10"})
    assert resp.status_code == 400

    resp2 = client.get("/api/v1/public/cars", params={"date_from": "2027-07-10"})
    assert resp2.status_code == 400


# Neegzistuojantis automobilio_id turi grąžinti aiškų 404.
def test_public_car_detail_not_found():
    resp = client.get("/api/v1/public/cars/999999")
    assert resp.status_code == 404


# TOS PAČIOS datų patikros kaip sąrašo endpointe aukščiau, bet VIENO automobilio keliui - abu endpoint'ai turi SAVO atskirą kvietimą į _validate_date_range, tad reikia patikrinti abu.
def test_public_car_detail_invalid_date_range_rejected():
    resp = client.get("/api/v1/public/cars/1", params={"date_from": "2027-07-10", "date_to": "2027-07-10"})
    assert resp.status_code == 400

    resp2 = client.get("/api/v1/public/cars/1", params={"date_from": "2027-07-10"})
    assert resp2.status_code == 400


# Vienas iš 8 filtrų parametrų (marke/kuro_tipas/...) - visi struktūriškai identiški ("if param: filter(...)"), tad viena reprezentatyvi patikra užtenka visai šeimai.
def test_public_cars_filter_by_marke(auth_headers):
    toyota = _make_car(auth_headers)
    honda_resp = client.post(
        "/api/v1/cars/",
        json={
            "marke": "Honda", "modelis": "Civic", "metai": 2022,
            "numeris": f"HON{uuid4().hex[:3].upper()}", "vin_kodas": uuid4().hex[:16].upper(),
            "spalva": "Balta", "kebulo_tipas": "Sedanas", "pavaru_deze": "automatinė",
            "variklio_turis": 1.5, "galia_kw": 90, "kuro_tipas": "benzinas",
            "rida": 5000, "sedimos_vietos": 5, "klimato_kontrole": True, "navigacija": False,
            "kaina_parai": 35.0, "automobilio_statusas": "laisvas",
            "technikines_galiojimas": "2030-12-31", "dabartine_vieta_id": 1,
        },
        headers=auth_headers,
    )
    honda = honda_resp.json()

    resp = client.get("/api/v1/public/cars", params={"marke": "Honda"})
    ids = {c["automobilio_id"] for c in resp.json()}
    assert honda["automobilio_id"] in ids
    assert toyota["automobilio_id"] not in ids


# Sukuria klientą IR rezervaciją jam priskirtam automobiliui - naudojama testams, kuriems reikia REALAUS persidengimo konflikto, ne tik "servise" fizinės būsenos.
def _reserve_car(auth_headers, automobilio_id, start, end):
    client_resp = client.post(
        "/api/v1/clients/",
        json={
            "vardas": "Busy", "pavarde": "Dates",
            "el_pastas": f"busy{uuid4().hex[:8]}@example.com",
            "telefono_nr": "+37060000099", "slaptazodis": "slaptas123!",
            "gimimo_data": "2000-01-01", "registracijos_data": "2024-06-01",
        },
        headers=auth_headers,
    )
    kliento_id = client_resp.json()["kliento_id"]
    resp = client.post(
        "/api/v1/reservations/",
        json={
            "kliento_id": kliento_id, "automobilio_id": automobilio_id,
            "rezervacijos_pradzia": start.isoformat(), "rezervacijos_pabaiga": end.isoformat(),
            "busena": "laukia",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text


# Sąrašo endpointas turi išfiltruoti automobilį, kuris turi KONFLIKTĄ (rezervacija), ne tik "servise"/"remonte" fizinę būseną.
def test_public_cars_date_range_excludes_car_with_conflicting_reservation(auth_headers):
    car = _make_car(auth_headers)
    start = date.today() + timedelta(days=20)
    end = start + timedelta(days=3)
    _reserve_car(auth_headers, car["automobilio_id"], start, end)

    resp = client.get(
        "/api/v1/public/cars",
        params={"date_from": start.isoformat(), "date_to": end.isoformat(), "only_available": False},
    )
    ids = {c["automobilio_id"] for c in resp.json()}
    assert car["automobilio_id"] not in ids


# Tas pats konfliktas kaip aukščiau, bet VIENO automobilio detalei - "laisvas_pasirinktu_laikotarpiu" turi gautis False.
def test_public_car_detail_reflects_reservation_conflict(auth_headers):
    car = _make_car(auth_headers)
    start = date.today() + timedelta(days=30)
    end = start + timedelta(days=3)
    _reserve_car(auth_headers, car["automobilio_id"], start, end)

    resp = client.get(
        f"/api/v1/public/cars/{car['automobilio_id']}",
        params={"date_from": start.isoformat(), "date_to": end.isoformat()},
    )
    assert resp.status_code == 200
    assert resp.json()["laisvas_pasirinktu_laikotarpiu"] is False


# Rezervacijos intervalas [pradžia, pabaiga) - pabaigos diena PATI nėra užimta (klientas gali atsiimti kitą automobilį tą pačią dieną).
def test_public_car_busy_dates(auth_headers):
    car = _make_car(auth_headers)
    start = date.today() + timedelta(days=10)
    end = start + timedelta(days=3)
    _reserve_car(auth_headers, car["automobilio_id"], start, end)

    busy = client.get(f"/api/v1/public/cars/{car['automobilio_id']}/busy-dates")
    assert busy.status_code == 200, busy.text
    busy_dates = set(busy.json()["busy_dates"])

    assert start.isoformat() in busy_dates
    assert (start + timedelta(days=1)).isoformat() in busy_dates
    assert (start + timedelta(days=2)).isoformat() in busy_dates
    assert end.isoformat() not in busy_dates


# Automobilis be JOKIOS rezervacijos turi grąžinti TUŠČIĄ sąrašą, ne klaidą ar null.
def test_public_car_busy_dates_empty_for_free_car(auth_headers):
    car = _make_car(auth_headers)
    resp = client.get(f"/api/v1/public/cars/{car['automobilio_id']}/busy-dates")
    assert resp.status_code == 200
    assert resp.json()["busy_dates"] == []


# "servise" FIZINĖ būsena (ne rezervacijos konfliktas) TAIP PAT turi padaryti automobilį "nelaisvą" pasirinktu laikotarpiu.
def test_public_car_detail_reflects_busy_status(auth_headers):
    car = _make_car(auth_headers, statusas="servise")
    resp = client.get(
        f"/api/v1/public/cars/{car['automobilio_id']}",
        params={"date_from": "2027-08-01", "date_to": "2027-08-05"},
    )
    assert resp.status_code == 200
    assert resp.json()["laisvas_pasirinktu_laikotarpiu"] is False
