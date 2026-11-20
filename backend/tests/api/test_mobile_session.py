"""Kliento sesijos taisyklės, kuriomis remiasi mobilioji programėlė (tokeno galiojimas, tipas, atšaukimas)."""
import base64
import json
from datetime import datetime, timedelta, timezone

from jose import jwt

from app.models.client import Client
from app.services.auth_service import ALGORITHM, SECRET_KEY
from tests.helpers import API, CUSTOMER_PASSWORD, register_customer

OTHER_KEY = "svetimas-raktas-svetimas-raktas-123456"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _token(payload: dict, key: str = SECRET_KEY, algorithm: str = ALGORITHM) -> str:
    return jwt.encode(payload, key, algorithm=algorithm)


def _me(client, token: str):
    return client.get(f"{API}/customer/me", headers={"Authorization": f"Bearer {token}"})


# Pretenzijos, kurias get_current_customer priima: ver imamas iš testinio kliento eilutės.
def _valid_claims(db_session, customer: dict) -> dict:
    row = db_session.query(Client).filter_by(kliento_id=customer["kliento_id"]).one()
    return {
        "sub": str(row.kliento_id),
        "type": "customer",
        "ver": row.token_version,
        "exp": _now() + timedelta(hours=1),
    }


def _b64url_json(value: dict) -> str:
    raw = json.dumps(value, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def test_customer_token_is_issued_for_one_hour_from_now(client):
    before = int(_now().timestamp())
    customer = register_customer(client)
    after = int(_now().timestamp())

    claims = jwt.get_unverified_claims(customer["token"])
    # iat saugomas sveikomis sekundėmis, todėl leidžiama vienos sekundės paklaida.
    assert before - 1 <= claims["iat"] <= after + 1
    assert claims["exp"] - claims["iat"] == 60 * 60
    assert claims["type"] == "customer"
    assert claims["sub"] == str(customer["kliento_id"])


def test_expired_token_is_rejected_by_customer_me(client, db_session):
    customer = register_customer(client)
    claims = _valid_claims(db_session, customer)
    assert _me(client, _token(claims)).status_code == 200

    expired = {**claims, "exp": _now() - timedelta(seconds=5)}
    assert _me(client, _token(expired)).status_code == 401


def test_token_signed_with_other_key_is_rejected_by_customer_me(client, db_session):
    customer = register_customer(client)
    claims = _valid_claims(db_session, customer)
    assert _me(client, _token(claims)).status_code == 200

    assert _me(client, _token(claims, key=OTHER_KEY)).status_code == 401


def test_alg_none_token_is_rejected_by_customer_me(client, db_session):
    customer = register_customer(client)
    signed = _token(_valid_claims(db_session, customer))
    assert _me(client, signed).status_code == 200

    # Tas pats turinys, pakeista tik antraštė į alg:none – be parašo ir su originaliu parašu.
    _, body, signature = signed.split(".")
    none_header = _b64url_json({"alg": "none", "typ": "JWT"})
    assert _me(client, f"{none_header}.{body}.").status_code == 401
    assert _me(client, f"{none_header}.{body}.{signature}").status_code == 401


def test_staff_type_token_is_rejected_by_customer_me(client, db_session):
    customer = register_customer(client)
    claims = _valid_claims(db_session, customer)
    assert _me(client, _token(claims)).status_code == 200

    assert _me(client, _token({**claims, "type": "staff"})).status_code == 401


def test_staff_token_is_rejected_by_customer_me_and_reservations(client, auth_headers):
    # Kontrolė: tas pats darbuotojo tokenas priimamas darbuotojų endpointe.
    assert client.get(f"{API}/clients/", headers=auth_headers).status_code == 200

    assert client.get(f"{API}/customer/me", headers=auth_headers).status_code == 401
    assert client.get(f"{API}/customer/reservations", headers=auth_headers).status_code == 401


def test_customer_token_is_rejected_by_staff_clients_and_reservations(client):
    customer = register_customer(client)
    # Kontrolė: tas pats kliento tokenas priimamas kliento endpointe.
    assert client.get(f"{API}/customer/reservations", headers=customer["headers"]).status_code == 200

    assert client.get(f"{API}/clients/", headers=customer["headers"]).status_code == 401
    assert client.get(f"{API}/reservations/", headers=customer["headers"]).status_code == 401


def test_token_version_bump_revokes_session(client, db_session):
    customer = register_customer(client)
    assert _me(client, customer["token"]).status_code == 200

    row = db_session.query(Client).filter_by(kliento_id=customer["kliento_id"]).one()
    row.token_version += 1
    db_session.commit()

    assert _me(client, customer["token"]).status_code == 401


def test_missing_token_is_rejected_by_customer_me_and_reservations(client):
    assert client.get(f"{API}/customer/me").status_code == 401
    assert client.get(f"{API}/customer/reservations").status_code == 401


def test_profile_response_has_no_password_or_token_version(client):
    customer = register_customer(client)
    resp = _me(client, customer["token"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["kliento_id"] == customer["kliento_id"]
    assert "slaptazodis" not in body
    assert "token_version" not in body


def test_login_returns_token_accepted_by_customer_me(client):
    customer = register_customer(client)
    resp = client.post(f"{API}/customer/login", json={"el_pastas": customer["email"], "slaptazodis": CUSTOMER_PASSWORD})
    assert resp.status_code == 200
    me = _me(client, resp.json()["access_token"])
    assert me.status_code == 200
    assert me.json()["kliento_id"] == customer["kliento_id"]


def test_login_error_status_and_body_same_for_wrong_password_and_unknown_email(client):
    customer = register_customer(client)
    wrong_password = client.post(f"{API}/customer/login", json={"el_pastas": customer["email"], "slaptazodis": "Blogas12345"})
    unknown_email = client.post(f"{API}/customer/login", json={"el_pastas": "nera.tokio@example.com", "slaptazodis": "Blogas12345"})
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()
