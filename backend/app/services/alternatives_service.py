"""Artimiausio laisvo tokios pat trukmės laikotarpio paieška."""
from collections.abc import Iterable
from datetime import date, timedelta

from app.services import booking_rules

SEARCH_WINDOW_DAYS = 7


def nearest_free_period(
    date_from: date,
    date_to: date,
    busy_ranges: Iterable[tuple[date, date]],
    today: date,
) -> tuple[date, date] | None:
    days = booking_rules.validate_period(date_from, date_to, today)
    ranges = list(busy_ranges)
    duration = timedelta(days=days)

    # Vienodai nutolus pirmiausia siūlomas vėlesnis laikotarpis.
    for distance in range(SEARCH_WINDOW_DAYS + 1):
        shifts = (0,) if distance == 0 else (distance, -distance)
        for shift in shifts:
            start = date_from + timedelta(days=shift)
            if start < today:
                continue
            end = start + duration
            if not any(start < busy_end and end > busy_start for busy_start, busy_end in ranges):
                return start, end

    return None
