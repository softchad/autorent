import pytest
from uuid import uuid4
from app.models import Location
from app.models.discount_code import DiscountCode


# Location(1) BŪTINA, kad automobilis (dabartine_vieta_id NOT NULL) galėtų egzistuoti - API neturi vietos KŪRIMO endpoint'o, tad vieta įterpiama TIESIAI per db_session.
@pytest.fixture(scope="module")
def ensure_place_exists(db_session):
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


# Sukuria automobilį, darbuotoją ir klientą - užsakymui reikia VISŲ trijų ID iš karto, tad visa grandinė surenkama ČIA, ne kiekviename teste atskirai.
@pytest.fixture
def prepared_order(client, auth_headers, ensure_place_exists):
    car_resp = client.post(
        "/api/v1/cars/",
        json={
            "marke": "Toyota", "modelis": "Corolla", "metai": 2021,
            "numeris": f"ABC{uuid4().hex[:3].upper()}", "vin_kodas": uuid4().hex[:16].upper(),
            "spalva": "Juoda", "kebulo_tipas": "Sedanas", "pavaru_deze": "automatinė",
            "variklio_turis": 1.6, "galia_kw": 97, "kuro_tipas": "benzinas",
            "rida": 15000, "sedimos_vietos": 5, "klimato_kontrole": True, "navigacija": True,
            "kaina_parai": 40.00, "automobilio_statusas": "laisvas",
            "technikines_galiojimas": "2025-12-31", "dabartine_vieta_id": 1,
            "pastabos": "Testinis auto",
        },
        headers=auth_headers,
    )
    car_id = car_resp.json()["automobilio_id"]

    emp_resp = client.post(
        "/api/v1/employees/",
        json={
            "vardas": "Testas", "pavarde": "Darbuotojas",
            "el_pastas": f"darbuotojas{uuid4().hex[:6]}@viko.lt",
            "slaptazodis": "slaptas123!", "telefono_nr": "+37060000002",
            "pareigos": "Vadybininkas", "atlyginimas": 1800.00, "isidarbinimo_data": "2023-01-01",
        },
        headers=auth_headers,
    )
    emp_id = emp_resp.json()["darbuotojo_id"]

    client_resp = client.post(
        "/api/v1/clients/",
        json={
            "vardas": "Testas", "pavarde": "Testavičius",
            "el_pastas": f"testas{uuid4().hex[:8]}@viko.lt",
            "telefono_nr": "+37060000000", "slaptazodis": "labaiSaugus123!",
            "gimimo_data": "2000-01-01", "registracijos_data": "2024-06-01",
        },
        headers=auth_headers,
    )
    client_id = client_resp.json()["kliento_id"]

    order_resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": client_id, "automobilio_id": car_id, "darbuotojo_id": emp_id,
            "nuomos_data": "2024-06-01", "grazinimo_data": "2024-06-10",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 100.0, "uzsakymo_busena": "patvirtinta",
            "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    order_id = order_resp.json()["uzsakymo_id"]

    return {"order_id": order_id, "client_id": client_id, "car_id": car_id, "emp_id": emp_id}


# Pagrindinis "laimingas kelias" - SAVO sukurtą užsakymą ištrina iš karto (ne naudoja prepared_order's order_id), kad nepaliktų "našlaičio" įrašo.
def test_create_order(client, auth_headers, prepared_order):
    data = {
        "kliento_id": prepared_order["client_id"],
        "automobilio_id": prepared_order["car_id"],
        "darbuotojo_id": prepared_order["emp_id"],
        "nuomos_data": "2024-07-01", "grazinimo_data": "2024-07-03",
        "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
        "bendra_kaina": 350, "uzsakymo_busena": "patvirtinta",
        "turi_papildomas_paslaugas": False,
    }
    resp = client.post("/api/v1/orders/", json=data, headers=auth_headers)
    assert resp.status_code == 200
    order = resp.json()
    assert "uzsakymo_id" in order
    assert order["uzsakymo_busena"] == data["uzsakymo_busena"]
    assert "links" in order
    client.delete(f"/api/v1/orders/{order['uzsakymo_id']}", headers=auth_headers)


