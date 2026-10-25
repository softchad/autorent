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
            "numeris": f"ABC{uuid4().hex[:12].upper()}", "vin_kodas": uuid4().hex[:16].upper(),
            "spalva": "Juoda", "kebulo_tipas": "Sedanas", "pavaru_deze": "automatinė",
            "variklio_turis": 1.6, "galia_kw": 97, "kuro_tipas": "benzinas",
            "rida": 15000, "sedimos_vietos": 5, "klimato_kontrole": True, "navigacija": True,
            "kaina_parai": 40.00, "automobilio_statusas": "laisvas",
            "technikines_galiojimas": "2025-12-31", "dabartine_vieta_id": 1,
            "pastabos": "Testinis auto",
        },
        headers=auth_headers,
    )
    assert car_resp.status_code == 200, car_resp.text
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


# Dalinis užsakymo atnaujinimas turi lyginti grąžinimą su esama nuomos pradžia ir grąžinti 400 netinkamam intervalui prieš išsaugojimą bei OrderOut atsakymo formavimą.
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


# Užsakymas, kuriamas TIESIAI su uzsakymo_busena="atšaukta", neturi konfliktuoti NEI su automobiliu (jau testuota aukščiau), NEI su KLIENTU - "atšaukta" bypass'as privalo veikti ABIEM patikroms.
def test_create_order_atsaukta_bypasses_client_conflict_check(client, auth_headers, prepared_order):
    other_car_resp = client.post(
        "/api/v1/cars/",
        json={
            "marke": "Mazda", "modelis": "3", "metai": 2022,
            "numeris": f"ATS{uuid4().hex[:3].upper()}", "vin_kodas": uuid4().hex[:16].upper(),
            "spalva": "Mėlyna", "kebulo_tipas": "Hečbekas", "pavaru_deze": "automatinė",
            "variklio_turis": 2.0, "galia_kw": 110, "kuro_tipas": "benzinas",
            "rida": 8000, "sedimos_vietos": 5, "klimato_kontrole": True, "navigacija": True,
            "kaina_parai": 45.0, "automobilio_statusas": "laisvas",
            "technikines_galiojimas": "2030-12-31", "dabartine_vieta_id": 1,
        },
        headers=auth_headers,
    )
    other_car_id = other_car_resp.json()["automobilio_id"]

    # TAS PATS klientas kaip prepared_order (kurio aktyvus užsakymas yra 06-01..06-10), bet KITAS automobilis IR uzsakymo_busena="atšaukta" - vien automobilio patikra praeitų (skirtingi automobiliai), tad šis testas konkrečiai tikrina KLIENTO patikros bypass'ą.
    resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": other_car_id,
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2024-06-03", "grazinimo_data": "2024-06-06",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 50.0, "uzsakymo_busena": "atšaukta", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.json()
    client.delete(f"/api/v1/orders/{resp.json()['uzsakymo_id']}", headers=auth_headers)
    client.delete(f"/api/v1/cars/{other_car_id}", headers=auth_headers)


