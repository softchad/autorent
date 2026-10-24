import pytest
from uuid import uuid4
from fastapi.testclient import TestClient

TEST_USER = {
    "vardas": "Testas",
    "pavarde": "Testavicius",
    "el_pastas": "test.auth@viko.lt",
    "slaptazodis": "Slaptas123!",
    "telefono_nr": "+37061234567",
    "pareigos": "Vadybininkas",
    "atlyginimas": 1000,
    "isidarbinimo_data": "2024-01-01"
}


@pytest.fixture(scope="module")
def create_test_user(client: TestClient, auth_headers):
    # Darbuotojo paskyra sukuriama VIENINTELIU būdu - per /employees/ (createEmployee), kuriam reikia ADMIN teisės lygiai taip pat, kaip ir pačiam endpoint'ui.
    resp = client.post("/api/v1/employees/", json=TEST_USER, headers=auth_headers)
    # 409 TOLERUOJAMAS - jei šis el. paštas JAU užregistruotas (pvz. iš ankstesnio testo paleidimo), tai NE klaida, tiesiog paskyra jau yra ir ja saugu naudotis toliau.
    assert resp.status_code in (200, 409)
    yield


def test_login_success(client, create_test_user):
    resp = client.post("/api/v1/login", json={
        "el_pastas": TEST_USER["el_pastas"],
        "slaptazodis": TEST_USER["slaptazodis"]
    })
    assert resp.status_code == 200
    res_json = resp.json()
    assert "access_token" in res_json
    assert len(res_json["access_token"]) > 10


def test_login_wrong_password(client):
    resp = client.post("/api/v1/login", json={
        "el_pastas": TEST_USER["el_pastas"],
        "slaptazodis": "netinkamasSlaptazodis"
    })
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Neteisingas el. paštas arba slaptažodis"


def test_login_nonexistent_user(client):
    resp = client.post("/api/v1/login", json={
        "el_pastas": "nesamas@viko.lt",
        "slaptazodis": "betkas"
    })
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Neteisingas el. paštas arba slaptažodis"


def test_me_endpoint_success(client, create_test_user):
    # Standartinis 2 žingsnių modelis, kartojamas visame šiame faile - PIRMA prisijungiame ir pasiimame tokeną, TADA jį naudojame kaip "Authorization" antraštę kitam kreipiniui.
    resp = client.post("/api/v1/login", json={
        "el_pastas": TEST_USER["el_pastas"],
        "slaptazodis": TEST_USER["slaptazodis"]
    })
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/me", headers=headers)
    assert resp.status_code == 200
    profile = resp.json()
    assert profile["el_pastas"] == TEST_USER["el_pastas"]


def test_me_endpoint_unauthorized(client):
    resp = client.get("/api/v1/me")
    assert resp.status_code == 401


def test_change_password_success(client, create_test_user):
    resp = client.post("/api/v1/login", json={
        "el_pastas": TEST_USER["el_pastas"],
        "slaptazodis": TEST_USER["slaptazodis"]
    })
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    new_pw = "NaujasSlaptazodis123!"

    resp = client.post("/api/v1/change-password", json={
        "senas_slaptazodis": TEST_USER["slaptazodis"],
        "naujas_slaptazodis": new_pw
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["message"] == "Password updated successfully"

    # Prisijungiama IŠ NAUJO su NAUJU slaptažodžiu - šis žingsnis patikrina, kad hash'as DB REALIAI pasikeitė, ne tik kad endpoint'as grąžino 200 (kuris pats savaime neparodo, ar DB įrašas iš tiesų atsinaujino).
    resp = client.post("/api/v1/login", json={
        "el_pastas": TEST_USER["el_pastas"],
        "slaptazodis": new_pw
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()

    # Slaptažodis atstatomas atgal į ORIGINALŲ - jei šis žingsnis tyliai nepavyktų, TEST_USER["slaptazodis"] nebeatitiktų tikro DB slaptažodžio ir KITI šio modulio testai (create_test_user vartotojai) sulūžtų neaiškiai, tad patikrinama aiškiai.
    resp = client.post("/api/v1/change-password", json={
        "senas_slaptazodis": new_pw,
        "naujas_slaptazodis": TEST_USER["slaptazodis"]
    }, headers={"Authorization": f"Bearer {resp.json()['access_token']}"})
    assert resp.status_code == 200, resp.text


def test_change_password_wrong_old_pw(client, create_test_user):
    resp = client.post("/api/v1/login", json={
        "el_pastas": TEST_USER["el_pastas"],
        "slaptazodis": TEST_USER["slaptazodis"]
    })
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post("/api/v1/change-password", json={
        "senas_slaptazodis": "blogas123",
        "naujas_slaptazodis": "NaujasSlaptazodis456!"
    }, headers=headers)
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Neteisingas dabartinis slaptažodis"


# JWT YRA BE SERVERIO BŪSENOS - "logout" NEGALI realiai "atšaukti" tokeno DB pusėje (jis tiesiog liktų galiojantis, kol pasibaigs jo laikas); šis endpoint'as tik grąžina patvirtinimą, kad FRONTEND'AS ištrintų tokeną iš SAVO atminties - serveris pats jo neseka ir negali "pamiršti".
# Tik per Google ar GitHub prisijungiančio darbuotojo slaptažodis bazėje yra NULL; /login ir /token turi atmesti slaptažodinį bandymą su 401, o ne bandyti tikrinti nesančią maišą.
def test_login_rejects_oauth_only_employee_cleanly(client, auth_headers, db_session):
    from app.models.employee import Employee
    from datetime import date

    oauth_only = Employee(
        vardas="OAuth", pavarde="Tik", el_pastas=f"oauthonly{uuid4().hex[:8]}@viko.lt",
        telefono_nr="+37060000111", pareigos="Mechanikas", atlyginimas=1000,
        isidarbinimo_data=date(2024, 1, 1), slaptazodis=None,
    )
    db_session.add(oauth_only)
    db_session.commit()

    resp = client.post("/api/v1/login", json={"el_pastas": oauth_only.el_pastas, "slaptazodis": "bandymas123"})
    assert resp.status_code == 401

    resp_token = client.post("/api/v1/token", data={"username": oauth_only.el_pastas, "password": "bandymas123"})
    assert resp_token.status_code == 401


def test_logout(client):
    resp = client.post("/api/v1/logout")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Successfully logged out"


def test_customer_token_rejected_by_staff_endpoint(client):
    resp = client.post("/api/v1/customer/register", json={
        "vardas": "Klientas", "pavarde": "Testas",
        "el_pastas": f"depstest{uuid4().hex[:8]}@example.com",
        "telefono_nr": "+37061234567", "gimimo_data": "1995-01-01",
        "slaptazodis": "Testinis123!",
    })
    customer_token = resp.json()["access_token"]

    # Kliento tokenas turi tiksliai tuos pačius "sub"/parašą kaip darbuotojo, bet KITĄ "type" - get_current_user tai turi atmesti, net jei el. paštas sutaptų.
    resp2 = client.get("/api/v1/me", headers={"Authorization": f"Bearer {customer_token}"})
    assert resp2.status_code == 401


def test_staff_token_rejected_by_customer_endpoint(client, create_test_user):
    resp = client.post("/api/v1/login", json={
        "el_pastas": TEST_USER["el_pastas"],
        "slaptazodis": TEST_USER["slaptazodis"],
    })
    staff_token = resp.json()["access_token"]

    resp2 = client.get("/api/v1/customer/me", headers={"Authorization": f"Bearer {staff_token}"})
    assert resp2.status_code == 401
