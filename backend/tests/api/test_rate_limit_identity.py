# login_identity_key (rate_limit.py) skaito PRIVAČIUS Starlette/FastAPI atributus (_body/_form), ne dokumentuotą API - jei ateities FastAPI/Starlette versija pakeistų, KADA kūnas cache'uojamas, "identity" tyliai taptų tuščias ir limitas GRĮŽTŲ prie vien IP (silpnesnis, be klaidos ar testo nulūžimo). Šis testas VERČIA tą mechanizmą realiai suveikti IR patikrina PAČIĄ naudotą raktą (per slowapi'o perspėjimo žinutę, žr. "caplog" žemiau) - ne vien tai, kad KOKS NORS limitas suveikė (IP-pagrįstas limitas BŪTŲ suveikęs vienodai, nepriklausomai nuo šito mechanizmo, nes TestClient visada naudoja TĄ PATĮ fiktyvų IP).
import logging

from app.rate_limit import limiter


# "limiter.enabled" conftest.py VISADA išjungtas likusiems testams (žr. ten) - šis testas jį LAIKINAI įjungia IR grąžina atgal "finally" bloke, kad kiti, šio failo NEsusiję testai neliktų netyčia apriboti.
def test_login_identity_key_json_body(client, caplog):
    limiter.enabled = True
    try:
        with caplog.at_level(logging.WARNING, logger="slowapi"):
            for _ in range(6):
                client.post("/api/v1/login", json={"el_pastas": "ratelimit.json@example.com", "slaptazodis": "wrong"})
        assert any("login-email:ratelimit.json@example.com" in r.message for r in caplog.records)
    finally:
        limiter.enabled = False


def test_login_identity_key_form_body(client, caplog):
    limiter.enabled = True
    try:
        with caplog.at_level(logging.WARNING, logger="slowapi"):
            for _ in range(6):
                client.post("/api/v1/token", data={"username": "ratelimit.form@example.com", "password": "wrong"})
        assert any("login-email:ratelimit.form@example.com" in r.message for r in caplog.records)
    finally:
        limiter.enabled = False


# Prisijungimo ribojimas turi atpažinti struktūrinius JSON turinio tipus su +json priesaga, kad paskyros bandymų limitas galiotų ir jiems, ne vien application/json.
def test_login_identity_key_structured_json_suffix(client, caplog):
    import json as jsonlib

    limiter.enabled = True
    try:
        body = jsonlib.dumps({"el_pastas": "ratelimit.suffix@example.com", "slaptazodis": "wrong"}).encode()
        with caplog.at_level(logging.WARNING, logger="slowapi"):
            for _ in range(6):
                client.post(
                    "/api/v1/login", content=body,
                    headers={"content-type": "application/vnd.autorent+json"},
                )
        assert any("login-email:ratelimit.suffix@example.com" in r.message for r in caplog.records)
    finally:
        limiter.enabled = False


# /token priima multipart/form-data ir application/x-www-form-urlencoded; abu formatai turi patekti į tą patį paskyros prisijungimo bandymų ribojimą.
def test_login_identity_key_multipart_body(client, caplog):
    limiter.enabled = True
    try:
        with caplog.at_level(logging.WARNING, logger="slowapi"):
            for _ in range(6):
                client.post(
                    "/api/v1/token",
                    files={"username": (None, "ratelimit.multipart@example.com"), "password": (None, "wrong")},
                )
        assert any("login-email:ratelimit.multipart@example.com" in r.message for r in caplog.records)
    finally:
        limiter.enabled = False