# Trūkstamas PRIVALOMAS laukas (automobilio_id) - Pydantic šį atmeta PRIEŠ pasiekiant endpoint'o kodą, tad VISADA 422, ne kitas klaidos kodas.
def test_create_order_missing_required(client, auth_headers, prepared_order):
    data = {
        "kliento_id": prepared_order["client_id"],
        # "automobilio_id" praleistas specialiai
        "darbuotojo_id": prepared_order["emp_id"],
        "nuomos_data": "2024-07-01", "grazinimo_data": "2024-07-03",
        "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
        "bendra_kaina": 350, "uzsakymo_busena": "patvirtinta",
        "turi_papildomas_paslaugas": False,
    }
    resp = client.post("/api/v1/orders/", json=data, headers=auth_headers)
    assert resp.status_code == 422


# KITAS klientas bando užsisakyti TĄ PATĮ automobilį persidengiančiomis datomis - turi būti atmesta, nepriklausomai nuo to, kas yra klientas.
def test_create_order_car_conflict_rejected(client, auth_headers, prepared_order):
    other_client_resp = client.post(
        "/api/v1/clients/",
        json={
            "vardas": "Kitas", "pavarde": "Klientas",
            "el_pastas": f"carconflict{uuid4().hex[:8]}@viko.lt",
            "telefono_nr": "+37060000077", "slaptazodis": "SlaptasCC123!",
            "gimimo_data": "1992-01-01", "registracijos_data": "2024-06-01",
        },
        headers=auth_headers,
    )
    other_client_id = other_client_resp.json()["kliento_id"]

    resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": other_client_id, "automobilio_id": prepared_order["car_id"],
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2024-06-05", "grazinimo_data": "2024-06-08",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 100.0, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409
    assert "automobilis" in resp.json()["detail"].lower()


# TAS PATS klientas bando užsisakyti KITĄ automobilį persidengiančiomis datomis - klientas negali vienu metu nuomotis dviejų automobilių.
def test_create_order_client_conflict_rejected(client, auth_headers, prepared_order):
    other_car_resp = client.post(
        "/api/v1/cars/",
        json={
            "marke": "Honda", "modelis": "Civic", "metai": 2021,
            "numeris": f"CON{uuid4().hex[:3].upper()}", "vin_kodas": uuid4().hex[:16].upper(),
            "spalva": "Juoda", "kebulo_tipas": "Sedanas", "pavaru_deze": "automatinė",
            "variklio_turis": 1.5, "galia_kw": 90, "kuro_tipas": "benzinas",
            "rida": 10000, "sedimos_vietos": 5, "klimato_kontrole": True, "navigacija": False,
            "kaina_parai": 35.0, "automobilio_statusas": "laisvas",
            "technikines_galiojimas": "2030-12-31", "dabartine_vieta_id": 1,
        },
        headers=auth_headers,
    )
    other_car_id = other_car_resp.json()["automobilio_id"]

    resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": other_car_id,
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2024-06-05", "grazinimo_data": "2024-06-08",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 100.0, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409
    assert "klientas" in resp.json()["detail"].lower()


# Patikrina, kad sąrašas grąžina VISUS užsakymus IR kad KIEKVIENAS turi "links" lauką.
def test_get_all_orders(client, auth_headers, prepared_order):
    resp = client.get("/api/v1/orders/", headers=auth_headers)
    assert resp.status_code == 200
    orders = resp.json()
    assert isinstance(orders, list)
    assert any(o["uzsakymo_id"] == prepared_order["order_id"] for o in orders)
    assert all("links" in o for o in orders)


# Keičiami 3 laukai VIENU PUT kreipiniu (visi, kuriuos OrderUpdate leidžia keisti, žr. order.py).
def test_update_order(client, auth_headers, prepared_order):
    update_data = {
        "uzsakymo_busena": "atšaukta",
        "grazinimo_data": "2024-07-20",
        "turi_papildomas_paslaugas": True,
    }
    resp = client.put(
        f"/api/v1/orders/{prepared_order['order_id']}",
        json=update_data,
        headers=auth_headers,
    )
    assert resp.status_code == 200
    order = resp.json()
    assert order["uzsakymo_busena"] == "atšaukta"
    assert order["turi_papildomas_paslaugas"] is True
    assert "links" in order


