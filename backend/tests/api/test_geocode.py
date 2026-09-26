import pytest


# geocode_address realiai kreiptųsi į IŠORINĮ OpenCage servisą internetu - testuose jis visada pakeičiamas (monkeypatch) fiktyvia funkcija, kad testai būtų greiti, stabilūs ir nepriklausytų nuo interneto/API rakto/kvotos.
@pytest.fixture
def mock_geocode_address(monkeypatch):
    # Grąžina funkciją, kurią testas iškviečia SU NORIMA reikšme (žr. naudojimą žemiau) - fixture PATI negali žinoti, ką konkretus testas norės gauti, tad šis "apgaubimo" sluoksnis leidžia tai nurodyti vėliau.
    def _apply(return_value):
        # Pakeičia TIKRĄ geocode_address šia - "async def", nes originali funkcija IR YRA async (žr. repositories/geocode.py).
        async def fake_geocode_address(adresas: str):
            return return_value
        monkeypatch.setattr("app.api.v1.endpoints.geocode.geocode_address", fake_geocode_address)
    return _apply


# Pagrindinis "laimingas kelias" - mockinta grąžinti FIKSUOTAS koordinates, patikrinamas TIKSLUS atsakymas (==, ne tik, kad laukai egzistuoja).
def test_geocode_success(client, auth_headers, mock_geocode_address):
    mock_geocode_address((54.6872, 25.2797))
    req = {"adresas": "Gedimino pr. 1, Vilnius"}
    resp = client.post("/api/v1/geocode/", json=req, headers=auth_headers)
    assert resp.status_code == 200, resp.json()
    assert resp.json() == {"lat": 54.6872, "lng": 25.2797}


# Mockinta grąžinti None (nerasta) - endpoint'as turi tai paversti aiškiu 404, ne tiesiog grąžinti tuščią/null atsakymą.
def test_geocode_address_not_found(client, auth_headers, mock_geocode_address):
    mock_geocode_address(None)
    req = {"adresas": "QWERTYUIOP1234567890, Marsas"}
    resp = client.post("/api/v1/geocode/", json=req, headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Koordinatės nerastos"


# Tuščia eilutė atmetama PAČIOS Pydantic schemos (Field(..., min_length=1), žr. schemas/geocode.py) - NIEKADA nepasiekia geocode_address, tad mock'o nereikia.
def test_geocode_empty_address(client, auth_headers):
    req = {"adresas": ""}
    resp = client.post("/api/v1/geocode/", json=req, headers=auth_headers)
    assert resp.status_code == 422


# Laukas "adresas" yra PRIVALOMAS (be numatytosios reikšmės) - visiškai praleistas turi atmesti lygiai taip, kaip ir tuščia eilutė aukščiau.
def test_geocode_missing_field(client, auth_headers):
    resp = client.post("/api/v1/geocode/", json={}, headers=auth_headers)
    assert resp.status_code == 422


# Endpoint'as priima TIK POST - GET tam pačiam keliui turi grąžinti standartinį FastAPI 405, ne 404.
def test_geocode_get_method_not_allowed(client, auth_headers):
    resp = client.get("/api/v1/geocode/", headers=auth_headers)
    assert resp.status_code == 405


# Be darbuotojo tokeno niekas negali kviesti šio endpoint'o - apsauga nuo svetimų, kurie bandytų išnaudoti OpenCage kvotą (žr. router'io Depends(get_current_user) endpoints/geocode.py faile).
def test_geocode_requires_authentication(client):
    resp = client.post("/api/v1/geocode/", json={"adresas": "Gedimino pr. 1, Vilnius"})
    assert resp.status_code == 401
