from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
import app.models  # noqa: F401 - registruoja visus modelius prieš create_all
from app.services import hold_service
from tests.helpers import API, ensure_location, freeze_time, make_car, register_customer

NOW = datetime(2026, 11, 25, 9, 0, tzinfo=timezone.utc)
PERIOD = {"date_from": "2026-12-01", "date_to": "2026-12-05"}


# Atskira šio modulio atminties bazė: create_hold po klaidos daro rollback, kuris bendroje conftest sesijoje
# atšauktų visą modulio transakciją kartu su darbuotojo paskyra. Modulio scope suderintas su client ir auth_headers.
@pytest.fixture(scope="module")
def db_session():
    engine = create_engine("sqlite:///:memory:", poolclass=StaticPool, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _foreign_keys(dbapi_connection, _):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    session = Session(engine)
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture(autouse=True)
def setup(db_session, monkeypatch):
    ensure_location(db_session, 1)
    freeze_time(monkeypatch, NOW)


def _create(client, customer, car_id, **period):
    return client.post(f"{API}/customer/holds", json={"automobilio_id": car_id, **(period or PERIOD)}, headers=customer["headers"])


def test_create_hold_returns_expiry_and_server_time(client, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers)

    resp = _create(client, customer, car_id)

    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["busena"] == "aktyvus"
    assert body["liko_sekundziu"] == hold_service.HOLD_MINUTES * 60
    assert body["serverio_laikas"] == "2026-11-25T09:00:00Z"
    assert body["galioja_iki"] == "2026-11-25T09:10:00Z"
    assert "kliento_id" not in body


def test_hold_requires_login(client, auth_headers):
    car_id = make_car(client, auth_headers)
    resp = client.post(f"{API}/customer/holds", json={"automobilio_id": car_id, **PERIOD})
    assert resp.status_code == 401


def test_staff_token_cannot_create_hold(client, auth_headers):
    car_id = make_car(client, auth_headers)
    resp = client.post(f"{API}/customer/holds", json={"automobilio_id": car_id, **PERIOD}, headers=auth_headers)
    assert resp.status_code == 401


def test_kliento_id_in_body_is_ignored(client, auth_headers):
    owner, victim, car_id = register_customer(client), register_customer(client), make_car(client, auth_headers)

    resp = client.post(
        f"{API}/customer/holds",
        json={"automobilio_id": car_id, "kliento_id": victim["kliento_id"], **PERIOD},
        headers=owner["headers"],
    )

    hold_id = resp.json()["laikymo_id"]
    assert client.get(f"{API}/customer/holds/{hold_id}", headers=owner["headers"]).status_code == 200
    assert client.get(f"{API}/customer/holds/{hold_id}", headers=victim["headers"]).status_code == 404


def test_second_customer_gets_conflict(client, auth_headers):
    first, second, car_id = register_customer(client), register_customer(client), make_car(client, auth_headers)
    _create(client, first, car_id)

    resp = _create(client, second, car_id)

    assert resp.status_code == 409
    assert "kitas klientas" in resp.json()["detail"]


def test_get_hold_counts_down(client, auth_headers, monkeypatch):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    hold_id = _create(client, customer, car_id).json()["laikymo_id"]

    freeze_time(monkeypatch, NOW + timedelta(minutes=4))
    body = client.get(f"{API}/customer/holds/{hold_id}", headers=customer["headers"]).json()

    assert body["liko_sekundziu"] == 6 * 60
    assert body["busena"] == "aktyvus"


def test_expired_hold_is_reported_as_expired(client, auth_headers, monkeypatch):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    hold_id = _create(client, customer, car_id).json()["laikymo_id"]

    freeze_time(monkeypatch, NOW + timedelta(minutes=hold_service.HOLD_MINUTES, seconds=1))
    body = client.get(f"{API}/customer/holds/{hold_id}", headers=customer["headers"]).json()

    assert body["busena"] == "pasibaiges"
    assert body["liko_sekundziu"] == 0


def test_expiry_boundary_matches_service_rule(client, auth_headers, monkeypatch):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    hold_id = _create(client, customer, car_id).json()["laikymo_id"]
    expiry = NOW + timedelta(minutes=hold_service.HOLD_MINUTES)

    freeze_time(monkeypatch, expiry - timedelta(milliseconds=500))
    resp = client.get(f"{API}/customer/holds/{hold_id}", headers=customer["headers"])
    assert resp.status_code == 200, resp.text
    assert (resp.json()["busena"], resp.json()["liko_sekundziu"]) == ("aktyvus", 1)

    freeze_time(monkeypatch, expiry)
    resp = client.get(f"{API}/customer/holds/{hold_id}", headers=customer["headers"])
    assert resp.status_code == 200, resp.text
    assert (resp.json()["busena"], resp.json()["liko_sekundziu"]) == ("pasibaiges", 0)


def test_other_customer_cannot_read_or_release_hold(client, auth_headers):
    owner, stranger, car_id = register_customer(client), register_customer(client), make_car(client, auth_headers)
    hold_id = _create(client, owner, car_id).json()["laikymo_id"]

    assert client.get(f"{API}/customer/holds/{hold_id}", headers=stranger["headers"]).status_code == 404
    assert client.delete(f"{API}/customer/holds/{hold_id}", headers=stranger["headers"]).status_code == 404
    # Laikymas liko aktyvus.
    assert client.get(f"{API}/customer/holds/{hold_id}", headers=owner["headers"]).json()["busena"] == "aktyvus"


def test_release_frees_car_for_others(client, auth_headers):
    first, second, car_id = register_customer(client), register_customer(client), make_car(client, auth_headers)
    hold_id = _create(client, first, car_id).json()["laikymo_id"]

    assert client.delete(f"{API}/customer/holds/{hold_id}", headers=first["headers"]).status_code == 204
    assert _create(client, second, car_id).status_code == 201


def test_limit_returns_429(client, auth_headers):
    customer = register_customer(client)
    for index in range(hold_service.MAX_ACTIVE_HOLDS_PER_CUSTOMER):
        start = datetime(2026, 12, 1) + timedelta(days=10 * index)
        period = {"date_from": start.date().isoformat(), "date_to": (start + timedelta(days=2)).date().isoformat()}
        assert _create(client, customer, make_car(client, auth_headers), **period).status_code == 201

    resp = _create(client, customer, make_car(client, auth_headers), date_from="2027-01-10", date_to="2027-01-12")

    assert resp.status_code == 429


@pytest.mark.parametrize(
    "period",
    [
        {"date_from": "2026-11-20", "date_to": "2026-11-28"},
        {"date_from": "2026-12-05", "date_to": "2026-12-01"},
        {"date_from": "2026-12-01", "date_to": "2027-02-01"},
    ],
)
def test_invalid_period_returns_400(client, auth_headers, period):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    assert _create(client, customer, car_id, **period).status_code == 400


def test_malformed_body_returns_422(client):
    customer = register_customer(client)
    resp = client.post(f"{API}/customer/holds", json={"automobilio_id": "abc", "date_from": "rytoj"}, headers=customer["headers"])
    assert resp.status_code == 422
