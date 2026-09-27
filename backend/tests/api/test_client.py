import pytest
import uuid


# Grąžina UNIKALŲ el. paštą kiekvienam kvietimui (uuid priedas) - el_pastas yra UNIQUE DB lygmeniu, tad be šito testai, paleisti kelis kartus tame pačiame module, susidurtų su "jau užregistruotas" klaida.
def unique_email():
    return f"{uuid.uuid4().hex[:8]}@test.lt"


CLIENT_SAMPLE = {
    "vardas": "Testas",
    "pavarde": "Kliūzas",
    "el_pastas": "client.test@viko.lt",
    "telefono_nr": "+37060000000",
    "gimimo_data": "1995-01-01",
    "registracijos_data": "2024-06-02T00:00:00",
}


# scope="module" - sukuriamas VIENĄ kartą, naudojamas KELIUOSE šio failo testuose (žr. test_get_all_clients žemiau), savaime ištrinamas po VISŲ jį naudojančių testų ("yield" + delete po jo).
@pytest.fixture(scope="module")
def created_client_id(client, auth_headers):
    resp = client.post("/api/v1/clients/", json=CLIENT_SAMPLE, headers=auth_headers)
    assert resp.status_code == 200, resp.json()
    client_obj = resp.json()
    yield client_obj["kliento_id"]
    client.delete(f"/api/v1/clients/{client_obj['kliento_id']}", headers=auth_headers)


# Pagrindinis "laimingas kelias" - visi privalomi laukai teisingi, klientas turi būti sukurtas. Savo SAVO sukurtą klientą ištrina iš karto (ne naudoja created_client_id), kad nepaliktų "našlaičio" įrašo.
def test_create_client(client, auth_headers):
    data = CLIENT_SAMPLE.copy()
    data["el_pastas"] = "client.unique@viko.lt"
    resp = client.post("/api/v1/clients/", json=data, headers=auth_headers)
    assert resp.status_code == 200
    obj = resp.json()
    assert obj["el_pastas"] == data["el_pastas"]
    assert "links" in obj
    client.delete(f"/api/v1/clients/{obj['kliento_id']}", headers=auth_headers)


# el_pastas yra VIENINTELIS laukas, kuris neturi savo field_validator'io ClientBase faile (EmailStr tipas pats validuoja) - šis testas patikrina, kad jo PRALEIDIMAS (ne tik neteisingas formatas) vis tiek atmetamas.
def test_create_client_missing_required(client, auth_headers):
    data = CLIENT_SAMPLE.copy()
    data.pop("el_pastas")
    resp = client.post("/api/v1/clients/", json=data, headers=auth_headers)
    assert resp.status_code in (400, 422)


# Šie 4 laukai database/schema.sql yra NOT NULL - API turi juos atmesti PRIEŠ bandant įrašyti į DB, ne tik el_pastas (žr. test_create_client_missing_required aukščiau).
@pytest.mark.parametrize("missing_field", ["vardas", "pavarde", "telefono_nr", "gimimo_data"])
def test_create_client_missing_other_required_fields(client, auth_headers, missing_field):
    data = CLIENT_SAMPLE.copy()
    data["el_pastas"] = f"missing.{missing_field}@viko.lt"
    data.pop(missing_field)
    resp = client.post("/api/v1/clients/", json=data, headers=auth_headers)
    assert resp.status_code == 422


# Patikrina, kad sąrašas grąžina VISUS klientus (ne vien paskutinį sukurtą) IR kad KIEKVIENAS turi "links" lauką (HATEOAS nuorodas).
def test_get_all_clients(client, created_client_id, auth_headers):
    resp = client.get("/api/v1/clients/", headers=auth_headers)
    assert resp.status_code == 200
    clients = resp.json()
    assert isinstance(clients, list)
    assert any(c["kliento_id"] == created_client_id for c in clients)
    assert all("links" in c for c in clients)