# Bandymas atnaujinti NEEGZISTUOJANTĮ užsakymą turi grąžinti aiškų 404.
def test_update_order_not_found(client, auth_headers):
    resp = client.put("/api/v1/orders/999999", json={"uzsakymo_busena": "atšaukta"}, headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Užsakymas nerastas"


# OrderUpdate PRIEŠ šią patikrą leistų ĮSIRAŠYTI grazinimo_data ANKSTESNĘ nei esama nuomos_data ir SULAUŽYTŲ atsakymo validaciją (OrderOut), vietoj aiškaus 400 čia pat.
def test_update_order_rejects_grazinimo_before_nuomos(client, auth_headers, prepared_order):
    resp = client.put(
        f"/api/v1/orders/{prepared_order['order_id']}",
        json={"grazinimo_data": "2024-01-01"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


# Pilnas kūrimo-ištrynimo ciklas VIENAME teste - sukurtas užsakymas realiai DINGSTA iš DB.
def test_delete_order(client, auth_headers, prepared_order):
    data = {
        "kliento_id": prepared_order["client_id"],
        "automobilio_id": prepared_order["car_id"],
        "darbuotojo_id": prepared_order["emp_id"],
        "nuomos_data": "2024-08-01", "grazinimo_data": "2024-08-10",
        "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
        "bendra_kaina": 350, "uzsakymo_busena": "patvirtinta",
        "turi_papildomas_paslaugas": False,
    }
    resp = client.post("/api/v1/orders/", json=data, headers=auth_headers)
    assert resp.status_code == 200
    order_id = resp.json()["uzsakymo_id"]

    resp = client.delete(f"/api/v1/orders/{order_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


# Bandymas ištrinti NEEGZISTUOJANTĮ užsakymą turi grąžinti aiškų 404.
def test_delete_order_not_found(client, auth_headers):
    resp = client.delete("/api/v1/orders/999999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Užsakymas nerastas"


# Galiojantis, TAM klientui priklausantis nuolaidos kodas turi TIKSLIAI sumažinti bendra_kaina ir pažymėti kodą panaudotu - ne tik priimti jį be poveikio.
def test_create_order_with_valid_discount_code_reduces_price(client, auth_headers, prepared_order, db_session):
    code = DiscountCode(
        kodas=f"AUTORENT{uuid4().hex[:6].upper()}", kliento_id=prepared_order["client_id"],
        verte_eur=15.0, kilme="aptarnavimas",
    )
    db_session.add(code)
    db_session.commit()

    data = {
        "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
        "darbuotojo_id": prepared_order["emp_id"],
        "nuomos_data": "2024-09-01", "grazinimo_data": "2024-09-03",
        "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
        "bendra_kaina": 100, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
        "nuolaidos_kodas": code.kodas,
    }
    resp = client.post("/api/v1/orders/", json=data, headers=auth_headers)
    assert resp.status_code == 200, resp.text
    order = resp.json()
    assert order["bendra_kaina"] == 85.0

    db_session.refresh(code)
    assert code.panaudojimo_data is not None
    client.delete(f"/api/v1/orders/{order['uzsakymo_id']}", headers=auth_headers)


# Neegzistuojantis/svetimas/jau panaudotas kodas turi grąžinti aiškų 400 PRIEŠ įrašant užsakymą - ne tyliai ignoruoti nuolaidą, kad darbuotojas nepagalvotų, jog ji pritaikyta, kai realiai ne.
def test_create_order_with_invalid_discount_code_rejected(client, auth_headers, prepared_order):
    data = {
        "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
        "darbuotojo_id": prepared_order["emp_id"],
        "nuomos_data": "2024-09-10", "grazinimo_data": "2024-09-12",
        "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
        "bendra_kaina": 100, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
        "nuolaidos_kodas": "AUTORENT999999",
    }
    resp = client.post("/api/v1/orders/", json=data, headers=auth_headers)
    assert resp.status_code == 400


# "Rezervavimas" lentelėje JAU yra aktyvi (patvirtinta) rezervacija tam pačiam automobiliui/datoms - naujas UŽSAKYMAS tomis pačiomis dienomis turi būti atmestas, net jei Uzsakymai lentelėje pačioje nieko nėra (žr. availability_service.car_has_conflict - tikrina ABI lenteles, ne tik Uzsakymai).
def test_create_order_rejected_when_car_has_active_reservation(client, auth_headers, prepared_order):
    res_resp = client.post(
        "/api/v1/reservations/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "rezervacijos_pradzia": "2025-03-01", "rezervacijos_pabaiga": "2025-03-05",
            "busena": "patvirtinta",
        },
        headers=auth_headers,
    )
    assert res_resp.status_code == 200, res_resp.json()
    res_id = res_resp.json()["rezervacijos_id"]

    resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2025-03-02", "grazinimo_data": "2025-03-04",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 100.0, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409

    client.delete(f"/api/v1/reservations/{res_id}", headers=auth_headers)


# Užsakymas gali būti sukurtas TIESIAI su uzsakymo_busena="atšaukta" (VALID_BUSENA tai leidžia, pvz. istoriniam įrašui) net TOMIS PAČIOMIS dienomis kaip kito aktyvaus užsakymo - "atšaukta" savaime negali konfliktuoti su kuo nors. KITAS klientas (ne prepared_order's) - kitaip susidurtume su ATSKIRA (klientų) konflikto taisykle, ne ta, kurią čia tikriname.
def test_create_order_atsaukta_bypasses_conflict_check(client, auth_headers, prepared_order):
    other_client_resp = client.post(
        "/api/v1/clients/",
        json={
            "vardas": "Kitas", "pavarde": "Atsaukejas",
            "el_pastas": f"atsaukta{uuid4().hex[:8]}@viko.lt",
            "telefono_nr": "+37060000088", "slaptazodis": "SlaptasAT123!",
            "gimimo_data": "1990-01-01", "registracijos_data": "2024-06-01",
        },
        headers=auth_headers,
    )
    other_client_id = other_client_resp.json()["kliento_id"]

    resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": other_client_id, "automobilio_id": prepared_order["car_id"],
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2024-06-03", "grazinimo_data": "2024-06-06",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 50.0, "uzsakymo_busena": "atšaukta", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.json()
    client.delete(f"/api/v1/orders/{resp.json()['uzsakymo_id']}", headers=auth_headers)


# update_order turi PAKARTOTINAI tikrinti konfliktą, kai pratęsiama grazinimo_data - ne tik create_order metu (žr. availability_service.car_has_conflict naudojimą update_order viduje).
def test_update_order_rejects_conflict_on_date_extension(client, auth_headers, prepared_order):
    # NAUJAS užsakymas TAM PAČIAM automobiliui, DAR NESIKERTANTIS su prepared_order's (06-01..06-10) - pradedamas PRIEŠ jį.
    other_resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2024-05-01", "grazinimo_data": "2024-05-05",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 80.0, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert other_resp.status_code == 200, other_resp.json()
    other_id = other_resp.json()["uzsakymo_id"]

    # Pratęsiame grazinimo_data TOLI Į PRIEKĮ, kol ji atsiduria prepared_order's aktyvaus užsakymo (06-01..06-10) viduje.
    resp = client.put(
        f"/api/v1/orders/{other_id}",
        json={"grazinimo_data": "2024-06-05"},
        headers=auth_headers,
    )
    assert resp.status_code == 409

    client.delete(f"/api/v1/orders/{other_id}", headers=auth_headers)


# PASTABA: kliento anonimizacijos elgsena (klientas su baigtais užsakymais ištrinamas anonimizuojant asmeninius duomenis, ne pašalinant eilutę) čia TYČIA nebandoma automatiniu testu - šio modulio "client"/"db_session" fixture'ai dalijasi VIENĄ bendrą transakciją visam failui, o `db.rollback()`, kurio reikia po IntegrityError, tokioje sąrankoje nutrina VISŲ šio failo testų duomenis, ne tik nepavykusį veiksmą; elgsena patikrinta rankiniu būdu prieš tikrą MySQL DB ir veikia teisingai.
