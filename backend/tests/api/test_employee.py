import pytest

EMPLOYEE_SAMPLE = {
    "vardas": "Vardenis",
    "pavarde": "Pavardenis",
    "el_pastas": "employee.test@viko.lt",
    "slaptazodis": "Testas123!",
    "telefono_nr": "+37061111111",
    "pareigos": "Testuotojas",
    "atlyginimas": 1200.50,
    "isidarbinimo_data": "2024-02-01",
}


@pytest.fixture(scope="module")
def created_employee_id(client, auth_headers):
    resp = client.post("/api/v1/employees/", json=EMPLOYEE_SAMPLE, headers=auth_headers)
    assert resp.status_code == 200, resp.json()
    emp = resp.json()
    yield emp["darbuotojo_id"]
    client.delete(f"/api/v1/employees/{emp['darbuotojo_id']}", headers=auth_headers)


def test_create_employee(client, auth_headers):
    data = EMPLOYEE_SAMPLE.copy()
    data["el_pastas"] = "employee.unique@viko.lt"
    resp = client.post("/api/v1/employees/", json=data, headers=auth_headers)
    assert resp.status_code == 200, resp.json()
    emp = resp.json()
    assert emp["el_pastas"] == data["el_pastas"]
    assert "links" in emp
    client.delete(f"/api/v1/employees/{emp['darbuotojo_id']}", headers=auth_headers)


def test_create_employee_missing_required(client, auth_headers):
    data = EMPLOYEE_SAMPLE.copy()
    data.pop("el_pastas")
    resp = client.post("/api/v1/employees/", json=data, headers=auth_headers)
    assert resp.status_code in (400, 422)


def test_get_all_employees(client, created_employee_id, auth_headers):
    resp = client.get("/api/v1/employees/", headers=auth_headers)
    assert resp.status_code == 200
    employees = resp.json()
    assert isinstance(employees, list)
    assert any(e["darbuotojo_id"] == created_employee_id for e in employees)
    assert all("links" in e for e in employees)


def test_get_employee_by_id(client, created_employee_id, auth_headers):
    resp = client.get(f"/api/v1/employees/{created_employee_id}", headers=auth_headers)
    assert resp.status_code == 200
    emp = resp.json()
    assert emp["darbuotojo_id"] == created_employee_id
    assert "links" in emp
    assert emp["vardas"] == EMPLOYEE_SAMPLE["vardas"]


def test_get_employee_not_found(client, auth_headers):
    resp = client.get("/api/v1/employees/999999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Employee not found"


def test_update_employee(client, created_employee_id, auth_headers):
    update_data = {"vardas": "Atnaujintas", "pavarde": "Darbuotojas"}
    resp = client.put(
        f"/api/v1/employees/{created_employee_id}",
        json=update_data,
        headers=auth_headers,
    )
    assert resp.status_code == 200
    emp = resp.json()
    assert emp["vardas"] == "Atnaujintas"
    assert emp["pavarde"] == "Darbuotojas"
    assert "links" in emp


def test_update_employee_not_found(client, auth_headers):
    resp = client.put("/api/v1/employees/999999", json={"vardas": "Fake"}, headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Employee not found"


def test_delete_employee(client, auth_headers):
    data = EMPLOYEE_SAMPLE.copy()
    data["el_pastas"] = "employee.delete@viko.lt"
    resp = client.post("/api/v1/employees/", json=data, headers=auth_headers)
    assert resp.status_code == 200
    emp_id = resp.json()["darbuotojo_id"]

    resp = client.delete(f"/api/v1/employees/{emp_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json().get("message") == "Employee deleted successfully"

    resp = client.get(f"/api/v1/employees/{emp_id}", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_employee_not_found(client, auth_headers):
    resp = client.delete("/api/v1/employees/999999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Employee not found"
