from datetime import date, datetime, timezone

import pytest

from app.services import booking_rules, clock
from app.services.booking_rules import BookingRuleError

TODAY = date(2026, 11, 24)


def _set_utc(monkeypatch, *args):
    monkeypatch.setattr(clock, "utc_now", lambda: datetime(*args, tzinfo=timezone.utc))


def test_today_vilnius_is_next_day_shortly_before_utc_midnight(monkeypatch):
    # 22:30 UTC žiemą = 00:30 Vilniuje kitą dieną.
    _set_utc(monkeypatch, 2026, 11, 24, 22, 30)
    assert booking_rules.today_vilnius() == date(2026, 11, 25)


def test_today_vilnius_uses_summer_offset(monkeypatch):
    # Vasarą Vilnius = UTC+3: 21:30 UTC jau yra kita diena.
    _set_utc(monkeypatch, 2026, 7, 10, 21, 30)
    assert booking_rules.today_vilnius() == date(2026, 7, 11)
    _set_utc(monkeypatch, 2026, 7, 10, 20, 30)
    assert booking_rules.today_vilnius() == date(2026, 7, 10)


def test_validate_period_returns_days():
    assert booking_rules.validate_period(date(2026, 11, 28), date(2026, 12, 2), TODAY) == 4


def test_period_may_start_today():
    assert booking_rules.validate_period(TODAY, date(2026, 11, 25), TODAY) == 1


@pytest.mark.parametrize(
    "date_from, date_to, code",
    [
        (date(2026, 11, 23), date(2026, 11, 26), "praeitis"),
        (date(2026, 11, 28), date(2026, 11, 28), "per_trumpa"),
        (date(2026, 11, 28), date(2026, 11, 27), "per_trumpa"),
        (date(2026, 11, 28), date(2026, 12, 29), "per_ilga"),
    ],
)
def test_invalid_periods(date_from, date_to, code):
    with pytest.raises(BookingRuleError) as error:
        booking_rules.validate_period(date_from, date_to, TODAY)
    assert error.value.code == code


def test_longest_allowed_period_is_exactly_max_days():
    assert booking_rules.validate_period(date(2026, 11, 28), date(2026, 12, 28), TODAY) == 30


def test_period_across_dst_change_counts_calendar_days():
    # 2027-03-28 Lietuvoje laikrodis persukamas valanda į priekį; parų skaičius nuo to nesikeičia.
    assert booking_rules.validate_period(date(2027, 3, 27), date(2027, 3, 29), date(2027, 3, 1)) == 2


@pytest.mark.parametrize("hour", [12, 15, 18])
def test_valid_pickup_hours(hour):
    assert booking_rules.validate_pickup_hour(hour) == hour


@pytest.mark.parametrize("hour", [0, 11, 19, 24, -1])
def test_invalid_pickup_hours(hour):
    with pytest.raises(BookingRuleError):
        booking_rules.validate_pickup_hour(hour)


def test_pickup_moment_winter_and_summer_offsets():
    winter = booking_rules.pickup_moment_utc(date(2026, 12, 1), 12)
    summer = booking_rules.pickup_moment_utc(date(2026, 7, 1), 12)
    assert winter == datetime(2026, 12, 1, 10, 0, tzinfo=timezone.utc)
    assert summer == datetime(2026, 7, 1, 9, 0, tzinfo=timezone.utc)


def test_pickup_moment_defaults_to_earliest_pickup_hour():
    assert booking_rules.pickup_moment_utc(date(2026, 12, 1), None) == datetime(2026, 12, 1, 10, 0, tzinfo=timezone.utc)


def test_buffer_between_return_and_pickup_is_at_least_two_hours():
    assert booking_rules.PICKUP_FROM_HOUR - booking_rules.RETURN_BY_HOUR >= 2


def test_rules_endpoint_is_public(client, monkeypatch):
    _set_utc(monkeypatch, 2026, 11, 24, 9, 0)
    resp = client.get("/api/v1/public/booking-rules")
    assert resp.status_code == 200
    assert resp.json() == {
        "siandien": "2026-11-24",
        "min_paru": 1,
        "max_paru": 30,
        "grazinimas_iki_val": 10,
        "paemimas_nuo_val": 12,
        "paemimas_iki_val": 18,
    }
