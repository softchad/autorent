import pytest


def test_geocode_success(client, auth_headers):
    req = {"adresas": "Gedimino pr. 1, Vilnius"}
    resp = client.post("/api/v1/geocode/", json=req, headers=auth_headers)
    assert resp.status_code == 200, resp.json()
    data = resp.json()
    assert "lat" in data and "lng" in data


def test_geocode_invalid_address(client, auth_headers):
    req = {"adresas": "QWERTYUIOP1234567890, Marsas"}
    resp = client.post("/api/v1/geocode/", json=req, headers=auth_headers)
    data = resp.json()

    # API gali grąžinti 200 arba 400/404 priklausomai nuo geocoding serviso
    assert resp.status_code in (200, 400, 404)

    if resp.status_code in (400, 404):
        detail = str(data.get("detail", ""))
        assert (
            "not found" in detail.lower()
            or "nepavyko" in detail.lower()
            or "koordinat" in detail.lower()
        )
    else:
        assert isinstance(data, dict)


def test_geocode_empty_address(client, auth_headers):
    req = {"adresas": ""}
    resp = client.post("/api/v1/geocode/", json=req, headers=auth_headers)
    assert resp.status_code in (400, 422)
    body = resp.json()
    assert isinstance(body, dict)
    assert "detail" in body or body != {}


def test_geocode_missing_field(client, auth_headers):
    resp = client.post("/api/v1/geocode/", json={}, headers=auth_headers)
    assert resp.status_code in (400, 422)
    resp_json = resp.json()
    assert "detail" in resp_json


def test_geocode_get_method_not_allowed(client, auth_headers):
    resp = client.get("/api/v1/geocode/", headers=auth_headers)
    assert resp.status_code == 405