# OrderUpdate turi LEISTI grazinimo_data == nuomos_data (viena diena) - LYGIAI TA PATI taisyklė kaip OrderCreate's validate_dates (schemas/order.py), ne griežtesnė "<=" patikra.
def test_update_order_allows_equal_dates(client, auth_headers, prepared_order):
    other_resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2024-04-01", "grazinimo_data": "2024-04-05",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 40.0, "uzsakymo_busena": "atšaukta", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert other_resp.status_code == 200, other_resp.json()
    other_id = other_resp.json()["uzsakymo_id"]

    resp = client.put(
        f"/api/v1/orders/{other_id}",
        json={"grazinimo_data": "2024-04-01"},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.json()
    assert resp.json()["grazinimo_data"] == "2024-04-01"

    client.delete(f"/api/v1/orders/{other_id}", headers=auth_headers)


# update_order turi PAKARTOTINAI tikrinti KLIENTO (ne tik automobilio) konfliktą, kai keičiama busena į aktyvią arba pratęsiama grazinimo_data.
def test_update_order_rejects_client_conflict_on_date_extension(client, auth_headers, prepared_order):
    other_car_resp = client.post(
        "/api/v1/cars/",
        json={
            "marke": "Kia", "modelis": "Ceed", "metai": 2022,
            "numeris": f"CLI{uuid4().hex[:3].upper()}", "vin_kodas": uuid4().hex[:16].upper(),
            "spalva": "Balta", "kebulo_tipas": "Hečbekas", "pavaru_deze": "automatinė",
            "variklio_turis": 1.6, "galia_kw": 100, "kuro_tipas": "benzinas",
            "rida": 9000, "sedimos_vietos": 5, "klimato_kontrole": True, "navigacija": True,
            "kaina_parai": 42.0, "automobilio_statusas": "laisvas",
            "technikines_galiojimas": "2030-12-31", "dabartine_vieta_id": 1,
        },
        headers=auth_headers,
    )
    other_car_id = other_car_resp.json()["automobilio_id"]

    # TAS PATS klientas kaip prepared_order (aktyvus užsakymas 06-01..06-10), KITAS automobilis, DAR nesikertančios datos.
    other_resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": other_car_id,
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2024-05-10", "grazinimo_data": "2024-05-15",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 80.0, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert other_resp.status_code == 200, other_resp.json()
    other_id = other_resp.json()["uzsakymo_id"]

    # Pratęsiame grazinimo_data, kol pasiekia prepared_order's (06-01..06-10) intervalą - KITAS automobilis, tad automobilio patikra praeitų, bet KLIENTAS sutampa.
    resp = client.put(
        f"/api/v1/orders/{other_id}",
        json={"grazinimo_data": "2024-06-05"},
        headers=auth_headers,
    )
    assert resp.status_code == 409

    client.delete(f"/api/v1/orders/{other_id}", headers=auth_headers)
    client.delete(f"/api/v1/cars/{other_car_id}", headers=auth_headers)


# Automobilis, kurio automobilio_statusas="remonte" (fizinė būsena, nesusijusi su datomis) - NEGALI būti išnuomotas, net jei konkrečios dienos "laisvos" pagal booking'us (žr. order.py NOT_BOOKABLE_STATUSES patikrą).
# "laukiama" (dar nepatvirtintas) užsakymas VIS TIEK turi blokuoti automobilį - kitaip du "laukiama" užsakymai tam pačiam automobiliui/datoms abu praeitų konflikto patikrą (žr. availability_service.BLOCKING_ORDER_STATUSES).
def test_create_order_rejected_when_car_has_pending_order(client, auth_headers, prepared_order):
    resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2024-06-03", "grazinimo_data": "2024-06-04",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 40.0, "uzsakymo_busena": "laukiama", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409


# VIENOS DIENOS (nuomos_data == grazinimo_data) užsakymas TURI konfliktuoti su jau esamu booking'u, kuris baigiasi/pradeda LYGIAI tą pačią dieną - pusiau atviro intervalo formulė nulinio pločio intervalui duotų "niekada nesikerta" be _effective_window normalizacijos (žr. availability_service.py).
def test_create_order_rejected_for_single_day_overlapping_existing(client, auth_headers, prepared_order):
    # prepared_order's automobilis jau turi aktyvų užsakymą 2024-06-01..2024-06-10 (žr. fixture) - vienos dienos užsakymas LYGIAI jo pradžios dieną turi atmesti.
    resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2024-06-01", "grazinimo_data": "2024-06-01",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 40.0, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409


# Du vienos dienos užsakymai tam pačiam automobiliui turi konfliktuoti: availability_service užimtumo patikra įvertina ir bazėje esančios, ir tikrinamos nuomos vienos dienos intervalą.
def test_create_order_rejected_when_existing_order_is_single_day(client, auth_headers, prepared_order):
    first_resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2025-11-01", "grazinimo_data": "2025-11-01",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 40.0, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert first_resp.status_code == 200, first_resp.json()
    first_id = first_resp.json()["uzsakymo_id"]

    other_client_resp = client.post(
        "/api/v1/clients/",
        json={
            "vardas": "Antras", "pavarde": "Klientas",
            "el_pastas": f"sameday{uuid4().hex[:8]}@viko.lt",
            "telefono_nr": "+37060000022", "slaptazodis": "SameDay123!",
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
            "nuomos_data": "2025-11-01", "grazinimo_data": "2025-11-03",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 80.0, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409

    client.delete(f"/api/v1/orders/{first_id}", headers=auth_headers)


# Sutrumpinus užsakymą IKI VIENOS DIENOS (grazinimo_data == nuomos_data), kaina NEGALI nukristi iki 0 - viena diena vis tiek turi kainuoti bent vienos dienos kainą (žr. order.py "or 1" apatinę ribą).
def test_update_order_single_day_shortening_does_not_zero_price(client, auth_headers, prepared_order):
    other_resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2024-01-01", "grazinimo_data": "2024-01-05",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 200.0, "uzsakymo_busena": "atšaukta", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert other_resp.status_code == 200, other_resp.json()
    other_id = other_resp.json()["uzsakymo_id"]

    resp = client.put(
        f"/api/v1/orders/{other_id}",
        json={"grazinimo_data": "2024-01-01"},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.json()
    assert resp.json()["bendra_kaina"] > 0

    client.delete(f"/api/v1/orders/{other_id}", headers=auth_headers)


# Neegzistuojantis automobilio_id/kliento_id/darbuotojo_id/vietos_id turi grąžinti AIŠKŲ 404, NE nulūžti su neaiškia 500 (FK apribojimo IntegrityError) db.commit() metu.
@pytest.mark.parametrize("field,label", [
    ("automobilio_id", "automobilis"),
    ("kliento_id", "klientas"),
    ("darbuotojo_id", "darbuotojas"),
    ("paemimo_vietos_id", "vieta"),
    ("grazinimo_vietos_id", "vieta"),
])
def test_create_order_rejects_nonexistent_fk(client, auth_headers, prepared_order, field, label):
    data = {
        "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
        "darbuotojo_id": prepared_order["emp_id"],
        "nuomos_data": "2025-09-01", "grazinimo_data": "2025-09-03",
        "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
        "bendra_kaina": 100.0, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
    }
    data[field] = 999999
    resp = client.post("/api/v1/orders/", json=data, headers=auth_headers)
    assert resp.status_code == 404
    assert label in resp.json()["detail"].lower()


def test_create_order_rejected_when_car_in_service(client, auth_headers, prepared_order):
    car_resp = client.post(
        "/api/v1/cars/",
        json={
            "marke": "Skoda", "modelis": "Octavia", "metai": 2019,
            "numeris": f"SVC{uuid4().hex[:3].upper()}", "vin_kodas": uuid4().hex[:16].upper(),
            "spalva": "Pilka", "kebulo_tipas": "Sedanas", "pavaru_deze": "mechaninė",
            "variklio_turis": 1.6, "galia_kw": 85, "kuro_tipas": "dyzelinas",
            "rida": 80000, "sedimos_vietos": 5, "klimato_kontrole": True, "navigacija": False,
            "kaina_parai": 30.0, "automobilio_statusas": "remonte",
            "technikines_galiojimas": "2026-12-31", "dabartine_vieta_id": 1,
        },
        headers=auth_headers,
    )
    car_id = car_resp.json()["automobilio_id"]

    resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": car_id,
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2025-04-01", "grazinimo_data": "2025-04-05",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 100.0, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409

    client.delete(f"/api/v1/cars/{car_id}", headers=auth_headers)


# Pratęsus grazinimo_data (trukmę) per update_order, bendra_kaina turi atsinaujinti PROPORCINGAI (DELTA metodu) - ne likti senos, trumpesnės trukmės kainos.
def test_update_order_adjusts_price_on_date_extension(client, auth_headers, prepared_order):
    other_resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2024-03-01", "grazinimo_data": "2024-03-03",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 100.0, "uzsakymo_busena": "atšaukta", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert other_resp.status_code == 200, other_resp.json()
    other_id = other_resp.json()["uzsakymo_id"]

    # Pratęsiame nuo 2 dienų (03-01..03-03) iki 5 dienų (03-01..03-06) - kaina skaičiuojama PROPORCINGAI pagal ESAMĄ (ne automobilio dabartinę) parų normą: 100.0 / 2 * 5 = 250.0. Tai (ne "+ dienos * dabartinė automobilio kaina") - kad bet koks sukūrimo metu pritaikytas nuolaidos kodas liktų proporcingai įskaičiuotas, net jei automobilio kaina_parai per tą laiką pasikeistų.
    resp = client.put(
        f"/api/v1/orders/{other_id}",
        json={"grazinimo_data": "2024-03-06"},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.json()
    assert resp.json()["bendra_kaina"] == pytest.approx(250.0)

    client.delete(f"/api/v1/orders/{other_id}", headers=auth_headers)


# Baigtas ("užbaigta") užsakymas PRIVALO likti nepakeičiamas - be šio patikrinimo PUT galėtų "atgaivinti" jį atgal į aktyvią būseną (žr. order.py terminalios būsenos apsaugą).
def test_update_order_rejects_any_change_when_completed(client, auth_headers, prepared_order):
    other_resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2024-02-01", "grazinimo_data": "2024-02-05",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 100.0, "uzsakymo_busena": "atšaukta", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert other_resp.status_code == 200, other_resp.json()
    other_id = other_resp.json()["uzsakymo_id"]

    # Užsakymą pažymime "užbaigta" PER TĄ PATĮ PUT endpoint'ą, kaip tai realiai daro darbuotojas.
    resp_done = client.put(f"/api/v1/orders/{other_id}", json={"uzsakymo_busena": "užbaigta"}, headers=auth_headers)
    assert resp_done.status_code == 200, resp_done.json()

    # Bandymas KEISTI BET KĄ po "užbaigta" - turi atmesti.
    resp = client.put(f"/api/v1/orders/{other_id}", json={"turi_papildomas_paslaugas": True}, headers=auth_headers)
    assert resp.status_code == 409

    client.delete(f"/api/v1/orders/{other_id}", headers=auth_headers)


# Nurodžius patvirtintos rezervacijos ID, create_order turi vienu sandoriu sukurti jos klientą, automobilį ir datas atitinkantį užsakymą bei pažymėti rezervaciją atšaukta kaip pakeistą nuoma.
def test_create_order_converts_matching_reservation(client, auth_headers, prepared_order):
    res_resp = client.post(
        "/api/v1/reservations/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "rezervacijos_pradzia": "2025-08-01", "rezervacijos_pabaiga": "2025-08-05",
            "busena": "patvirtinta",
        },
        headers=auth_headers,
    )
    assert res_resp.status_code == 200, res_resp.json()
    res_id = res_resp.json()["rezervacijos_id"]

    order_resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2025-08-01", "grazinimo_data": "2025-08-05",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 160.0, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
            "rezervacijos_id": res_id,
        },
        headers=auth_headers,
    )
    assert order_resp.status_code == 200, order_resp.json()
    order_id = order_resp.json()["uzsakymo_id"]

    res_check = client.get("/api/v1/reservations/", headers=auth_headers).json()
    converted = next(r for r in res_check if r["rezervacijos_id"] == res_id)
    assert converted["busena"] == "atšaukta"

    client.delete(f"/api/v1/orders/{order_id}", headers=auth_headers)


# Nurodyta "rezervacijos_id" TURI priklausyti TAM PAČIAM klientui/automobiliui - kitaip staff klaida galėtų "atrakinti" SVETIMos rezervacijos blokuojamas datas.
def test_create_order_rejects_mismatched_reservation_link(client, auth_headers, prepared_order):
    other_car_resp = client.post(
        "/api/v1/cars/",
        json={
            "marke": "Toyota", "modelis": "Yaris", "metai": 2021,
            "numeris": f"CNV{uuid4().hex[:3].upper()}", "vin_kodas": uuid4().hex[:16].upper(),
            "spalva": "Žalia", "kebulo_tipas": "Hečbekas", "pavaru_deze": "automatinė",
            "variklio_turis": 1.5, "galia_kw": 90, "kuro_tipas": "benzinas",
            "rida": 5000, "sedimos_vietos": 5, "klimato_kontrole": True, "navigacija": False,
            "kaina_parai": 35.0, "automobilio_statusas": "laisvas",
            "technikines_galiojimas": "2030-12-31", "dabartine_vieta_id": 1,
        },
        headers=auth_headers,
    )
    other_car_id = other_car_resp.json()["automobilio_id"]

    res_resp = client.post(
        "/api/v1/reservations/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "rezervacijos_pradzia": "2025-08-10", "rezervacijos_pabaiga": "2025-08-12",
            "busena": "patvirtinta",
        },
        headers=auth_headers,
    )
    res_id = res_resp.json()["rezervacijos_id"]

    # Bandoma "konvertuoti" šią rezervaciją į užsakymą KITAM automobiliui.
    resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": other_car_id,
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2025-08-10", "grazinimo_data": "2025-08-12",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 70.0, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
            "rezervacijos_id": res_id,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 400

    client.delete(f"/api/v1/reservations/{res_id}", headers=auth_headers)
    client.delete(f"/api/v1/cars/{other_car_id}", headers=auth_headers)


# Pratęsus nuomą iš dviejų dienų po 50 EUR iki trijų, iš 150 EUR bazinės kainos turi būti atimta ta pati fiksuota 20 EUR nuolaida: galutinė suma 130 EUR.
def test_update_order_extension_reapplies_fixed_discount_once_not_proportionally(client, auth_headers, prepared_order, db_session):
    code = DiscountCode(
        kodas=f"EXT{uuid4().hex[:6].upper()}", verte_eur=20.0, kilme="aptarnavimas",
        kliento_id=prepared_order["client_id"], panaudojimo_data=None,
    )
    db_session.add(code)
    db_session.commit()

    order_resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2025-10-01", "grazinimo_data": "2025-10-03",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 100.0, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
            "nuolaidos_kodas": code.kodas,
        },
        headers=auth_headers,
    )
    assert order_resp.status_code == 200, order_resp.json()
    assert float(order_resp.json()["bendra_kaina"]) == 80.0
    order_id = order_resp.json()["uzsakymo_id"]

    extend_resp = client.put(
        f"/api/v1/orders/{order_id}",
        json={"grazinimo_data": "2025-10-04"},
        headers=auth_headers,
    )
    assert extend_resp.status_code == 200, extend_resp.json()
    assert float(extend_resp.json()["bendra_kaina"]) == pytest.approx(130.0)

    client.delete(f"/api/v1/orders/{order_id}", headers=auth_headers)


