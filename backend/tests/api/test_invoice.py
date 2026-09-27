import pytest
from fastapi.testclient import TestClient
from app.main import app
from uuid import uuid4
from app.models import Location

client = TestClient(app)


# "scope='module', autouse" nebuvo pažymėta ČIA (tik eksplicitiškai per ensure_place_exists parametrą žemiau) - Location(1) reikalinga, kad automobilis (dabartine_vieta_id NOT NULL) ir prepared_order galėtų egzistuoti.
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


# Sukuria automobilį, darbuotoją, klientą ir užsakymą - sąskaitai reikia JAU egzistuojančio užsakymo (InvoiceCreate.order_id), tad visa grandinė surenkama iš karto.
@pytest.fixture
def prepared_order(ensure_place_exists, auth_headers):
    car_resp = client.post(
        "/api/v1/cars/",
        json={
            "marke": "Toyota", "modelis": "Corolla", "metai": 2021,
            "numeris": f"ABC{uuid4().hex[:3].upper()}", "vin_kodas": uuid4().hex[:16].upper(),
            "spalva": "Juoda", "kebulo_tipas": "Sedanas", "pavarų_deze": "automatinė",
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
            "pareigos": "Administratorius", "atlyginimas": 1800.00,
            "isidarbinimo_data": "2023-01-01",
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
    return order_resp.json()["uzsakymo_id"]


# Pagrindiniai sąskaitos kūrimo duomenys - prepared_order suteikia galiojantį order_id.
@pytest.fixture
def example_invoice_data(prepared_order):
    return {"order_id": prepared_order, "total": 123.45, "invoice_date": "2024-06-01"}


# Patikrina, kad InvoiceOut atsakyme yra VISI laukai su TEISINGAIS tipais - naudojama keliuose testuose žemiau, kad nereikėtų kartoti tų pačių assert'ų.
def assert_invoiceout_fields(data):
    expected_fields = [
        "invoice_id", "order_id", "kliento_id", "total",
        "invoice_date", "status", "client_first_name", "client_last_name", "links",
    ]
    for field in expected_fields:
        assert field in data, f"Trūksta lauko: {field}"

    assert isinstance(data["invoice_id"], int)
    assert isinstance(data["order_id"], int)
    assert isinstance(data["kliento_id"], int)
    assert isinstance(data["total"], (float, int))
    assert isinstance(data["invoice_date"], str)
    assert isinstance(data["status"], str)
    assert isinstance(data["client_first_name"], str)
    assert isinstance(data["client_last_name"], str)
    assert isinstance(data["links"], list)


# Pagrindinis "laimingas kelias" - sąskaita sukuriama su TEISINGAIS duomenimis, kurie ateina IŠ užsakymo/kliento (JOIN), ne iš užklausos.
def test_create_invoice(example_invoice_data, auth_headers):
    response = client.post("/api/v1/invoices/", json=example_invoice_data, headers=auth_headers)
    assert response.status_code == 200, response.json()
    data = response.json()
    assert_invoiceout_fields(data)
    assert data["order_id"] == example_invoice_data["order_id"]
    assert float(data["total"]) == example_invoice_data["total"]
    assert data["invoice_date"] == example_invoice_data["invoice_date"]


# Vienas užsakymas gali turėti TIK VIENĄ sąskaitą (1:1, žr. invoice.py komentarą) - antras bandymas turi atmesti.
def test_create_invoice_duplicate_rejected(example_invoice_data, auth_headers):
    first = client.post("/api/v1/invoices/", json=example_invoice_data, headers=auth_headers)
    assert first.status_code == 200, first.json()

    second = client.post("/api/v1/invoices/", json=example_invoice_data, headers=auth_headers)
    assert second.status_code == 409


# Neegzistuojantis order_id turi grąžinti aiškų 404 PRIEŠ bandant įrašyti - regresijos testas realiam bug'ui (anksčiau sulūžo su 500, žr. invoice.py).
def test_create_invoice_order_not_found(auth_headers):
    resp = client.post(
        "/api/v1/invoices/",
        json={"order_id": 999999, "total": 10.0, "invoice_date": "2024-06-01"},
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Užsakymas nerastas"


# Bandymas ištrinti NEEGZISTUOJANČIĄ sąskaitą turi grąžinti aiškų 404.
def test_delete_invoice_not_found(auth_headers):
    resp = client.delete("/api/v1/invoices/999999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Sąskaita nerasta"


# Patikrina, kad sąrašas grąžina sąrašą, ir (jei netuščias) kiekvienas elementas turi VISUS InvoiceOut laukus.
def test_get_all_invoices(auth_headers):
    response = client.get("/api/v1/invoices/", headers=auth_headers)
    assert response.status_code == 200, response.json()
    invoices = response.json()
    assert isinstance(invoices, list)
    if invoices:
        assert_invoiceout_fields(invoices[0])


# Pilnas kūrimo-ištrynimo ciklas VIENAME teste - sukurta sąskaita realiai DINGSTA iš sąrašo po ištrynimo.
def test_delete_invoice(prepared_order, auth_headers):
    invoice_resp = client.post(
        "/api/v1/invoices/",
        json={"order_id": prepared_order, "total": 77.7, "invoice_date": "2024-06-01"},
        headers=auth_headers,
    )
    assert invoice_resp.status_code == 200, invoice_resp.json()
    invoice_id = invoice_resp.json()["invoice_id"]

    del_resp = client.delete(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["detail"] == "Invoice deleted"

    get_resp = client.get("/api/v1/invoices/", headers=auth_headers)
    ids = [inv["invoice_id"] for inv in get_resp.json()]
    assert invoice_id not in ids
