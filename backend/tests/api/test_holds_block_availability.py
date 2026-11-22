"""Aktyvus laikymas turi blokuoti automobilį visuose keliuose: svetainės rezervacija, darbuotojų portalas, katalogas, kalendorius."""
from datetime import date, datetime, time, timedelta, timezone

import pytest

from app.models.client import Client
from app.services import hold_service
from tests.helpers import API, ensure_location, freeze_time, make_car, register_customer

# Datos skaičiuojamos nuo tikros dienos, nes kliento rezervacijos schema ir busy-dates langas naudoja date.today().
BASE_DAY = date.today()
START = BASE_DAY + timedelta(days=7)
END = START + timedelta(days=4)
NOW = datetime.combine(BASE_DAY, time(9), tzinfo=timezone.utc)
FROM, TO = START.isoformat(), END.isoformat()


@pytest.fixture(autouse=True)
def setup(db_session, monkeypatch):
    ensure_location(db_session, 1)
    freeze_time(monkeypatch, NOW)


def _hold(db_session, customer, car_id):
    row = db_session.query(Client).filter_by(kliento_id=customer["kliento_id"]).first()
    return hold_service.create_hold(db_session, row, car_id, START, END)


def _web_reserve(client, customer, car_id):
    return client.post(
        f"{API}/customer/reservations",
        json={"automobilio_id": car_id, "date_from": FROM, "date_to": TO},
        headers=customer["headers"],
    )


def test_web_reservation_is_blocked_by_other_customers_hold(client, db_session, auth_headers):
    car_id = make_car(client, auth_headers)
    holder, other = register_customer(client), register_customer(client)
    _hold(db_session, holder, car_id)

    resp = _web_reserve(client, other, car_id)

    assert resp.status_code == 409


def test_own_hold_does_not_block_own_web_reservation(client, db_session, auth_headers):
    car_id = make_car(client, auth_headers)
    holder = register_customer(client)
    _hold(db_session, holder, car_id)

    resp = _web_reserve(client, holder, car_id)

    assert resp.status_code == 200, resp.text


def test_web_reservation_works_again_after_hold_expires(client, db_session, auth_headers, monkeypatch):
    car_id = make_car(client, auth_headers)
    holder, other = register_customer(client), register_customer(client)
    _hold(db_session, holder, car_id)

    freeze_time(monkeypatch, NOW + timedelta(minutes=hold_service.HOLD_MINUTES + 1))
    resp = _web_reserve(client, other, car_id)

    assert resp.status_code == 200, resp.text


def test_staff_reservation_is_blocked_by_hold(client, db_session, auth_headers):
    car_id = make_car(client, auth_headers)
    holder, other = register_customer(client), register_customer(client)
    _hold(db_session, holder, car_id)

    resp = client.post(
        f"{API}/reservations/",
        json={
            "kliento_id": other["kliento_id"], "automobilio_id": car_id,
            "rezervacijos_pradzia": FROM, "rezervacijos_pabaiga": TO, "busena": "patvirtinta",
        },
        headers=auth_headers,
    )

    assert resp.status_code == 409


def test_held_car_is_hidden_from_catalogue_for_those_dates(client, db_session, auth_headers):
    car_id = make_car(client, auth_headers)
    _hold(db_session, register_customer(client), car_id)

    listed = client.get(f"{API}/public/cars", params={"date_from": FROM, "date_to": TO}).json()
    other_dates = client.get(f"{API}/public/cars", params={
        "date_from": (START + timedelta(days=9)).isoformat(), "date_to": (START + timedelta(days=11)).isoformat(),
    }).json()

    assert car_id not in [car["automobilio_id"] for car in listed]
    assert car_id in [car["automobilio_id"] for car in other_dates]


def test_car_detail_reports_held_car_as_not_free(client, db_session, auth_headers):
    car_id = make_car(client, auth_headers)
    _hold(db_session, register_customer(client), car_id)

    body = client.get(f"{API}/public/cars/{car_id}", params={"date_from": FROM, "date_to": TO}).json()

    assert body["laisvas_pasirinktu_laikotarpiu"] is False


def test_busy_dates_include_held_days_only_while_hold_is_active(client, db_session, auth_headers, monkeypatch):
    car_id = make_car(client, auth_headers)
    _hold(db_session, register_customer(client), car_id)
    held_days = {(START + timedelta(days=offset)).isoformat() for offset in range((END - START).days)}

    during = set(client.get(f"{API}/public/cars/{car_id}/busy-dates").json()["busy_dates"])
    freeze_time(monkeypatch, NOW + timedelta(minutes=hold_service.HOLD_MINUTES + 1))
    after = set(client.get(f"{API}/public/cars/{car_id}/busy-dates").json()["busy_dates"])

    assert held_days <= during
    assert not (held_days & after)
