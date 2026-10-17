import pytest
from uuid import uuid4
from app.services import auth_service


# Patogumo pseudonimas - "admin_headers" skaitosi aiškiau šiame faile (lyginant su "emplo_headers" žemiau), nors realiai tai tas pats auth_headers, kurį sukuria conftest.py (Administratorius rolė).
@pytest.fixture(scope="module")
def admin_headers(auth_headers):
    return auth_headers


# Sukuria Vadybininko (ne Administratoriaus) rolės darbuotoją - leidžia testams patikrinti, KO šis vaidmuo NEGALI daryti, lyginant su admin_headers aukščiau.
@pytest.fixture(scope="module")
def emplo_headers(client, admin_headers):
    email = f"emplo_role_test_{uuid4().hex[:8]}@viko.lt"
    password = "EmploRole123!"

    create_resp = client.post(
        "/api/v1/employees/",
        headers=admin_headers,
        json={
            "vardas": "EmploRole", "pavarde": "Tester",
            "el_pastas": email, "telefono_nr": "+37060000999",
            "pareigos": "Vadybininkas", "atlyginimas": 1000,
            "isidarbinimo_data": "2024-01-01", "slaptazodis": password,
        },
    )
    assert create_resp.status_code == 200, create_resp.json()
    emp_id = create_resp.json()["darbuotojo_id"]

    # "sub" be "type" lauko - get_current_user tikrina TIK "type == 'customer'" (žr. deps.py), tad tokenas BE "type" (None) praeina kaip darbuotojo, nereikia tikro /login kelio. "sub" yra darbuotojo_id (ne el. paštas, žr. auth_service.create_staff_token) - "ver": 0 sutampa su ką tik sukurto darbuotojo numatytąja token_version reikšme.
    token = auth_service.create_access_token({"sub": str(emp_id), "ver": 0})
    headers = {"Authorization": f"Bearer {token}"}
    yield headers

    client.delete(f"/api/v1/employees/{emp_id}", headers=admin_headers)


# Administratorius (aukščiausia rolė) turi EDIT+ADMIN teises - gali kurti naujus darbuotojus.
def test_admin_can_create_employee(client, admin_headers):
    email = f"admin_create_emp_{uuid4().hex[:8]}@viko.lt"
    resp = client.post(
        "/api/v1/employees/",
        headers=admin_headers,
        json={
            "vardas": "AdminCreate", "pavarde": "Target",
            "el_pastas": email, "telefono_nr": "+37060000055",
            "pareigos": "Vadybininkas", "atlyginimas": 900,
            "isidarbinimo_data": "2024-01-01", "slaptazodis": "AdminCreate123!",
        },
    )
    assert resp.status_code == 200, resp.json()
    emp_id = resp.json()["darbuotojo_id"]
    client.delete(f"/api/v1/employees/{emp_id}", headers=admin_headers)


# Vadybininkas (be ADMIN teisės) NEGALI kurti naujų darbuotojų - require_perm(Perm.ADMIN) turi atmesti su 403 (tokenas GALIOJANTIS, tiesiog teisės nepakanka - ne 401).
def test_emplo_cannot_create_employee(client, emplo_headers):
    email = f"emplo_cannot_create_{uuid4().hex[:8]}@viko.lt"
    resp = client.post(
        "/api/v1/employees/",
        headers=emplo_headers,
        json={
            "vardas": "Forbidden", "pavarde": "Employee",
            "el_pastas": email, "telefono_nr": "+37060000066",
            "pareigos": "Vadybininkas", "atlyginimas": 800,
            "isidarbinimo_data": "2024-01-01", "slaptazodis": "NoRights123!",
        },
    )
    assert resp.status_code == 403


# Tas pats ADMIN apribojimas kaip aukščiau, bet ištrynimui - Vadybininkas negali trinti KITO darbuotojo, net jei tą darbuotoją sukūrė admin.
def test_emplo_cannot_delete_employee(client, admin_headers, emplo_headers):
    email = f"emplo_delete_target_{uuid4().hex[:8]}@viko.lt"
    create_resp = client.post(
        "/api/v1/employees/",
        headers=admin_headers,
        json={
            "vardas": "DeleteTarget", "pavarde": "ForEmplo",
            "el_pastas": email, "telefono_nr": "+37060000077",
            "pareigos": "Vadybininkas", "atlyginimas": 700,
            "isidarbinimo_data": "2024-01-01", "slaptazodis": "ToDelete123!",
        },
    )
    assert create_resp.status_code == 200, create_resp.json()
    emp_id = create_resp.json()["darbuotojo_id"]

    resp = client.delete(f"/api/v1/employees/{emp_id}", headers=emplo_headers)
    assert resp.status_code == 403

    client.delete(f"/api/v1/employees/{emp_id}", headers=admin_headers)


# Vadybininkas TURI bent VIEW teisę klientams - skirtingai nuo ADMIN veiksmų aukščiau, šitas turi PAVYKTI.
def test_emplo_can_list_clients(client, emplo_headers):
    resp = client.get("/api/v1/clients/", headers=emplo_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
