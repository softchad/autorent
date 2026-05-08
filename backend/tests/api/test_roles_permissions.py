import pytest
from uuid import uuid4
from app.services import auth_service


@pytest.fixture(scope="module")
def admin_headers(auth_headers):
    return auth_headers


@pytest.fixture(scope="module")
def emplo_headers(client, admin_headers):
    """Sukuria Emplo darbuotoją ir grąžina jo JWT header."""
    email = f"emplo_role_test_{uuid4().hex[:8]}@viko.lt"
    password = "EmploRole123!"

    create_resp = client.post(
        "/api/v1/employees/",
        headers=admin_headers,
        json={
            "vardas": "EmploRole", "pavarde": "Tester",
            "el_pastas": email, "telefono_nr": "+37060000999",
            "pareigos": "Emplo", "atlyginimas": 1000,
            "isidarbinimo_data": "2024-01-01", "slaptazodis": password,
        },
    )
    assert create_resp.status_code in (200, 201), create_resp.json()
    emp = create_resp.json()
    emp_id = emp.get("darbuotojo_id") or emp.get("id")

    token = auth_service.create_access_token({"sub": email})
    headers = {"Authorization": f"Bearer {token}"}
    yield headers

    client.delete(f"/api/v1/employees/{emp_id}", headers=admin_headers)


def test_admin_can_create_employee(client, admin_headers):
    """Admin rolė gali kurti darbuotojus."""
    email = f"admin_create_emp_{uuid4().hex[:8]}@viko.lt"
    resp = client.post(
        "/api/v1/employees/",
        headers=admin_headers,
        json={
            "vardas": "AdminCreate", "pavarde": "Target",
            "el_pastas": email, "telefono_nr": "+37060000055",
            "pareigos": "Emplo", "atlyginimas": 900,
            "isidarbinimo_data": "2024-01-01", "slaptazodis": "AdminCreate123!",
        },
    )
    assert resp.status_code in (200, 201), resp.json()
    emp_id = resp.json().get("darbuotojo_id")
    client.delete(f"/api/v1/employees/{emp_id}", headers=admin_headers)


def test_emplo_cannot_create_employee(client, emplo_headers):
    """Emplo rolė neturi teisės kurti kitų darbuotojų."""
    email = f"emplo_cannot_create_{uuid4().hex[:8]}@viko.lt"
    resp = client.post(
        "/api/v1/employees/",
        headers=emplo_headers,
        json={
            "vardas": "Forbidden", "pavarde": "Employee",
            "el_pastas": email, "telefono_nr": "+37060000066",
            "pareigos": "Emplo", "atlyginimas": 800,
            "isidarbinimo_data": "2024-01-01", "slaptazodis": "NoRights123!",
        },
    )
    assert resp.status_code in (401, 403)


def test_emplo_cannot_delete_employee(client, admin_headers, emplo_headers):
    """Emplo rolė neturi teisės trinti darbuotojų."""
    email = f"emplo_delete_target_{uuid4().hex[:8]}@viko.lt"
    create_resp = client.post(
        "/api/v1/employees/",
        headers=admin_headers,
        json={
            "vardas": "DeleteTarget", "pavarde": "ForEmplo",
            "el_pastas": email, "telefono_nr": "+37060000077",
            "pareigos": "Emplo", "atlyginimas": 700,
            "isidarbinimo_data": "2024-01-01", "slaptazodis": "ToDelete123!",
        },
    )
    assert create_resp.status_code in (200, 201), create_resp.json()
    emp_id = create_resp.json()["darbuotojo_id"]

    resp = client.delete(f"/api/v1/employees/{emp_id}", headers=emplo_headers)
    assert resp.status_code in (401, 403)

    client.delete(f"/api/v1/employees/{emp_id}", headers=admin_headers)


def test_emplo_can_list_clients(client, emplo_headers):
    """Emplo turi turėti bent READ teises klientams."""
    resp = client.get("/api/v1/clients/", headers=emplo_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