# Užsakymo paėmimo vieta turi sutapti su užrakinto automobilio dabartine_vieta_id, kad kartu pakeistas adresas negalėtų būti išsaugotas kaip klaidinga nuomos pradžios vieta.
def test_create_order_rejects_mismatched_pickup_location(client, auth_headers, prepared_order, ensure_place_exists, db_session):
    from app.models import Location
    if not db_session.query(Location).filter_by(vietos_id=2).first():
        db_session.add(Location(vietos_id=2, pavadinimas="Antra vieta", adresas="Kita g. 2", miestas="Kaunas"))
        db_session.commit()

    resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2025-09-01", "grazinimo_data": "2025-09-05",
            # Automobilis (prepared_order) yra "dabartine_vieta_id": 1, bet ČIA pateikiama vieta 2 - turi atmesti.
            "paemimo_vietos_id": 2, "grazinimo_vietos_id": 2,
            "bendra_kaina": 160.0, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409, resp.json()


# Užbaigus nuomą automobilio dabartine_vieta_id turi tapti pasirinkta grąžinimo vieta, kad vėlesnė paieška ir užsakymai naudotų teisingą padalinį.
def test_completing_order_moves_car_to_return_location(client, auth_headers, prepared_order, db_session):
    from app.models import Location, Car
    if not db_session.query(Location).filter_by(vietos_id=2).first():
        db_session.add(Location(vietos_id=2, pavadinimas="Antra vieta", adresas="Kita g. 2", miestas="Kaunas"))
        db_session.commit()

    order_resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2025-09-10", "grazinimo_data": "2025-09-12",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 2,
            "bendra_kaina": 80.0, "uzsakymo_busena": "vykdoma", "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )
    assert order_resp.status_code == 200, order_resp.json()
    order_id = order_resp.json()["uzsakymo_id"]

    complete_resp = client.put(
        f"/api/v1/orders/{order_id}",
        json={"uzsakymo_busena": "užbaigta"},
        headers=auth_headers,
    )
    assert complete_resp.status_code == 200, complete_resp.json()

    car = db_session.query(Car).filter_by(automobilio_id=prepared_order["car_id"]).first()
    assert car.dabartine_vieta_id == 2


