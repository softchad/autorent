import pytest

EMPLOYEE_SAMPLE = {
    "vardas": "Vardenis",
    "pavarde": "Pavardenis",
    "el_pastas": "employee.test@viko.lt",
    "slaptazodis": "Testas123!",
    "telefono_nr": "+37061111111",
    "pareigos": "Vadybininkas",
    "atlyginimas": 1200.50,
    "isidarbinimo_data": "2024-02-01",
}


# scope="module" - sukuriamas VIENĄ kartą, naudojamas KELIUOSE šio failo testuose (žr. test_get_all_employees/test_update_employee žemiau), savaime ištrinamas po VISŲ jį naudojančių testų.
@pytest.fixture(scope="module")
def created_employee_id(client, auth_headers):
    resp = client.post("/api/v1/employees/", json=EMPLOYEE_SAMPLE, headers=auth_headers)
    assert resp.status_code == 200, resp.json()
    emp = resp.json()
    yield emp["darbuotojo_id"]
    client.delete(f"/api/v1/employees/{emp['darbuotojo_id']}", headers=auth_headers)


# Pagrindinis "laimingas kelias" - SAVO sukurtą darbuotoją ištrina iš karto (ne naudoja created_employee_id), kad nepaliktų "našlaičio" įrašo kitiems testams.
def test_create_employee(client, auth_headers):
    data = EMPLOYEE_SAMPLE.copy()
    data["el_pastas"] = "employee.unique@viko.lt"
    resp = client.post("/api/v1/employees/", json=data, headers=auth_headers)
    assert resp.status_code == 200, resp.json()
    emp = resp.json()
    assert emp["el_pastas"] == data["el_pastas"]
    assert "links" in emp
    client.delete(f"/api/v1/employees/{emp['darbuotojo_id']}", headers=auth_headers)


# el_pastas yra VIENINTELIS laukas, kuris neturi savo field_validator'io EmployeeBase faile (EmailStr tipas pats validuoja formatą) - šis testas patikrina, kad jo PRALEIDIMAS vis tiek atmetamas.
def test_create_employee_missing_required(client, auth_headers):
    data = EMPLOYEE_SAMPLE.copy()
    data.pop("el_pastas")
    resp = client.post("/api/v1/employees/", json=data, headers=auth_headers)
    assert resp.status_code in (400, 422)


def test_create_employee_missing_telefono_nr(client, auth_headers):
    # telefono_nr database/schema.sql yra NOT NULL - API turi jį atmesti PRIEŠ bandant įrašyti į DB.
    data = EMPLOYEE_SAMPLE.copy()
    data["el_pastas"] = "employee.notel@viko.lt"
    data.pop("telefono_nr")
    resp = client.post("/api/v1/employees/", json=data, headers=auth_headers)
    assert resp.status_code == 422


# Patikrina, kad sąrašas grąžina VISUS darbuotojus IR kad KIEKVIENAS turi "links" lauką (HATEOAS nuorodas).
def test_get_all_employees(client, created_employee_id, auth_headers):
    resp = client.get("/api/v1/employees/", headers=auth_headers)
    assert resp.status_code == 200
    employees = resp.json()
    assert isinstance(employees, list)
    assert any(e["darbuotojo_id"] == created_employee_id for e in employees)
    assert all("links" in e for e in employees)


# Dalinis atnaujinimas (vardas+pavarde) - kiti laukai (el_pastas, pareigos...) turi LIKTI nepakitę.
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


# EmployeeUpdate PRIEŠ šį testą neturėjo vardas/pavarde/pareigos validatorių - bloga reikšmė įsirašytų į DB ir SULAUŽYTŲ atsakymo validaciją (EmployeeOut), vietoj aiškaus 422 čia pat.
@pytest.mark.parametrize("field,value", [
    ("vardas", "A"),
    ("pavarde", "B"),
    ("pareigos", "X"),
    ("atlyginimas", -100),
    ("slaptazodis", "short"),
])
def test_update_employee_rejects_invalid_values(client, created_employee_id, auth_headers, field, value):
    resp = client.put(f"/api/v1/employees/{created_employee_id}", json={field: value}, headers=auth_headers)
    assert resp.status_code == 422


