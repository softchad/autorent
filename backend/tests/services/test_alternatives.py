from datetime import date, timedelta

import pytest

from app.services import alternatives_service, booking_rules

TODAY = date(2026, 12, 1)
START = date(2026, 12, 10)
END = date(2026, 12, 13)


def test_returns_requested_period_when_free():
    assert alternatives_service.nearest_free_period(START, END, [], TODAY) == (START, END)


def test_finds_nearest_later_period_with_same_duration():
    busy = [(START - timedelta(days=7), START + timedelta(days=1))]
    assert alternatives_service.nearest_free_period(START, END, busy, TODAY) == (
        date(2026, 12, 11), date(2026, 12, 14)
    )


def test_finds_nearest_earlier_period():
    busy = [(END - timedelta(days=1), END)]
    assert alternatives_service.nearest_free_period(START, END, busy, TODAY) == (
        date(2026, 12, 9), date(2026, 12, 12)
    )


def test_prefers_later_period_at_equal_distance():
    assert alternatives_service.nearest_free_period(START, END, [(START, END)], TODAY) == (
        END, date(2026, 12, 16)
    )


@pytest.mark.parametrize("direction", [-1, 1])
def test_includes_seven_day_boundary(direction):
    if direction == 1:
        busy = [(START - timedelta(days=20), START + timedelta(days=7))]
    else:
        busy = [(END - timedelta(days=7), END + timedelta(days=20))]
    shift = timedelta(days=direction * 7)
    assert alternatives_service.nearest_free_period(START, END, busy, TODAY) == (
        START + shift, END + shift
    )


def test_returns_none_when_only_dates_outside_window_are_free():
    busy = [(START - timedelta(days=7), START + timedelta(days=8))]
    assert alternatives_service.nearest_free_period(START, END, busy, TODAY) is None


def test_returns_none_when_dates_outside_window_on_both_sides_are_free():
    busy = [(START - timedelta(days=5), START + timedelta(days=8))]
    assert alternatives_service.nearest_free_period(START, END, busy, TODAY) is None


def test_does_not_offer_past_dates_but_allows_today():
    busy = [(date(2026, 12, 3), date(2026, 12, 30))]
    assert alternatives_service.nearest_free_period(
        date(2026, 12, 2), date(2026, 12, 4), busy, TODAY
    ) == (TODAY, date(2026, 12, 3))
    assert alternatives_service.nearest_free_period(
        date(2026, 12, 2), date(2026, 12, 4), busy, date(2026, 12, 2)
    ) is None


def test_allows_adjacent_bookings():
    busy = [(date(2026, 12, 1), START), (END, date(2026, 12, 20))]
    assert alternatives_service.nearest_free_period(START, END, busy, TODAY) == (START, END)


def test_checks_entire_period_with_unsorted_ranges_without_mutation():
    busy = [(date(2026, 12, 12), date(2026, 12, 20)), (TODAY, date(2026, 12, 11))]
    original = busy.copy()
    assert alternatives_service.nearest_free_period(START, END, busy, TODAY) is None
    assert busy == original


def test_reuses_generator_ranges_for_each_candidate():
    busy = ((start, end) for start, end in [(TODAY, date(2026, 12, 30))])
    assert alternatives_service.nearest_free_period(START, END, busy, TODAY) is None


def test_crosses_year_boundary():
    assert alternatives_service.nearest_free_period(
        date(2026, 12, 31), date(2027, 1, 3),
        [(date(2026, 12, 1), date(2027, 1, 1))], TODAY,
    ) == (date(2027, 1, 1), date(2027, 1, 4))


@pytest.mark.parametrize("start,end", [
    (date(2026, 11, 30), END),
    (START, START),
    (END, START),
    (START, START + timedelta(days=31)),
])
def test_applies_booking_period_rules(start, end):
    with pytest.raises(booking_rules.BookingRuleError):
        alternatives_service.nearest_free_period(start, end, [], TODAY)