# Atšaukto užsakymo sukūrimas neturi sunaudoti nuolaidos kodo, nes toks užsakymas nesuteikia klientui aktyvios nuomos.
def test_create_order_cancelled_does_not_consume_discount_code(client, auth_headers, prepared_order, db_session):
    code = DiscountCode(
        kodas=f"CANC{uuid4().hex[:6].upper()}", verte_eur=20.0, kilme="aptarnavimas",
        kliento_id=prepared_order["client_id"], panaudojimo_data=None,
    )
    db_session.add(code)
    db_session.commit()

    resp = client.post(
        "/api/v1/orders/",
        json={
            "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
            "darbuotojo_id": prepared_order["emp_id"],
            "nuomos_data": "2025-09-20", "grazinimo_data": "2025-09-22",
            "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
            "bendra_kaina": 80.0, "uzsakymo_busena": "atšaukta", "turi_papildomas_paslaugas": False,
            "nuolaidos_kodas": code.kodas,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.json()
    assert float(resp.json()["bendra_kaina"]) == 80.0

    db_session.refresh(code)
    assert code.panaudojimo_data is None


# Šio modulio bendra transakcija netinka kliento anonimizavimo klaidos keliui, nes endpointo rollback panaikintų ir kitų testų paruoštus įrašus; tokiam bandymui reikalinga atskira sesija.


# Su sąskaita susieto užsakymo trynimas turi grąžinti 409 dėl išorinio rakto; testas vykdomas modulio gale, nes endpointo rollback gali panaikinti bendros testų transakcijos paruoštus duomenis.
def test_reservation_conversion_preserves_quote_and_rejects_unsafe_states(client, auth_headers, prepared_order, db_session):
    from app.models.reservation import Reservation

    reserved = client.post("/api/v1/reservations/", headers=auth_headers, json={
        "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
        "rezervacijos_pradzia": "2028-06-01", "rezervacijos_pabaiga": "2028-06-04", "busena": "patvirtinta",
    })
    assert reserved.status_code == 200, reserved.text
    reservation_id = reserved.json()["rezervacijos_id"]
    source = db_session.get(Reservation, reservation_id)
    assert float(source.kaina_parai) == 40.0
    payload = {
        "kliento_id": prepared_order["client_id"], "automobilio_id": prepared_order["car_id"],
        "darbuotojo_id": prepared_order["emp_id"], "rezervacijos_id": reservation_id,
        "nuomos_data": "2028-06-01", "grazinimo_data": "2028-06-04",
        "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
        "bendra_kaina": 999.0, "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
    }
    for invalid in ({"uzsakymo_busena": "atšaukta"}, {"uzsakymo_busena": "užbaigta"},
                    {"uzsakymo_busena": "laukiama"}, {"grazinimo_data": "2028-06-05"}):
        rejected = client.post("/api/v1/orders/", headers=auth_headers, json={**payload, **invalid})
        assert rejected.status_code == 400, rejected.text
        db_session.refresh(source)
        assert source.busena == "patvirtinta"
    source.busena = "atšaukta"
    db_session.commit()
    assert client.post("/api/v1/orders/", headers=auth_headers, json=payload).status_code == 409
    source.busena = "patvirtinta"
    db_session.commit()
    converted = client.post("/api/v1/orders/", headers=auth_headers, json=payload)
    assert converted.status_code == 200, converted.text
    assert float(converted.json()["bendra_kaina"]) == 120.0
    assert client.post("/api/v1/orders/", headers=auth_headers, json=payload).status_code == 409


def test_zero_total_discounted_order_cannot_be_repriced_from_lost_gross(client, auth_headers, prepared_order, db_session):
    from app.models.order import Order

    order = db_session.get(Order, prepared_order["order_id"])
    order.bendra_kaina = 0
    order.bazine_kaina_parai = None
    order.taikyta_nuolaida_eur = 100
    db_session.commit()
    response = client.put(f"/api/v1/orders/{order.uzsakymo_id}", headers=auth_headers,
                          json={"grazinimo_data": "2024-06-11"})
    assert response.status_code == 409, response.text
    db_session.refresh(order)
    assert float(order.bendra_kaina) == 0
    assert str(order.grazinimo_data) == "2024-06-10"


# Išsaugotas bazinis tarifas leidžia pratęsti visiškai nuolaida padengtą nuomą nepaverčiant fiksuotos nuolaidos procentine.
def test_zero_total_with_saved_rate_can_be_extended(client, auth_headers, prepared_order, db_session):
    from app.models.order import Order

    order = db_session.get(Order, prepared_order["order_id"])
    order.bendra_kaina = 0
    order.bazine_kaina_parai = 5
    order.taikyta_nuolaida_eur = 50
    db_session.commit()
    response = client.put(f"/api/v1/orders/{order.uzsakymo_id}", headers=auth_headers, json={"grazinimo_data": "2024-06-13"})
    assert response.status_code == 200, response.text
    assert float(response.json()["bendra_kaina"]) == 10


# Susieta sąskaita turi neleisti ištrinti užsakymo ir turi grąžinti suprantamą konfliktą vietoj serverio klaidos.
def test_delete_order_with_invoice_returns_409_not_500(client, auth_headers, prepared_order):
    invoice_resp = client.post(
        "/api/v1/invoices/",
        json={"order_id": prepared_order["order_id"], "total": 42.0, "invoice_date": "2024-06-01"},
        headers=auth_headers,
    )
    assert invoice_resp.status_code == 200, invoice_resp.json()

    resp = client.delete(f"/api/v1/orders/{prepared_order['order_id']}", headers=auth_headers)
    assert resp.status_code == 409, resp.json()
