"""Alternatyvaus laikotarpio paieška ir panašių automobilių vertinimas."""
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta

from app.models.car import Car
from app.services import booking_rules

SEARCH_WINDOW_DAYS = 7
BODY_TYPE_POINTS = 3
TRANSMISSION_POINTS = 2
SEATS_POINTS = 1
MAX_SIMILAR_CARS = 3


@dataclass(frozen=True)
class SimilarCar:
    car: Car
    score: int
    reasons: tuple[str, ...]


def rank_similar_cars(reference: Car, candidates: Iterable[Car]) -> list[SimilarCar]:
    """Kvietėjas pateikia laisvus to paties padalinio automobilius; čia tik vertinamas panašumas."""
    matches = []
    for candidate in candidates:
        if candidate.automobilio_id == reference.automobilio_id:
            continue
        score = 0
        reasons = []
        for field, points in (
            ("kebulo_tipas", BODY_TYPE_POINTS),
            ("pavaru_deze", TRANSMISSION_POINTS),
            ("sedimos_vietos", SEATS_POINTS),
        ):
            if getattr(candidate, field) == getattr(reference, field):
                score += points
                reasons.append(field)
        if score:
            matches.append(SimilarCar(candidate, score, tuple(reasons)))

    return sorted(matches, key=lambda match: (-match.score, match.car.automobilio_id))[:MAX_SIMILAR_CARS]


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
            ordinal = date_from.toordinal() + shift
            if not today.toordinal() <= ordinal <= date.max.toordinal() - days:
                continue
            start = date.fromordinal(ordinal)
            end = start + duration
            if not any(start < busy_end and end > busy_start for busy_start, busy_end in ranges):
                return start, end

    return None
