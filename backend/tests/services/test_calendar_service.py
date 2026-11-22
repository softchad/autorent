from datetime import date, datetime, timezone

import pytest

from app.models.car import Car
from app.models.client import Client
from app.services import calendar_service, hold_service
from tests.helpers import API, ensure_location, freeze_time, make_car, register_customer

TODAY = date(2026, 11, 25)
BOOKING = (date(2026, 12, 1), date(2026, 12, 5))


def _days(ranges, year=2026, month=12, today=TODAY):
    return {row["data"].day: row for row in calendar_service.build_month(year, month, ranges, today)}


def test_occupied_nights_exclude_return_day():
    nights = calendar_service.occupied_nights([BOOKING])
    assert nights == {date(2026, 12, 1), date(2026, 12, 2), date(2026, 12, 3), date(2026, 12, 4)}


def test_month_without_bookings_is_free():
    days = _days([])
    assert len(days) == 31
    assert all(row["busena"] == "laisva" for row in days.values())


def test_day_statuses_around_a_booking():
    days = _days([BOOKING])
    assert days[1]["busena"] == "dalinai"   # paėmimo diena: rytas laisvas
    assert days[2]["busena"] == "uzimta"
    assert days[4]["busena"] == "uzimta"
    assert days[5]["busena"] == "dalinai"   # grąžinimo diena: laisva nuo 12:00
    assert days[6]["busena"] == "laisva"


def test_start_and_end_permissions_around_a_booking():
    days = _days([BOOKING])
    # Paėmimo dieną kitas klientas gali tik grąžinti (baigti savo nuomą), bet ne pradėti.
    assert (days[1]["galima_pradeti"], days[1]["galima_baigti"]) == (False, True)
    assert (days[3]["galima_pradeti"], days[3]["galima_baigti"]) == (False, False)
    # Grąžinimo dieną kitas klientas gali pradėti, bet ne baigti.
    assert (days[5]["galima_pradeti"], days[5]["galima_baigti"]) == (True, False)


def test_back_to_back_bookings_make_turnover_day_busy():
    days = _days([BOOKING, (date(2026, 12, 5), date(2026, 12, 8))])
    assert days[5]["busena"] == "uzimta"
    assert (days[5]["galima_pradeti"], days[5]["galima_baigti"]) == (False, False)


def test_past_days_cannot_be_selected():
    days = _days([], month=11)
    assert days[24]["busena"] == "praeitis"
    assert (days[24]["galima_pradeti"], days[24]["galima_baigti"]) == (False, False)
    # Šiandien galima pradėti, bet baigti – tik nuo rytojaus (bent viena para).
    assert (days[25]["galima_pradeti"], days[25]["galima_baigti"]) == (True, False)


def test_booking_from_previous_month_affects_first_day():
    days = _days([(date(2026, 11, 28), date(2026, 12, 1))])
    assert days[1]["busena"] == "dalinai"
    assert days[1]["galima_baigti"] is False


def test_long_range_is_clipped_to_month_window(monkeypatch):
    original = calendar_service.occupied_nights
    window_from, window_to = date(2026, 11, 30), date(2027, 1, 1)

    # Patikra prieš originalią funkciją: neapkarpytas intervalas būtų iteruojamas per tūkstančius metų.
    def bounded_occupied_nights(ranges):
        assert all(window_from <= start and end <= window_to for start, end in ranges), ranges
        return original(ranges)

    monkeypatch.setattr(calendar_service, "occupied_nights", bounded_occupied_nights)
    days = _days([(date(2026, 1, 1), date(9999, 12, 31))])

    assert all(row["busena"] == "uzimta" for row in days.values())
    assert days[1]["galima_baigti"] is False
    assert days[31]["galima_pradeti"] is False


@pytest.mark.parametrize("year, month, length", [(2026, 2, 28), (2028, 2, 29), (2026, 11, 30)])
def test_month_lengths(year, month, length):
    assert len(calendar_service.build_month(year, month, [], date(2026, 1, 1))) == length


# ---- endpointas ----

NOW = datetime(2026, 11, 25, 9, 0, tzinfo=timezone.utc)


@pytest.fixture
def api_setup(db_session, monkeypatch):
    ensure_location(db_session, 1)
    freeze_time(monkeypatch, NOW)


def _calendar(client, car_id, **params):
    return client.get(f"{API}/public/cars/{car_id}/calendar", params={"metai": 2026, "menuo": 12, **params})


def test_calendar_endpoint_shows_reservation(client, auth_headers, api_setup):
    car_id, customer = make_car(client, auth_headers), register_customer(client)
    resp = client.post(
        f"{API}/customer/reservations",
        json={"automobilio_id": car_id, "date_from": "2026-12-01", "date_to": "2026-12-05"},
        headers=customer["headers"],
    )
    assert resp.status_code == 200, resp.text

    body = _calendar(client, car_id).json()

    statuses = {row["data"]: row["busena"] for row in body["dienos"]}
    assert body["siandien"] == "2026-11-25"
    assert statuses["2026-12-02"] == "uzimta"
    assert statuses["2026-12-05"] == "dalinai"
    assert statuses["2026-12-10"] == "laisva"


def test_calendar_endpoint_shows_active_hold(client, db_session, auth_headers, api_setup):
    car_id, customer = make_car(client, auth_headers), register_customer(client)
    row = db_session.query(Client).filter_by(kliento_id=customer["kliento_id"]).first()
    hold_service.create_hold(db_session, row, car_id, date(2026, 12, 10), date(2026, 12, 12))

    statuses = {day["data"]: day["busena"] for day in _calendar(client, car_id).json()["dienos"]}

    assert statuses["2026-12-10"] == "dalinai"
    assert statuses["2026-12-11"] == "uzimta"


@pytest.mark.parametrize("status", ["servise", "remonte"])
def test_calendar_shows_unbookable_car_as_busy(client, db_session, auth_headers, api_setup, status):
    car_id = make_car(client, auth_headers)
    db_session.query(Car).filter_by(automobilio_id=car_id).update({Car.automobilio_statusas: status})
    db_session.flush()

    resp = _calendar(client, car_id, menuo=11)

    assert resp.status_code == 200, resp.text
    days = {row["data"]: row for row in resp.json()["dienos"]}
    assert days["2026-11-24"]["busena"] == "praeitis"
    for key in ("2026-11-25", "2026-11-30"):
        assert (days[key]["busena"], days[key]["galima_pradeti"], days[key]["galima_baigti"]) == ("uzimta", False, False)


def test_calendar_endpoint_validates_input(client, auth_headers, api_setup):
    car_id = make_car(client, auth_headers)
    assert _calendar(client, car_id, menuo=13).status_code == 400
    assert _calendar(client, car_id, metai=2020).status_code == 400
    assert _calendar(client, car_id, metai=2040).status_code == 400
    assert _calendar(client, 999999).status_code == 404
    assert client.get(f"{API}/public/cars/{car_id}/calendar", params={"metai": "x", "menuo": 1}).status_code == 422


def test_calendar_does_not_reveal_who_booked(client, auth_headers, api_setup):
    car_id = make_car(client, auth_headers)
    day = _calendar(client, car_id).json()["dienos"][0]
    assert set(day) == {"data", "busena", "galima_pradeti", "galima_baigti"}
