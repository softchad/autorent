"""Bendri pagalbininkai naujiems (mobiliosios programėlės) testams."""
from datetime import date, timedelta
from uuid import uuid4

from app.models.location import Location

API = "/api/v1"
CUSTOMER_PASSWORD = "Testinis123!"


def ensure_location(db_session, vietos_id: int = 1, miestas: str = "Vilnius") -> Location:
    vieta = db_session.query(Location).filter_by(vietos_id=vietos_id).first()
    if not vieta:
        vieta = Location(
            vietos_id=vietos_id,
            pavadinimas=f"{miestas} testas",
            adresas=f"Testo g. {vietos_id}, {miestas}",
            miestas=miestas,
        )
        db_session.add(vieta)
        db_session.commit()
    return vieta


# Sukuria automobilį per darbuotojų API; overrides leidžia pakeisti bet kurį lauką.
def make_car(client, auth_headers, **overrides) -> int:
    payload = {
        "marke": "Toyota",
        "modelis": "Corolla",
        "metai": 2022,
        "numeris": f"M{uuid4().hex[:5].upper()}",
        "vin_kodas": uuid4().hex[:17].upper(),
        "spalva": "Pilka",
        "kebulo_tipas": "Sedanas",
        "pavaru_deze": "automatinė",
        "variklio_turis": 1.8,
        "galia_kw": 103,
        "kuro_tipas": "hibridas",
        "rida": 20000,
        "sedimos_vietos": 5,
        "klimato_kontrole": True,
        "navigacija": True,
        "kaina_parai": 50.0,
        "automobilio_statusas": "laisvas",
        "technikines_galiojimas": "2030-12-31",
        "dabartine_vieta_id": 1,
        "pastabos": "Testinis automobilis",
    }
    payload.update(overrides)
    resp = client.post(f"{API}/cars/", json=payload, headers=auth_headers)
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["automobilio_id"]


# Užregistruoja naują klientą ir grąžina jo prisijungimo duomenis bei Authorization antraštę.
def register_customer(client, email: str | None = None) -> dict:
    email = email or f"mob{uuid4().hex[:10]}@example.com"
    resp = client.post(
        f"{API}/customer/register",
        json={
            "vardas": "Mobilus",
            "pavarde": "Klientas",
            "el_pastas": email,
            "telefono_nr": "+37061234567",
            "gimimo_data": "1995-01-01",
            "slaptazodis": CUSTOMER_PASSWORD,
        },
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    me_resp = client.get(f"{API}/customer/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200, me_resp.text
    me = me_resp.json()
    return {
        "email": email,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
        "kliento_id": me["kliento_id"],
    }


def days_from_today(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


# Tiesioginis įrašų kūrimas DB serviso lygio testams (be HTTP).
def db_client(db_session):
    from app.models.client import Client

    row = Client(
        vardas="Servisas",
        pavarde="Testas",
        el_pastas=f"srv{uuid4().hex[:10]}@example.com",
        telefono_nr="+37060000000",
        gimimo_data=date(1990, 1, 1),
    )
    db_session.add(row)
    db_session.commit()
    return row


def db_car(db_session, **overrides):
    from app.models.car import Car

    ensure_location(db_session, 1)
    values = dict(
        marke="Toyota", modelis="Corolla", metai=2022, numeris=f"S{uuid4().hex[:5].upper()}",
        vin_kodas=uuid4().hex[:17].upper(), spalva="Pilka", kebulo_tipas="Sedanas", pavaru_deze="automatinė",
        variklio_turis=1.8, galia_kw=103, kuro_tipas="hibridas", rida=20000, sedimos_vietos=5,
        klimato_kontrole=True, navigacija=True, kaina_parai=50, automobilio_statusas="laisvas",
        technikines_galiojimas=date(2030, 12, 31), dabartine_vieta_id=1,
    )
    values.update(overrides)
    row = Car(**values)
    db_session.add(row)
    db_session.commit()
    return row


# Fiksuoja „dabar“ visam naujam kodui (laikymai, taisyklės, atšaukimas).
def freeze_time(monkeypatch, moment):
    from app.services import clock

    monkeypatch.setattr(clock, "utc_now", lambda: moment)
    monkeypatch.setattr(clock, "utc_now_naive", lambda: moment.replace(tzinfo=None))
