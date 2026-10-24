# Kliento registracijos, prisijungimo ir profilio redagavimo testai - /api/v1/customer/... endpoint'ai.
import pytest


# Pagalbinė funkcija - užregistruoja NAUJĄ klientą su numatytaisiais duomenimis (el. paštas pakeičiamas pagal poreikį, kad testai vienas kito neužblokuotų dėl UNIQUE apribojimo) ir grąžina JO JWT tokeną, kad kviečiantis testas galėtų iškart juo naudotis.
def _register(client, email="profilis.testas@example.com"):
    resp = client.post(
        "/api/v1/customer/register",
        json={
            "vardas": "Testas",
            "pavarde": "Testaitis",
            "el_pastas": email,
            "telefono_nr": "+37061112233",
            "gimimo_data": "1995-05-05",
            "slaptazodis": "Testinis123!",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


# Tikrina VISĄ grandinę - registracija IŠKART duoda tokeną (žr. customer_auth.py register), IR atskiras /login su TAIS PAČIAIS duomenimis taip pat veikia (patvirtina, kad slaptažodis realiai buvo užšifruotas ir išsaugotas teisingai, ne tik priimtas).
def test_customer_register_and_login(client):
    token = _register(client, "login.testas@example.com")
    assert token

    resp = client.post(
        "/api/v1/customer/login",
        json={"el_pastas": "login.testas@example.com", "slaptazodis": "Testinis123!"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["access_token"]


# El. paštas yra UNIQUE DB lygmeniu (žr. models/client.py) - registracija su JAU UŽIMTU el. paštu turi atmesti aiškiu 409, ne sulūžti.
def test_customer_register_duplicate_email_rejected(client):
    _register(client, "dublikatas@example.com")
    resp = client.post(
        "/api/v1/customer/register",
        json={
            "vardas": "Kitas",
            "pavarde": "Vartotojas",
            "el_pastas": "dublikatas@example.com",
            "telefono_nr": "+37064445566",
            "gimimo_data": "1990-01-01",
            "slaptazodis": "Testinis123!",
        },
    )
    assert resp.status_code == 409


# Keičiami 3 laukai VIENU PATCH kreipiniu - visi turi atsinaujinti IR sąsajos atsakyme, IR DB (patikrinta per atskirą GET /me žemiau).
def test_update_profile_name_phone_birthdate(client):
    token = _register(client, "profilis.vardas@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.patch(
        "/api/v1/customer/profile",
        json={"vardas": "Naujas", "telefono_nr": "+37069998877", "gimimo_data": "1992-03-03"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["vardas"] == "Naujas"
    assert body["telefono_nr"] == "+37069998877"
    assert body["gimimo_data"] == "1992-03-03"
    assert body["access_token"] is None  # el. paštas nepasikeitė - naujo tokeno nereikia

    me = client.get("/api/v1/customer/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["vardas"] == "Naujas"


# El. pašto pakeitimas yra VIENINTELIS atvejis, kuris išduoda NAUJĄ tokeną (žr. customer_auth.py update_profile) - šis testas patikrina abi puses: SENAS tokenas nebeveikia, NAUJAS veikia.
def test_update_profile_email_change_issues_new_token(client):
    old_email = "senas.pastas@example.com"
    new_email = "naujas.pastas@example.com"
    token = _register(client, old_email)
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.patch(
        "/api/v1/customer/profile",
        json={"el_pastas": new_email, "dabartinis_slaptazodis": "Testinis123!"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["el_pastas"] == new_email
    new_token = body["access_token"]
    assert new_token and new_token != token

    # Senas tokenas - JWT "sub" yra kliento_id (ne el. paštas, žr. auth_service.create_customer_token), tad id nepasikeitė, bet "ver" (token_version) PADIDĖJO el. pašto keitimo metu (žr. update_profile) - senas tokenas turi SENĄ "ver" ir yra ATŠAUKTAS (401), ne tiesiog "nerastas" (404).
    old_me = client.get("/api/v1/customer/me", headers=headers)
    assert old_me.status_code == 401

    new_me = client.get("/api/v1/customer/me", headers={"Authorization": f"Bearer {new_token}"})
    assert new_me.status_code == 200
    assert new_me.json()["el_pastas"] == new_email


# Bandoma pasikeisti el. paštą į KITO, jau registruoto kliento el. paštą - turi atmesti, net jei tas kitas klientas niekaip nedalyvauja šiame kreipinyje.
def test_update_profile_email_conflict_rejected(client):
    _register(client, "uzimtas@example.com")
    token = _register(client, "bandantis@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.patch(
        "/api/v1/customer/profile",
        json={"el_pastas": "uzimtas@example.com", "dabartinis_slaptazodis": "Testinis123!"},
        headers=headers,
    )
    assert resp.status_code == 409


# El. pašto keitimas be DABARTINIO slaptažodžio (arba su neteisingu) turi atmesti 400 - apsauga nuo pavogto/palikto atviro JWT, kuris pats VIENAS (nežinant slaptažodžio) negalėtų "persiregistruoti" paskyros ant kito el. pašto (žr. customer_auth.py update_profile).
def test_update_profile_email_change_requires_current_password(client):
    token = _register(client, "reikalaujaslaptazodzio@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    no_password = client.patch(
        "/api/v1/customer/profile",
        json={"el_pastas": "kitas.pastas@example.com"},
        headers=headers,
    )
    assert no_password.status_code == 400

    wrong_password = client.patch(
        "/api/v1/customer/profile",
        json={"el_pastas": "kitas.pastas@example.com", "dabartinis_slaptazodis": "NeteisingasSlaptazodis1!"},
        headers=headers,
    )
    assert wrong_password.status_code == 400

    # Kiti laukai (be el_pastas) VIS TIEK keičiami normaliai, slaptažodžio nereikalaujant.
    name_only = client.patch("/api/v1/customer/profile", json={"vardas": "Pakeistas"}, headers=headers)
    assert name_only.status_code == 200, name_only.text


# Pakeitus kliento el. paštą jo senas bilietas negali suteikti prieigos kitai paskyrai, panaudojusiai tą paštą; deps.py tapatybę tikrina pagal nekintantį ID ir token_version.
def test_old_token_does_not_resolve_to_new_account_after_email_reuse(client):
    token_a = _register(client, "reuse.a@example.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    resp = client.patch(
        "/api/v1/customer/profile",
        json={"el_pastas": "reuse.a.changed@example.com", "dabartinis_slaptazodis": "Testinis123!"},
        headers=headers_a,
    )
    assert resp.status_code == 200, resp.text

    # KITAS klientas dabar registruojasi SENU A el. paštu (jis "atlaisvintas").
    token_b_resp = client.post("/api/v1/customer/register", json={
        "vardas": "Kitas", "pavarde": "Klientas", "el_pastas": "reuse.a@example.com",
        "telefono_nr": "+37061112233", "gimimo_data": "1995-05-05", "slaptazodis": "Testinis123!",
    })
    assert token_b_resp.status_code == 200, token_b_resp.text

    # SENAS A tokenas NEGALI dabar atpažinti B paskyros - turi būti atšauktas (401), ne tyliai rodyti B duomenis.
    resp_old = client.get("/api/v1/customer/me", headers=headers_a)
    assert resp_old.status_code == 401


# Google patvirtintam savininkui susiejus slaptažodinę paskyrą, jos turimi bilietai turi būti atmesti per token_version, o slaptažodinis prisijungimas panaikintas.
def test_oauth_claim_revokes_prior_password_token(client, db_session):
    from app.api.endpoints.auth import _get_or_create_customer_token

    attacker_token = _register(client, "victim.oauth@example.com")
    attacker_headers = {"Authorization": f"Bearer {attacker_token}"}
    assert client.get("/api/v1/customer/me", headers=attacker_headers).status_code == 200

    _get_or_create_customer_token(db_session, "victim.oauth@example.com", "Tikrasis", "Savininkas", auth="google")

    resp = client.get("/api/v1/customer/me", headers=attacker_headers)
    assert resp.status_code == 401


# CustomerProfileUpdate turi SAVO kopiją validate_telefono (ta pati taisyklė kaip registracijoje) - šis patikrina, kad PATCH jos TAIP PAT nepraleidžia.
def test_update_profile_invalid_phone_rejected(client):
    token = _register(client, "trumpas.tel@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.patch("/api/v1/customer/profile", json={"telefono_nr": "123"}, headers=headers)
    assert resp.status_code == 422


def test_update_profile_rejects_too_short_vardas(client):
    # CustomerProfileUpdate turi SAVO kopiją validate_names (žr. test_register_rejects_invalid_values žemiau, kuris testuoja tą pačią taisyklę registracijai) - šis patikrina, kad PATCH TAIP PAT jos nepraleidžia.
    token = _register(client, "trumpas.vardas@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.patch("/api/v1/customer/profile", json={"vardas": "A"}, headers=headers)
    assert resp.status_code == 422


def test_update_profile_requires_customer_token(client):
    resp = client.patch("/api/v1/customer/profile", json={"vardas": "X"})
    assert resp.status_code == 401


# Sveiko proto patikra - niekas negali turėti gimimo datos ATEITYJE (žr. schemas/customer_auth.py validate_gimimo_data).
def test_register_rejects_future_birthdate(client):
    resp = client.post(
        "/api/v1/customer/register",
        json={
            "vardas": "Ateities", "pavarde": "Klientas",
            "el_pastas": "ateitis@example.com", "telefono_nr": "+37061112244",
            "gimimo_data": "2099-01-01", "slaptazodis": "Testinis123!",
        },
    )
    assert resp.status_code == 422


# bcrypt tyliai apdoroja TIK pirmus 72 baitus; slaptažodis, ilgesnis už šią ribą, turi būti ATMESTAS registracijos metu, ne tyliai nukarpytas (žr. schemas/customer_auth.py validate_slaptazodis).
def test_register_rejects_password_over_72_bytes(client):
    resp = client.post(
        "/api/v1/customer/register",
        json={
            "vardas": "Ilgas", "pavarde": "Slaptazodis",
            "el_pastas": "ilgas.slaptazodis@example.com", "telefono_nr": "+37061112255",
            "gimimo_data": "1995-01-01", "slaptazodis": "x" * 73,
        },
    )
    assert resp.status_code == 422


def test_update_profile_rejects_future_birthdate(client):
    # CustomerProfileUpdate turi SAVO kopiją gimimo_data validatoriaus (žr. schemas/customer_auth.py) - šis testas garantuoja, kad PATCH TIKRAI jį vykdo, ne tik registracija.
    token = _register(client, "ateitis.update@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.patch("/api/v1/customer/profile", json={"gimimo_data": "2099-01-01"}, headers=headers)
    assert resp.status_code == 422


@pytest.mark.parametrize("field,value", [
    ("slaptazodis", "short"),
    ("vardas", "A"),
    ("pavarde", "B"),
    ("telefono_nr", "123"),
])
def test_register_rejects_invalid_values(client, field, value):
    # CustomerRegisterRequest privalomų laukų patikros turi atmesti netinkamą registraciją prieš sukuriant paskyrą; vienu testu pateikiamos kelios neteisingos reikšmės.
    data = {
        "vardas": "Testas", "pavarde": "Testaitis", "el_pastas": f"invalid.{field}@example.com",
        "telefono_nr": "+37061112233", "gimimo_data": "1995-05-05", "slaptazodis": "Testinis123!",
    }
    data[field] = value
    resp = client.post("/api/v1/customer/register", json=data)
    assert resp.status_code == 422
