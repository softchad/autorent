"""Kliento lojalumo programos testai - /api/v1/customer/loyalty endpoint'ai."""
import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app
from app.models.location import Location

client = TestClient(app)


# "autouse=True" - paleidžiama AUTOMATIŠKAI prieš VISUS šio failo testus, be reikalo prašyti jos kaip parametro; automobiliui (žr. _make_car žemiau) reikia egzistuojančios vietos (dabartine_vieta_id NOT NULL), o API neturi vietos KŪRIMO endpoint'o, tad ji įterpiama TIESIAI per db_session.
@pytest.fixture(scope="module", autouse=True)
def ensure_pristatymo_vieta(db_session):
    vieta = db_session.query(Location).filter_by(vietos_id=1).first()
    if not vieta:
        vieta = Location(vietos_id=1, pavadinimas="Testo vieta", adresas="Test g. 1", miestas="Vilnius")
        db_session.add(vieta)
        db_session.commit()
    yield vieta


# Užregistruoja NAUJĄ klientą (unikaliu el. paštu) ir grąžina IR jo tokeną, IR kliento_id (per /customer/me) - lojalumo testams reikia abiejų: tokeno API kreipiniams, kliento_id - kuriant užsakymus jo vardu.
def _registered_customer():
    email = f"loyalty{uuid4().hex[:8]}@example.com"
    resp = client.post(
        "/api/v1/customer/register",
        json={
            "vardas": "Lojalus",
            "pavarde": "Klientas",
            "el_pastas": email,
            "telefono_nr": "+37061234567",
            "gimimo_data": "1995-01-01",
            "slaptazodis": "Testinis123!",
        },
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    me = client.get("/api/v1/customer/me", headers={"Authorization": f"Bearer {token}"})
    return token, me.json()["kliento_id"]


# Sukuria automobilį ADMIN teisėmis (auth_headers) - reikalingas kaip automobilio_id kiekvienam užsakymui, kurį testai paskui kuria klientui (žr. _make_order žemiau).
def _make_car(auth_headers, kaina_parai=40.0):
    resp = client.post(
        "/api/v1/cars/",
        json={
            "marke": "Toyota", "modelis": "Corolla", "metai": 2021,
            "numeris": f"LOY{uuid4().hex[:3].upper()}", "vin_kodas": uuid4().hex[:16].upper(),
            "spalva": "Juoda", "kebulo_tipas": "Sedanas", "pavarų_deze": "automatinė",
            "variklio_turis": 1.6, "galia_kw": 97, "kuro_tipas": "benzinas",
            "rida": 15000, "sedimos_vietos": 5, "klimato_kontrole": True, "navigacija": True,
            "kaina_parai": kaina_parai, "automobilio_statusas": "laisvas",
            "technikines_galiojimas": "2030-12-31", "dabartine_vieta_id": 1,
            "pastabos": "Loyalty test",
        },
        headers=auth_headers,
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["automobilio_id"]


# Sukuria darbuotoją, reikalingą kaip darbuotojo_id kiekvienam užsakymui (OrderCreate laukas, žr. schemas/order.py) - realiai NEI VIENAS lojalumo testas netikrina ŠITO konkretaus darbuotojo, tiesiog užsakymui jo reikia egzistuoti.
def _make_employee(auth_headers):
    resp = client.post(
        "/api/v1/employees/",
        json={
            "vardas": "Darbuotojas", "pavarde": "Testuotojas",
            "el_pastas": f"loydarb{uuid4().hex[:6]}@viko.lt",
            "slaptazodis": "slaptas123!", "telefono_nr": "+37060000003",
            "pareigos": "Vadybininkas", "atlyginimas": 1600.00, "isidarbinimo_data": "2023-01-01",
        },
        headers=auth_headers,
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["darbuotojo_id"]


# Sukuria "n" užsakymų TAM PAČIAM klientui/automobiliui/darbuotojui su NURODYTA būsena - "n" leidžia testams greitai simuliuoti KELIS užbaigtus užsakymus (lojalumo etapas = kas 5), be kiekvieno atskirai surašant.
def _make_order(auth_headers, kliento_id, automobilio_id, darbuotojo_id, busena, n=1):
    for i in range(n):
        resp = client.post(
            "/api/v1/orders/",
            json={
                "kliento_id": kliento_id, "automobilio_id": automobilio_id, "darbuotojo_id": darbuotojo_id,
                "nuomos_data": "2024-06-01", "grazinimo_data": "2024-06-05",
                "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
                "bendra_kaina": 100.0, "uzsakymo_busena": busena,
                "turi_papildomas_paslaugas": False,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text


# Visiškai NAUJAS klientas (nė vieno užsakymo) - progresas ir atlygiai turi būti tušti, ne klaida ar null.
def test_loyalty_status_zero_when_no_completed_orders(auth_headers):
    token, _ = _registered_customer()
    resp = client.get("/api/v1/customer/loyalty", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["uzbaigtu_nuomu_skaicius"] == 0
    assert body["atlygiai"] == []


# TIKSLIAI 5-asis užbaigtas užsakymas turi uždirbti PIRMĄ atlygį (REWARD_MILESTONE_SIZE=5, žr. customer_loyalty.py) - ribinis atvejis, ne "apytiksliai apie 5".
def test_loyalty_reward_earned_at_fifth_completed_order(auth_headers):
    token, kliento_id = _registered_customer()
    car_id = _make_car(auth_headers)
    emp_id = _make_employee(auth_headers)
    _make_order(auth_headers, kliento_id, car_id, emp_id, "užbaigta", n=5)

    resp = client.get("/api/v1/customer/loyalty", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["uzbaigtu_nuomu_skaicius"] == 5
    assert body["progresas_dabartiniame_etape"] == 0
    assert len(body["atlygiai"]) == 1
    assert body["atlygiai"][0]["busena"] == "neisnaudotas"


# Priešingas ribinis atvejis nei aukščiau - 4 (VIENU mažiau nei 5) NETURI uždirbti atlygio; "progresas_dabartiniame_etape" turi rodyti 4, ne 0 ar klaidą.
def test_loyalty_no_reward_below_threshold(auth_headers):
    token, kliento_id = _registered_customer()
    car_id = _make_car(auth_headers)
    emp_id = _make_employee(auth_headers)
    _make_order(auth_headers, kliento_id, car_id, emp_id, "užbaigta", n=4)

    resp = client.get("/api/v1/customer/loyalty", headers={"Authorization": f"Bearer {token}"})
    body = resp.json()
    assert body["uzbaigtu_nuomu_skaicius"] == 4
    assert body["progresas_dabartiniame_etape"] == 4
    assert body["atlygiai"] == []


def test_loyalty_multiple_milestones_create_multiple_rewards(auth_headers):
    # 10 užbaigtų nuomų = 2 etapai (kas 5) - _ensure_rewards_up_to_date turi "pasivyti" ir sukurti ABU atlygius vienu kreipiniu, ne tik vieną.
    token, kliento_id = _registered_customer()
    car_id = _make_car(auth_headers)
    emp_id = _make_employee(auth_headers)
    _make_order(auth_headers, kliento_id, car_id, emp_id, "užbaigta", n=10)

    resp = client.get("/api/v1/customer/loyalty", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["uzbaigtu_nuomu_skaicius"] == 10
    assert len(body["atlygiai"]) == 2
    assert {r["etapo_numeris"] for r in body["atlygiai"]} == {1, 2}


# Pagrindinis "laimingas kelias" - uždirbtas atlygis sėkmingai panaudojamas, būsena pasikeičia į "isnaudotas".
def test_redeem_reward(auth_headers):
    token, kliento_id = _registered_customer()
    car_id = _make_car(auth_headers)
    emp_id = _make_employee(auth_headers)
    _make_order(auth_headers, kliento_id, car_id, emp_id, "užbaigta", n=5)
    headers = {"Authorization": f"Bearer {token}"}

    status = client.get("/api/v1/customer/loyalty", headers=headers).json()
    atlygio_id = status["atlygiai"][0]["atlygio_id"]

    resp = client.post(f"/api/v1/customer/loyalty/rewards/{atlygio_id}/redeem", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["busena"] == "isnaudotas"


# Antras bandymas panaudoti TĄ PATĮ atlygį turi atmesti - apsauga nuo dvigubo panaudojimo (žr. redeem_reward with_for_update() customer_loyalty.py faile).
def test_redeem_already_used_reward_rejected(auth_headers):
    token, kliento_id = _registered_customer()
    car_id = _make_car(auth_headers)
    emp_id = _make_employee(auth_headers)
    _make_order(auth_headers, kliento_id, car_id, emp_id, "užbaigta", n=5)
    headers = {"Authorization": f"Bearer {token}"}

    atlygio_id = client.get("/api/v1/customer/loyalty", headers=headers).json()["atlygiai"][0]["atlygio_id"]
    client.post(f"/api/v1/customer/loyalty/rewards/{atlygio_id}/redeem", headers=headers)

    second = client.post(f"/api/v1/customer/loyalty/rewards/{atlygio_id}/redeem", headers=headers)
    assert second.status_code == 409


# Saugumo riba - klientas B bando panaudoti KLIENTO A atlygį pagal ID; 404 (ne 403), kad B negalėtų atspėti, ar svetimas atlygio ID egzistuoja.
def test_cannot_redeem_another_customers_reward(auth_headers):
    token_a, kliento_a = _registered_customer()
    token_b, _ = _registered_customer()
    car_id = _make_car(auth_headers)
    emp_id = _make_employee(auth_headers)
    _make_order(auth_headers, kliento_a, car_id, emp_id, "užbaigta", n=5)

    atlygio_id = client.get(
        "/api/v1/customer/loyalty", headers={"Authorization": f"Bearer {token_a}"}
    ).json()["atlygiai"][0]["atlygio_id"]

    resp = client.post(
        f"/api/v1/customer/loyalty/rewards/{atlygio_id}/redeem",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp.status_code == 404
