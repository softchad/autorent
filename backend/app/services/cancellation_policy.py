"""Atšaukimo pasekmė: nemokamai ar su mokesčiu. Gryna logika – skaičiai imami iš nuomos sąlygų (rental_terms)."""
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from app.services import booking_rules, rental_terms


@dataclass(frozen=True)
class CancellationOutcome:
    # False – paėmimo laikas jau atėjo, programėlėje atšaukti nebegalima.
    galima: bool
    nemokamai: bool
    mokestis: Decimal
    valandu_iki_paemimo: float
    # Momentas (UTC), iki kurio atšaukimas nemokamas.
    nemokamai_iki: datetime


# Planuojama atšaukimo taisyklė (nuomos sąlygų tekste dar nepateikta):
#   iki paėmimo liko >= 48 val.  → nemokamai
#   liko mažiau, bet dar nepaimta → mokestis = 1 paros nuomos kaina (ne daugiau nei visa rezervacijos suma)
#   paėmimo laikas atėjo          → atšaukti negalima
def evaluate(
    pickup_date: date,
    pickup_hour: int | None,
    daily_rate: Decimal,
    total: Decimal,
    now_utc: datetime,
) -> CancellationOutcome:
    pickup = booking_rules.pickup_moment_utc(pickup_date, pickup_hour)
    hours_left = (pickup - now_utc).total_seconds() / 3600
    free_until = pickup - _hours(rental_terms.FREE_CANCELLATION_HOURS)

    if hours_left <= 0:
        return CancellationOutcome(False, False, Decimal("0.00"), hours_left, free_until)
    if hours_left >= rental_terms.FREE_CANCELLATION_HOURS:
        return CancellationOutcome(True, True, Decimal("0.00"), hours_left, free_until)

    fee = min(Decimal(daily_rate) * rental_terms.LATE_CANCELLATION_FEE_DAYS, Decimal(total))
    return CancellationOutcome(True, False, fee.quantize(Decimal("0.01")), hours_left, free_until)


def _hours(count: int):
    from datetime import timedelta

    return timedelta(hours=count)
