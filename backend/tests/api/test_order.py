import pytest
from uuid import uuid4
from app.api.deps import get_db
from app.models import Location


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
def prepared_order(client, auth_headers, ensure_place_exists):
    """Sukuria lokaciją, automobilį, darbuotoją, klientą ir grąžina jų ID."""
    location_resp = client.post(
        "/api/v1/locations/",
        json={"pavadinimas": "Vilnius Centras", "adresas": "Gedimino pr. 1", "miestas": "Vilnius"},
        headers=auth_headers,
    )
    location_id = 1
    if location_resp.status_code in (200, 201):
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
    car_json = car_resp.json()
    car_id = car_json.get("automobilio_id") or car_json.get("id")
    assert car_id is not None, f"Nėra automobilio_id! car_resp: {car_json}"

    emp_resp = client.post(
        "/api/v1/employees/",
        json={
            "vardas": "Testas", "pavarde": "Darbuotojas",
            "el_pastas": f"darbuotojas{uuid4().hex[:6]}@viko.lt",
            "slaptazodis": "slaptas123!", "telefono_nr": "+37060000002",
            "pareigos": "Emplo", "atlyginimas": 1800.00, "isidarbinimo_data": "2023-01-01",
        },
        headers=auth_headers,
    )
    emp_json = emp_resp.json()
    emp_id = emp_json.get("darbuotojo_id") or emp_json.get("id")
    assert emp_id is not None, f"Nėra darbuotojo_id! emp_resp: {emp_json}"

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
    assert client_id is not None, f"Nėra kliento_id! client_resp: {resp_json}"

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
    order_json = order_resp.json()
    order_id = order_json.get("uzsakymo_id") or order_json.get("order_id")
    assert order_id is not None, f"Nėra uzsakymo_id! order_resp: {order_json}"

    return {"order_id": order_id, "client_id": client_id, "car_id": car_id, "emp_id": emp_id}


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
    assert resp.status_code in (400, 422)


def test_get_all_orders(client, auth_headers, prepared_order):
    resp = client.get("/api/v1/orders/", headers=auth_headers)
    assert resp.status_code == 200
    orders = resp.json()
    assert isinstance(orders, list)
    assert any(o["uzsakymo_id"] == prepared_order["order_id"] for o in orders)
    assert all("links" in o for o in orders)


def test_get_order_by_id(client, auth_headers, prepared_order):
    resp = client.get(f"/api/v1/orders/{prepared_order['order_id']}", headers=auth_headers)
    assert resp.status_code == 200
    order = resp.json()
    assert order["uzsakymo_id"] == prepared_order["order_id"]
    assert "links" in order
    assert order["kliento_id"] == prepared_order["client_id"]


def test_get_order_not_found(client, auth_headers):
    resp = client.get("/api/v1/orders/999999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Order not found"


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


def test_update_order_not_found(client, auth_headers):
    resp = client.put("/api/v1/orders/999999", json={"uzsakymo_busena": "atšaukta"}, headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Order not found"


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

    resp = client.get(f"/api/v1/orders/{order_id}", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_order_not_found(client, auth_headers):
    resp = client.delete("/api/v1/orders/999999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Order not found"


def test_get_orders_for_client(client, auth_headers, prepared_order):
    client_id = prepared_order["client_id"]
    resp = client.get(f"/api/v1/orders/by-client/{client_id}", headers=auth_headers)
    assert resp.status_code == 200
    orders = resp.json()
    assert isinstance(orders, list)
    if orders:
        assert "links" in orders[0]