# Darbuotojo kūrimo API turi atmesti netinkamą vardą, pavardę ir pareigas pagal EmployeeBase taisykles, kaip ir dalinio atnaujinimo kelias.
@pytest.mark.parametrize("field,value", [
    ("vardas", "A"),
    ("pavarde", "B"),
    ("pareigos", "X"),
])
def test_create_employee_rejects_invalid_values(client, auth_headers, field, value):
    data = EMPLOYEE_SAMPLE.copy()
    data["el_pastas"] = f"employee.invalid.{field}@viko.lt"
    data[field] = value
    resp = client.post("/api/v1/employees/", json=data, headers=auth_headers)
    assert resp.status_code == 422


# Bandymas atnaujinti NEEGZISTUOJANTĮ darbuotoją turi grąžinti aiškų 404, ne tyliai "nieko nedaryti".
def test_update_employee_not_found(client, auth_headers):
    resp = client.put("/api/v1/employees/999999", json={"vardas": "Fake"}, headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Darbuotojas nerastas"


# Pilnas kūrimo-ištrynimo ciklas VIENAME teste - sukurtas darbuotojas realiai DINGSTA iš DB.
def test_delete_employee(client, auth_headers):
    data = EMPLOYEE_SAMPLE.copy()
    data["el_pastas"] = "employee.delete@viko.lt"
    resp = client.post("/api/v1/employees/", json=data, headers=auth_headers)
    assert resp.status_code == 200
    emp_id = resp.json()["darbuotojo_id"]

    resp = client.delete(f"/api/v1/employees/{emp_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json().get("message") == "Employee deleted successfully"


# Bandymas ištrinti NEEGZISTUOJANTĮ darbuotoją turi grąžinti aiškų 404, ne sulūžti.
def test_delete_employee_not_found(client, auth_headers):
    resp = client.delete("/api/v1/employees/999999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Darbuotojas nerastas"


# el_pastas yra UNIQUE DB lygmeniu - antras bandymas sukurti darbuotoją tuo pačiu el. paštu turi atmesti aiškiu 409, ne sulūžti su 500 (žr. employee.py create_employee).
def test_create_employee_duplicate_email_rejected(client, auth_headers):
    data = EMPLOYEE_SAMPLE.copy()
    data["el_pastas"] = "employee.duplicate@viko.lt"
    first = client.post("/api/v1/employees/", json=data, headers=auth_headers)
    assert first.status_code == 200, first.json()
    emp_id = first.json()["darbuotojo_id"]

    second = client.post("/api/v1/employees/", json=data, headers=auth_headers)
    assert second.status_code == 409

    client.delete(f"/api/v1/employees/{emp_id}", headers=auth_headers)


# Admin'as keičia KITO darbuotojo slaptažodį (ADMIN_ONLY_FIELDS, žr. employee.py) - patikrina, kad naujas slaptažodis realiai BUVO užšifruotas ir priimamas prisijungiant, ne vien grąžintas 200, kuris pats savaime neparodo, ar hash'as tikrai teisingas.
def test_update_employee_password_by_admin_actually_works(client, auth_headers):
    data = EMPLOYEE_SAMPLE.copy()
    data["el_pastas"] = "employee.pwchange@viko.lt"
    created = client.post("/api/v1/employees/", json=data, headers=auth_headers)
    emp_id = created.json()["darbuotojo_id"]

    resp = client.put(
        f"/api/v1/employees/{emp_id}",
        json={"slaptazodis": "NaujasSlaptas456!"},
        headers=auth_headers,
    )
    assert resp.status_code == 200

    login_resp = client.post(
        "/api/v1/login", json={"el_pastas": data["el_pastas"], "slaptazodis": "NaujasSlaptas456!"}
    )
    assert login_resp.status_code == 200, login_resp.json()

    client.delete(f"/api/v1/employees/{emp_id}", headers=auth_headers)


# EDIT teisę turintis darbuotojas (Vadybininkas - NE administratorius) negali redaguoti KITO darbuotojo paskyros, net paprasto, ne-ADMIN_ONLY lauko - tik SAVO (žr. employee.py update_employee ownership patikrą).
def test_edit_role_employee_cannot_edit_other_employee(client, auth_headers):
    non_admin = EMPLOYEE_SAMPLE.copy()
    non_admin["el_pastas"] = "employee.editor@viko.lt"
    non_admin["pareigos"] = "Vadybininkas"
    resp = client.post("/api/v1/employees/", json=non_admin, headers=auth_headers)
    assert resp.status_code == 200, resp.json()
    editor_id = resp.json()["darbuotojo_id"]

    other = EMPLOYEE_SAMPLE.copy()
    other["el_pastas"] = "employee.victim@viko.lt"
    other_resp = client.post("/api/v1/employees/", json=other, headers=auth_headers)
    assert other_resp.status_code == 200, other_resp.json()
    other_id = other_resp.json()["darbuotojo_id"]

    login_resp = client.post("/api/v1/login", json={
        "el_pastas": non_admin["el_pastas"], "slaptazodis": non_admin["slaptazodis"],
    })
    assert login_resp.status_code == 200, login_resp.json()
    editor_headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    resp = client.put(
        f"/api/v1/employees/{other_id}",
        json={"telefono_nr": "+37060099999"},
        headers=editor_headers,
    )
    assert resp.status_code == 403

    client.delete(f"/api/v1/employees/{editor_id}", headers=auth_headers)
    client.delete(f"/api/v1/employees/{other_id}", headers=auth_headers)


# GET /employees/ reikalauja tik VIEW teisės (ją turi IR Vadybininkas/Mechanikas/Klientų aptarnavimas, ne tik administratorius) - NEadministratorius neturi matyti KOLEGŲ atlyginimo (žr. employee.py get_employees), bet SAVO - gali.
def test_get_employees_hides_salary_from_non_admin_except_own(client, auth_headers):
    viewer = EMPLOYEE_SAMPLE.copy()
    viewer["el_pastas"] = "employee.viewer@viko.lt"
    viewer["pareigos"] = "Mechanikas"
    viewer_resp = client.post("/api/v1/employees/", json=viewer, headers=auth_headers)
    assert viewer_resp.status_code == 200, viewer_resp.json()
    viewer_id = viewer_resp.json()["darbuotojo_id"]

    colleague = EMPLOYEE_SAMPLE.copy()
    colleague["el_pastas"] = "employee.colleague@viko.lt"
    colleague_resp = client.post("/api/v1/employees/", json=colleague, headers=auth_headers)
    assert colleague_resp.status_code == 200, colleague_resp.json()
    colleague_id = colleague_resp.json()["darbuotojo_id"]

    login_resp = client.post("/api/v1/login", json={
        "el_pastas": viewer["el_pastas"], "slaptazodis": viewer["slaptazodis"],
    })
    assert login_resp.status_code == 200, login_resp.json()
    viewer_headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    resp = client.get("/api/v1/employees/", headers=viewer_headers)
    assert resp.status_code == 200
    rows = {e["darbuotojo_id"]: e for e in resp.json()}
    assert rows[viewer_id]["atlyginimas"] == viewer["atlyginimas"]
    assert rows[colleague_id]["atlyginimas"] is None

    client.delete(f"/api/v1/employees/{viewer_id}", headers=auth_headers)
    client.delete(f"/api/v1/employees/{colleague_id}", headers=auth_headers)


# Nežinoma "pareigos" reikšmė (net jei >= 2 simboliai) turi atmesti 422 - kitaip has_perm (permissions.py) tyliai grąžintų tuščią teisių rinkinį be jokios klaidos (žr. schemas/employee.py validate_pareigos).
def test_create_employee_rejects_unknown_pareigos(client, auth_headers):
    data = EMPLOYEE_SAMPLE.copy()
    data["el_pastas"] = "employee.badrole@viko.lt"
    data["pareigos"] = "Direktorius"
    resp = client.post("/api/v1/employees/", json=data, headers=auth_headers)
    assert resp.status_code == 422


# Šio modulio testai dalijasi viena transakcija: po susieto darbuotojo trynimo IntegrityError atliekamas rollback panaikintų ir bendrus paruoštus įrašus, todėl šio kelio testui reikia atskiros sesijos.


# Vadybininkas (VIEW+EDIT) negali pats sau pasikeisti rolės į Administratorius per PUT - tik ADMIN_ONLY_FIELDS sąraše esantys laukai (employee.py) reikalauja administratoriaus teisės.
def test_edit_role_employee_cannot_self_promote(client, auth_headers):
    non_admin = EMPLOYEE_SAMPLE.copy()
    non_admin["el_pastas"] = "employee.nonadmin@viko.lt"
    non_admin["pareigos"] = "Vadybininkas"
    resp = client.post("/api/v1/employees/", json=non_admin, headers=auth_headers)
    assert resp.status_code == 200, resp.json()
    emp_id = resp.json()["darbuotojo_id"]

    login_resp = client.post("/api/v1/login", json={
        "el_pastas": non_admin["el_pastas"],
        "slaptazodis": non_admin["slaptazodis"],
    })
    assert login_resp.status_code == 200, login_resp.json()
    non_admin_headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    escalate_resp = client.put(
        f"/api/v1/employees/{emp_id}",
        json={"pareigos": "Administratorius"},
        headers=non_admin_headers,
    )
    assert escalate_resp.status_code == 403

    basic_update_resp = client.put(
        f"/api/v1/employees/{emp_id}",
        json={"vardas": "Pasikeitęs"},
        headers=non_admin_headers,
    )
    assert basic_update_resp.status_code == 200
    assert basic_update_resp.json()["vardas"] == "Pasikeitęs"

    client.delete(f"/api/v1/employees/{emp_id}", headers=auth_headers)


# Paskutinio administratoriaus vaidmens pakeitimas turi būti atmestas prieš įrašymą; conftest.py paruoštas vienintelis administratorius po užklausos turi išlaikyti administravimo teises.
def test_cannot_demote_last_administrator(client, auth_headers):
    admins = [e for e in client.get("/api/v1/employees/", headers=auth_headers).json() if e["pareigos"] == "Administratorius"]
    assert len(admins) == 1, "Šis testas prielaida - lygiai VIENAS administratorius šiuo metu."
    admin_id = admins[0]["darbuotojo_id"]

    resp = client.put(
        f"/api/v1/employees/{admin_id}",
        json={"pareigos": "Mechanikas"},
        headers=auth_headers,
    )
    assert resp.status_code == 409, resp.json()

    # Rolė realiai NEpasikeitė - sąrašas vis tiek rodo TĄ PATĮ VIENĄ administratorių.
    still_admins = [e for e in client.get("/api/v1/employees/", headers=auth_headers).json() if e["pareigos"] == "Administratorius"]
    assert len(still_admins) == 1


# Paskutinio administratoriaus ištrynimas turi būti atmestas prieš db.delete ir sandorio patvirtinimą, kad sistemoje liktų administravimo paskyra.
def test_unchanged_admin_email_does_not_revoke_own_session(client, auth_headers):
    me = client.get("/api/v1/me", headers=auth_headers)
    assert me.status_code == 200, me.text
    employee = me.json()
    response = client.put(f"/api/v1/employees/{employee['darbuotojo_id']}", headers=auth_headers,
                          json={"el_pastas": employee["el_pastas"], "vardas": employee["vardas"]})
    assert response.status_code == 200, response.text
    assert client.get("/api/v1/me", headers=auth_headers).status_code == 200


def test_cannot_delete_last_administrator(client, auth_headers):
    admins = [e for e in client.get("/api/v1/employees/", headers=auth_headers).json() if e["pareigos"] == "Administratorius"]
    assert len(admins) == 1, "Šis testas prielaida - lygiai VIENAS administratorius šiuo metu."
    admin_id = admins[0]["darbuotojo_id"]

    resp = client.delete(f"/api/v1/employees/{admin_id}", headers=auth_headers)
    assert resp.status_code == 409, resp.json()
