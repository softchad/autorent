import pytest
from fastapi.testclient import TestClient
from app.main import app
from uuid import uuid4
from app.api.deps import get_db
from app.models import Location

client = TestClient(app)


@pytest.fixture(scope="module")
def ensure_place_exists():
    db = next(get_db())
    vieta = db.query(Location).filter_by(vietos_id=1).first()
    if not vieta:
        vieta = Location(
            vietos_id=1,
            pavadinimas="Testo vieta",
            adresas="Test gatvė 1",
            miestas="Vilnius",
        )
        db.add(vieta)
        db.commit()
    yield vieta


@pytest.fixture
def prepared_order(ensure_place_exists, auth_headers):
    """Sukuria lokaciją, automobilį, darbuotoją, klientą ir užsakymą testams."""
    location_resp = client.post(
        "/api/v1/locations/",
        json={"pavadinimas": "Vilnius Centras", "adresas": "Gedimino pr. 1", "miestas": "Vilnius"},
        headers=auth_headers,
    )
    location_id = 1
    if location_resp.status_code in [200, 201]:
        location_id = location_resp.json().get("vietos_id", 1)

    car_resp = client.post(
        "/api/v1/cars/",
        json={
            "marke": "Toyota", "modelis": "Corolla", "metai": 2021,
            "numeris": f"ABC{uuid4().hex[:3].upper()}", "vin_kodas": uuid4().hex[:16].upper(),
            "spalva": "Juoda", "kebulo_tipas": "Sedanas", "pavarų_deze": "automatinė",
            "variklio_turis": 1.6, "galia_kw": 97, "kuro_tipas": "benzinas",
            "rida": 15000, "sedimos_vietos": 5, "klimato_kontrole": True, "navigacija": True,
            "kaina_parai": 40.00, "automobilio_statusas": "laisvas",
            "technikines_galiojimas": "2025-12-31", "dabartine_vieta_id": location_id,
            "pastabos": "Testinis auto",
        },
        headers=auth_headers,
    )
    car_id = car_resp.json().get("automobilio_id") or car_resp.json().get("id")
    assert car_id is not None, f"Nėra automobilio_id! car_resp: {car_resp.json()}"

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
    emp_id = emp_resp.json().get("darbuotojo_id") or emp_resp.json().get("id")
    assert emp_id is not None, f"Nėra darbuotojo_id! emp_resp: {emp_resp.json()}"

    client_resp = client.post(
        "/api/v1/clients/",
        json={
            "vardas": "Testas", "pavarde": "Testavičius",
            "el_pastas": f"testas{uuid4().hex[:8]}@viko.lt",
            "telefono_nr": "+37060000000", "slaptazodis": "labaiSaugus123!",
            "gimimo_data": "2000-01-01", "registracijos_data": "2024-06-01", "bonus_taskai": 0,
        },
        headers=auth_headers,
    )
    resp_json = client_resp.json()
    client_id = (
        resp_json.get("kliento_id") or resp_json.get("client_id") or resp_json.get("id")
        or (resp_json.get("data", {}).get("kliento_id") if resp_json.get("data") else None)
    )
    assert client_id is not None, f"Nėra kliento_id! client_resp: {client_resp.json()}"

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
    order_id = order_resp.json().get("uzsakymo_id") or order_resp.json().get("order_id")
    assert order_id is not None, f"Nėra order_id! order_resp: {order_resp.json()}"
    return order_id


@pytest.fixture
def example_invoice_data(prepared_order):
    return {"order_id": prepared_order, "total": 123.45, "invoice_date": "2024-06-01"}


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


def test_create_invoice(example_invoice_data, auth_headers):
    response = client.post("/api/v1/invoices/", json=example_invoice_data, headers=auth_headers)
    assert response.status_code in [200, 201], response.json()
    data = response.json()
    assert_invoiceout_fields(data)
    assert data["order_id"] == example_invoice_data["order_id"]
    assert float(data["total"]) == example_invoice_data["total"]
    assert data["invoice_date"] == example_invoice_data["invoice_date"]


def test_get_all_invoices(auth_headers):
    response = client.get("/api/v1/invoices/", headers=auth_headers)
    assert response.status_code == 200, response.json()
    invoices = response.json()
    assert isinstance(invoices, list)
    if invoices:
        assert_invoiceout_fields(invoices[0])


def test_update_invoice_status(prepared_order, auth_headers):
    invoice_resp = client.post(
        "/api/v1/invoices/",
        json={"order_id": prepared_order, "total": 50.0, "invoice_date": "2024-06-01"},
        headers=auth_headers,
    )
    assert invoice_resp.status_code in [200, 201], invoice_resp.json()
    invoice_id = invoice_resp.json()["invoice_id"]

    update_resp = client.patch(
        f"/api/v1/invoices/{invoice_id}/status",
        json={"status": "apmokėta"},
        headers=auth_headers,
    )
    assert update_resp.status_code == 200, update_resp.json()
    data = update_resp.json()
    assert_invoiceout_fields(data)
    assert data["status"] in ["apmokėta", "patvirtinta"]


def test_delete_invoice(prepared_order, auth_headers):
    invoice_resp = client.post(
        "/api/v1/invoices/",
        json={"order_id": prepared_order, "total": 77.7, "invoice_date": "2024-06-01"},
        headers=auth_headers,
    )
    assert invoice_resp.status_code in [200, 201], invoice_resp.json()
    invoice_id = invoice_resp.json()["invoice_id"]

    del_resp = client.delete(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert del_resp.status_code in [200, 204], del_resp.json() if del_resp.content else None
    if del_resp.status_code == 200:
        assert del_resp.json()["detail"] == "Invoice deleted"

    get_resp = client.get("/api/v1/invoices/", headers=auth_headers)
    ids = [inv["invoice_id"] for inv in get_resp.json()]
    assert invoice_id not in ids
