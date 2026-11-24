from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.services import cancellation_policy, rental_terms

PICKUP_DATE = date(2026, 12, 3)
# 12:00 Vilniuje žiemą = 10:00 UTC.
PICKUP_UTC = datetime(2026, 12, 3, 10, 0, tzinfo=timezone.utc)
RATE, TOTAL = Decimal("45.00"), Decimal("180.00")


def _evaluate(now, pickup_hour=12, rate=RATE, total=TOTAL, pickup_date=PICKUP_DATE):
    return cancellation_policy.evaluate(pickup_date, pickup_hour, rate, total, now)


def test_free_when_more_than_48_hours_left():
    outcome = _evaluate(PICKUP_UTC - timedelta(hours=72))
    assert (outcome.galima, outcome.nemokamai, outcome.mokestis) == (True, True, Decimal("0.00"))


def test_boundary_exactly_48_hours_is_still_free():
    outcome = _evaluate(PICKUP_UTC - timedelta(hours=48))
    assert outcome.nemokamai is True


def test_one_minute_inside_48_hours_costs_one_day():
    outcome = _evaluate(PICKUP_UTC - timedelta(hours=48) + timedelta(minutes=1))
    assert (outcome.galima, outcome.nemokamai, outcome.mokestis) == (True, False, Decimal("45.00"))


def test_fee_never_exceeds_reservation_total():
    outcome = _evaluate(PICKUP_UTC - timedelta(hours=5), rate=Decimal("45.00"), total=Decimal("30.00"))
    assert outcome.mokestis == Decimal("30.00")


def test_cannot_cancel_at_or_after_pickup_time():
    assert _evaluate(PICKUP_UTC).galima is False
    assert _evaluate(PICKUP_UTC + timedelta(hours=3)).galima is False


def test_free_until_moment_is_reported():
    outcome = _evaluate(PICKUP_UTC - timedelta(hours=72))
    assert outcome.nemokamai_iki == PICKUP_UTC - timedelta(hours=rental_terms.FREE_CANCELLATION_HOURS)


def test_later_pickup_hour_extends_free_period():
    now = PICKUP_UTC - timedelta(hours=45)
    assert _evaluate(now, pickup_hour=12).nemokamai is False
    assert _evaluate(now, pickup_hour=16).nemokamai is True


def test_web_reservation_without_hour_uses_earliest_pickup():
    with_hour = _evaluate(PICKUP_UTC - timedelta(hours=50), pickup_hour=12)
    without_hour = _evaluate(PICKUP_UTC - timedelta(hours=50), pickup_hour=None)
    assert with_hour == without_hour


def test_summer_time_pickup_is_one_hour_earlier_in_utc():
    # 2026-07-03 12:00 Vilniuje = 09:00 UTC. 48 val. riba – liepos 1 d. 09:00 UTC.
    summer_pickup = datetime(2026, 7, 3, 9, 0, tzinfo=timezone.utc)
    just_free = _evaluate(summer_pickup - timedelta(hours=48), pickup_date=date(2026, 7, 3))
    just_paid = _evaluate(summer_pickup - timedelta(hours=47, minutes=59), pickup_date=date(2026, 7, 3))
    assert (just_free.nemokamai, just_paid.nemokamai) == (True, False)


def test_48_hour_window_across_spring_clock_change_is_measured_in_real_hours():
    # Paėmimas 2027-03-29 12:00 (jau vasaros laikas, 09:00 UTC); laikrodis persuktas kovo 28 d.
    pickup = datetime(2027, 3, 29, 9, 0, tzinfo=timezone.utc)
    # Kovo 27 d. 12:00 Vilniuje (žiemos laikas, 10:00 UTC) iki paėmimo lieka 47 tikros valandos, ne 48.
    outcome = _evaluate(datetime(2027, 3, 27, 10, 0, tzinfo=timezone.utc), pickup_date=date(2027, 3, 29))
    assert round(outcome.valandu_iki_paemimo) == 47
    assert outcome.nemokamai is False
    assert pickup - timedelta(hours=48) == outcome.nemokamai_iki


def test_policy_numbers_come_from_terms(monkeypatch):
    monkeypatch.setattr(rental_terms, "FREE_CANCELLATION_HOURS", 24)
    assert _evaluate(PICKUP_UTC - timedelta(hours=30)).nemokamai is True