# Pilnas kūrimo-ištrynimo ciklas VIENAME teste - sukurtas klientas realiai DINGSTA iš DB (patikrinta per "ok": True atsakymą).
def test_delete_client(client, auth_headers):
    data = CLIENT_SAMPLE.copy()
    data["el_pastas"] = "client.delete@viko.lt"
    resp = client.post("/api/v1/clients/", json=data, headers=auth_headers)
    assert resp.status_code == 200
    cid = resp.json()["kliento_id"]

    resp = client.delete(f"/api/v1/clients/{cid}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


# Bandymas ištrinti NEEGZISTUOJANTĮ klientą turi grąžinti aiškų 404, ne tyliai "nieko nedaryti" ar sulūžti su neaiškia klaida.
def test_delete_client_not_found(client, auth_headers):
    resp = client.delete("/api/v1/clients/999999", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Klientas nerastas"


# ================================================================
# PUT testai - naudoja SAVO atskirą klientą (client_id/CLIENT_BASE), kad nesikirstų su CREATE/DELETE testais aukščiau (CLIENT_SAMPLE/created_client_id).
# ================================================================

CLIENT_BASE = {
    "vardas": "Tomas",
    "pavarde": "Testavičius",
    "telefono_nr": "+37060000099",
    "gimimo_data": "1990-06-15",
}


# ATSKIRA nuo created_client_id aukščiau - šiai sekcijai reikia SAVO kliento su UNIKALIU el. paštu (unique_email()), kad PUT testai nesikirstų su CREATE sekcijos duomenimis.
@pytest.fixture(scope="module")
def client_id(client, auth_headers):
    data = {**CLIENT_BASE, "el_pastas": unique_email()}
    resp = client.post("/api/v1/clients/", json=data, headers=auth_headers)
    assert resp.status_code == 200, resp.json()
    cid = resp.json()["kliento_id"]
    yield cid
    client.delete(f"/api/v1/clients/{cid}", headers=auth_headers)


# Dalinis atnaujinimas (TIK vardas) - kiti laukai (pavarde, el_pastas...) turi LIKTI nepakitę (exclude_unset=True client.py endpoint'e).
def test_update_client_vardas(client, client_id, auth_headers):
    resp = client.put(
        f"/api/v1/clients/{client_id}",
        json={"vardas": "Atnaujintas"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["vardas"] == "Atnaujintas"
    assert "links" in resp.json()


# Tas pats 404 patikrinimas kaip test_delete_client_not_found aukščiau, bet PUT keliui - abu endpoint'ai turi savo atskirą "ar klientas egzistuoja" patikrą.
def test_update_client_not_found(client, auth_headers):
    resp = client.put(
        "/api/v1/clients/999999",
        json={"vardas": "Niekas"},
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Klientas nerastas"


# ClientUpdate turi SAVO validatorių kopijas (ne paveldėtas iš ClientBase, žr. schemas/client.py) - šis testas garantuoja, kad PUT TIKRAI juos vykdo, ne tik POST.
@pytest.mark.parametrize("field,value", [
    ("vardas", "A"),
    ("pavarde", "B"),
    ("telefono_nr", "123"),
    ("el_pastas", "ne-el-pastas"),
])
def test_update_client_rejects_invalid_values(client, client_id, auth_headers, field, value):
    resp = client.put(f"/api/v1/clients/{client_id}", json={field: value}, headers=auth_headers)
    assert resp.status_code == 422


# Po VISŲ aukščiau atliktų PUT pakeitimų kliento ID TURI išlikti TAS PATS (atnaujinimas keičia LAUKUS, ne sukuria naują įrašą) - patikrina, kad jis vis tiek randamas sąraše.
def test_client_id_persists_after_update(client, client_id, auth_headers):
    resp = client.get("/api/v1/clients/", headers=auth_headers)
    assert resp.status_code == 200
    assert any(c["kliento_id"] == client_id for c in resp.json())


# PASTABA: šis testas TYČIA sudėtas PAČIAME GALE - jo IntegrityError/rollback kelias šio modulio bendroje transakcijoje nutrina VISŲ ANKSTESNIŲ šio failo testų duomenis (žr. analogišką pastabą test_car.py faile); po jo šiame faile daugiau testų NEberašoma.
def test_create_client_duplicate_email_rejected(client, auth_headers):
    data = CLIENT_SAMPLE.copy()
    data["el_pastas"] = "client.duplicate@viko.lt"
    first = client.post("/api/v1/clients/", json=data, headers=auth_headers)
    assert first.status_code == 200, first.json()

    second = client.post("/api/v1/clients/", json=data, headers=auth_headers)
    assert second.status_code == 409

# update_client lygiai tą pačią IntegrityError->409 logiką naudoja PUT kelyje (žr. client.py) - čia NEbandoma automatiniu testu dėl aukščiau paaiškintos transakcijų ribos; dar NEpatikrinta rankiniu būdu prieš tikrą MySQL DB, reikia padaryti prieš gynimą.
