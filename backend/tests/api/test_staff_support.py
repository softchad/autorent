# Darbuotojų pusės pagalbos pokalbių testai - /api/v1/support endpoint'ai (claim/reassign/RBAC).
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


# Sukuria darbuotoją su NURODYTOMIS pareigomis ir grąžina JO ID + Authorization antraštę - leidžia testams greitai gauti bet kokio vaidmens (Mechanikas/Vadybininkas/Klientų aptarnavimas/Administratorius) tokeną.
def _make_employee_headers(auth_headers, pareigos):
    email = f"staffsupport{uuid4().hex[:8]}@viko.lt"
    password = "Slaptas123!"
    resp = client.post(
        "/api/v1/employees/",
        json={
            "vardas": "Test", "pavarde": pareigos,
            "el_pastas": email, "slaptazodis": password,
            "telefono_nr": "+37060000050", "pareigos": pareigos,
            "atlyginimas": 1500.00, "isidarbinimo_data": "2023-01-01",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    employee_id = resp.json()["darbuotojo_id"]

    login = client.post("/api/v1/login", json={"el_pastas": email, "slaptazodis": password})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return employee_id, {"Authorization": f"Bearer {token}"}


# Užregistruoja NAUJĄ klientą ir jo vardu sukuria pokalbį su pirma žinute - grąžina TIK pokalbio_id, nes staff pusės testams kliento tokenas nebereikalingas.
def _make_conversation():
    email = f"staffsupporttest{uuid4().hex[:8]}@example.com"
    resp = client.post(
        "/api/v1/customer/register",
        json={
            "vardas": "Klientas", "pavarde": "Testas", "el_pastas": email,
            "telefono_nr": "+37061234567", "gimimo_data": "1995-01-01", "slaptazodis": "Testinis123!",
        },
    )
    customer_token = resp.json()["access_token"]
    convo = client.post(
        "/api/v1/customer/support/conversations",
        json={"tema": "Klausimas", "pranesimas": "Sveiki", "kategorija": "kita"},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert convo.status_code == 200, convo.text
    return convo.json()["pokalbio_id"]


# Mechanikas NĖRA SUPPORT_ROLES sąraše (žr. support_service.py) - require_support_access turi atmesti VISUS šio failo endpoint'us jam, net paprastą sąrašo skaitymą.
def test_mechanikas_cannot_access_support(auth_headers):
    _, mech_headers = _make_employee_headers(auth_headers, "Mechanikas")
    resp = client.get("/api/v1/support/conversations", headers=mech_headers)
    assert resp.status_code == 403


# Pagrindinis "laimingas kelias" aptarnavimo darbuotojui - gali matyti NEPRISKIRTAS bylas (filter=unassigned) IR jas prisiimti.
def test_support_role_can_list_and_claim(auth_headers):
    _, support_headers = _make_employee_headers(auth_headers, "Klientų aptarnavimas")
    pokalbio_id = _make_conversation()

    listing = client.get("/api/v1/support/conversations?filter=unassigned", headers=support_headers)
    assert listing.status_code == 200
    assert any(c["pokalbio_id"] == pokalbio_id for c in listing.json())

    claimed = client.post(f"/api/v1/support/conversations/{pokalbio_id}/claim", headers=support_headers)
    assert claimed.status_code == 200, claimed.text
    assert claimed.json()["darbuotojo_id"] is not None


# claim_conversation naudoja ATOMIC UPDATE ... WHERE darbuotojo_id IS NULL (žr. support_service.py) - antram darbuotojui, kuris pavėlavo, turi atmesti su 409, ne tyliai persirašyti pirmojo priskyrimą.
def test_second_claim_attempt_rejected(auth_headers):
    emp_a_id, headers_a = _make_employee_headers(auth_headers, "Klientų aptarnavimas")
    _, headers_b = _make_employee_headers(auth_headers, "Vadybininkas")
    pokalbio_id = _make_conversation()

    first = client.post(f"/api/v1/support/conversations/{pokalbio_id}/claim", headers=headers_a)
    assert first.status_code == 200

    second = client.post(f"/api/v1/support/conversations/{pokalbio_id}/claim", headers=headers_b)
    assert second.status_code == 409, second.text


# Klientų aptarnavimas NĖRA MANAGER_ROLES (tik Administratorius/Vadybininkas, žr. staff_support.py) - gali bylą PRISIIMTI sau (žr. claim aukščiau), bet ne PERSKIRTI kitam.
def test_reassign_requires_manager_role(auth_headers):
    target_id, _ = _make_employee_headers(auth_headers, "Klientų aptarnavimas")
    _, support_headers = _make_employee_headers(auth_headers, "Klientų aptarnavimas")
    pokalbio_id = _make_conversation()

    resp = client.post(
        f"/api/v1/support/conversations/{pokalbio_id}/reassign",
        json={"darbuotojo_id": target_id},
        headers=support_headers,
    )
    assert resp.status_code == 403


# Administratorius (MANAGER_ROLES) sėkmingai perskiria bylą KITAM aptarnavimo darbuotojui.
def test_reassign_success(auth_headers):
    target_id, _ = _make_employee_headers(auth_headers, "Vadybininkas")
    _, manager_headers = _make_employee_headers(auth_headers, "Administratorius")
    pokalbio_id = _make_conversation()

    resp = client.post(
        f"/api/v1/support/conversations/{pokalbio_id}/reassign",
        json={"darbuotojo_id": target_id},
        headers=manager_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["darbuotojo_id"] == target_id


# Negalima priskirti bylos darbuotojui, kuris IŠ VISO neturi aptarnavimo prieigos (Mechanikas) - jis net negalėtų bylos atsidaryti.
def test_reassign_to_non_support_employee_rejected(auth_headers):
    mech_id, _ = _make_employee_headers(auth_headers, "Mechanikas")
    _, manager_headers = _make_employee_headers(auth_headers, "Administratorius")
    pokalbio_id = _make_conversation()

    resp = client.post(
        f"/api/v1/support/conversations/{pokalbio_id}/reassign",
        json={"darbuotojo_id": mech_id},
        headers=manager_headers,
    )
    assert resp.status_code == 400


# Neegzistuojantis darbuotojo_id turi grąžinti aiškų 404, ne 400 (skirtingai nei "netinkama rolė" aukščiau - čia darbuotojas IŠ VISO nerastas).
def test_reassign_to_nonexistent_employee_rejected(auth_headers):
    _, manager_headers = _make_employee_headers(auth_headers, "Administratorius")
    pokalbio_id = _make_conversation()

    resp = client.post(
        f"/api/v1/support/conversations/{pokalbio_id}/reassign",
        json={"darbuotojo_id": 999999},
        headers=manager_headers,
    )
    assert resp.status_code == 404


# Vieno pokalbio detalė turi grąžinti VISAS žinutes (čia - 1, nes tik klientas rašė), ne tik santrauką.
def test_get_conversation_detail(auth_headers):
    _, support_headers = _make_employee_headers(auth_headers, "Klientų aptarnavimas")
    pokalbio_id = _make_conversation()

    resp = client.get(f"/api/v1/support/conversations/{pokalbio_id}", headers=support_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["pokalbio_id"] == pokalbio_id
    assert len(resp.json()["zinutes"]) == 1


# Tas pats darbuotojas pakartotinai "prisiima" SAVO bylą - tai NE konfliktas (skirtingai nei test_second_claim_attempt_rejected aukščiau, kur prisiima KITAS), tiesiog grąžina ją tokią, kokia yra.
def test_claim_by_same_employee_twice_is_idempotent(auth_headers):
    _, support_headers = _make_employee_headers(auth_headers, "Klientų aptarnavimas")
    pokalbio_id = _make_conversation()

    first = client.post(f"/api/v1/support/conversations/{pokalbio_id}/claim", headers=support_headers)
    assert first.status_code == 200

    second = client.post(f"/api/v1/support/conversations/{pokalbio_id}/claim", headers=support_headers)
    assert second.status_code == 200


# Bylą prisiėmė "owner" - "other" darbuotojas bando atsakyti į SVETIMĄ bylą, turi būti atmesta su 403 (žr. add_staff_message support_service.py faile).
def test_add_message_by_non_owner_rejected(auth_headers):
    _, owner_headers = _make_employee_headers(auth_headers, "Klientų aptarnavimas")
    _, other_headers = _make_employee_headers(auth_headers, "Vadybininkas")
    pokalbio_id = _make_conversation()

    claimed = client.post(f"/api/v1/support/conversations/{pokalbio_id}/claim", headers=owner_headers)
    assert claimed.status_code == 200

    resp = client.post(
        f"/api/v1/support/conversations/{pokalbio_id}/messages",
        json={"tekstas": "Bandau atsakyti", "busena": "sprendziama"},
        headers=other_headers,
    )
    assert resp.status_code == 403


# "busena" po atsakymo PRIVALO būti "sprendziama" arba "laukiama_kliento" (NEXT_STAFF_STATUSES) - bet koks kitas tekstas turi atmesti su 400.
def test_add_message_invalid_next_status_rejected(auth_headers):
    _, support_headers = _make_employee_headers(auth_headers, "Klientų aptarnavimas")
    pokalbio_id = _make_conversation()

    resp = client.post(
        f"/api/v1/support/conversations/{pokalbio_id}/messages",
        json={"tekstas": "Atsakymas", "busena": "neteisinga_busena"},
        headers=support_headers,
    )
    assert resp.status_code == 400


# Pilnas darbuotojo darbo srautas VIENAME teste (claim -> atsakymas -> vidinė pastaba -> sprendimas -> pažymėjimas matytu) - apjungia 4 endpoint'us, kad nereikėtų 4 atskirų testų vien kartojimui.
def test_full_staff_workflow_reply_note_resolve_seen(auth_headers):
    _, support_headers = _make_employee_headers(auth_headers, "Klientų aptarnavimas")
    pokalbio_id = _make_conversation()

    client.post(f"/api/v1/support/conversations/{pokalbio_id}/claim", headers=support_headers)

    reply = client.post(
        f"/api/v1/support/conversations/{pokalbio_id}/messages",
        json={"tekstas": "Atsakymas klientui", "busena": "sprendziama"},
        headers=support_headers,
    )
    assert reply.status_code == 200, reply.text
    assert reply.json()["busena"] == "sprendziama"

    note = client.post(
        f"/api/v1/support/conversations/{pokalbio_id}/notes",
        json={"tekstas": "Vidinė pastaba apie bylą"},
        headers=support_headers,
    )
    assert note.status_code == 200, note.text
    assert any("Vidinė pastaba" in n["tekstas"] for n in note.json()["pastabos"])

    resolved = client.post(
        f"/api/v1/support/conversations/{pokalbio_id}/resolve",
        json={"santrauka": "Klausimas išspręstas"},
        headers=support_headers,
    )
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["busena"] == "isspresta"

    last_msg_id = resolved.json()["zinutes"][-1]["zinutes_id"]
    seen = client.post(
        f"/api/v1/support/conversations/{pokalbio_id}/seen",
        json={"zinutes_id": last_msg_id},
        headers=support_headers,
    )
    assert seen.status_code == 200, seen.text


# Aptarnavimo darbuotojas gali išduoti kompensacijos kodą TO pokalbio klientui - kliento_id turi būti išvestas iš PAČIO pokalbio (žr. GenerateDiscountCodeRequest komentarą), ne iš užklausos kūno, kodas turi gautis "aptarnavimas" kilmės.
def test_issue_discount_code_for_conversation(auth_headers):
    _, support_headers = _make_employee_headers(auth_headers, "Klientų aptarnavimas")
    pokalbio_id = _make_conversation()

    resp = client.post(
        f"/api/v1/support/conversations/{pokalbio_id}/discount-code",
        json={"verte_eur": 10.0, "priezastis": "Atsiprašome dėl vėlavimo"},
        headers=support_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["kodas"].startswith("AUTORENT")
    assert body["kilme"] == "aptarnavimas"
    assert body["verte_eur"] == 10.0


# Mechanikas NĖRA aptarnavimo rolė - neturi galėti išduoti kompensacijos kodų, net jei žinotų pokalbio_id.
def test_issue_discount_code_requires_support_access(auth_headers):
    _, mech_headers = _make_employee_headers(auth_headers, "Mechanikas")
    pokalbio_id = _make_conversation()

    resp = client.post(
        f"/api/v1/support/conversations/{pokalbio_id}/discount-code",
        json={"verte_eur": 10.0, "priezastis": "Bandymas"},
        headers=mech_headers,
    )
    assert resp.status_code == 403


# "priezastis" yra darbuotojo VIDINĖ pastaba (žr. discount_code.py list_discount_codes "pastaba=None") - klientas savo PAČIO kodų sąraše NIEKADA neturi jos pamatyti, net jei kodas tikrai jo.
def test_issued_discount_code_reason_hidden_from_customer(auth_headers):
    _, support_headers = _make_employee_headers(auth_headers, "Klientų aptarnavimas")
    email = f"hiddenreason{uuid4().hex[:8]}@example.com"
    register = client.post(
        "/api/v1/customer/register",
        json={
            "vardas": "Klientas", "pavarde": "Testas", "el_pastas": email,
            "telefono_nr": "+37061234567", "gimimo_data": "1995-01-01", "slaptazodis": "Testinis123!",
        },
    )
    customer_token = register.json()["access_token"]
    customer_headers = {"Authorization": f"Bearer {customer_token}"}
    convo = client.post(
        "/api/v1/customer/support/conversations",
        json={"tema": "Klausimas", "pranesimas": "Sveiki", "kategorija": "kita"},
        headers=customer_headers,
    )
    pokalbio_id = convo.json()["pokalbio_id"]

    client.post(
        f"/api/v1/support/conversations/{pokalbio_id}/discount-code",
        json={"verte_eur": 10.0, "priezastis": "SLAPTA darbuotojo priežastis"},
        headers=support_headers,
    )

    codes = client.get("/api/v1/customer/discount-codes", headers=customer_headers).json()
    assert len(codes) == 1
    assert codes[0]["pastaba"] is None
