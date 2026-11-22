"""Kainos skaičiavimas pagal DB tarifus (Decimal, apvalinama iki centų ROUND_HALF_UP)."""
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.models.car import Car
from app.models.extra import Extra
from app.services import booking_rules

CENT = Decimal("0.01")


class PricingError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


@dataclass(frozen=True)
class ExtraPrice:
    kodas: str
    pavadinimas: str
    kaina_parai: Decimal


@dataclass(frozen=True)
class PriceLine:
    kodas: str
    pavadinimas: str
    kaina_parai: Decimal
    suma: Decimal


@dataclass(frozen=True)
class Quote:
    paru_skaicius: int
    kaina_parai: Decimal
    nuomos_suma: Decimal
    paslaugos: list[PriceLine]
    paslaugu_suma: Decimal
    viso: Decimal


def _money(value) -> Decimal:
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


# Kainos formulė: paros × automobilio tarifas + paros × kiekvienos paslaugos tarifas.
# Funkcija negauna jokių kliento duomenų (šalies, pilietybės, amžiaus) – todėl kaina nuo jų priklausyti negali.
def calculate(daily_rate, days: int, extras: list[ExtraPrice]) -> Quote:
    if days < 1:
        raise ValueError("Parų skaičius turi būti bent 1")
    rate = _money(daily_rate)
    rental_total = _money(rate * days)
    lines = [
        PriceLine(extra.kodas, extra.pavadinimas, _money(extra.kaina_parai), _money(_money(extra.kaina_parai) * days))
        for extra in extras
    ]
    extras_total = sum((line.suma for line in lines), Decimal("0.00"))
    return Quote(
        paru_skaicius=days,
        kaina_parai=rate,
        nuomos_suma=rental_total,
        paslaugos=lines,
        paslaugu_suma=extras_total,
        viso=rental_total + extras_total,
    )


def list_active_extras(db: Session) -> list[Extra]:
    return db.query(Extra).filter(Extra.aktyvi.is_(True)).order_by(Extra.paslaugos_id).all()


# Paverčia kliento atsiųstus kodus katalogo įrašais; nežinomas, išjungtas ar pakartotas kodas – klaida.
def load_extras(db: Session, codes: list[str], lock: bool = False) -> list[Extra]:
    if len(set(codes)) != len(codes):
        raise PricingError(400, "Ta pati paslauga nurodyta kelis kartus")
    if not codes:
        return []
    rows = (db.query(Extra).filter(Extra.aktyvi.is_(True), Extra.kodas.in_(codes))
            .order_by(Extra.paslaugos_id).populate_existing().with_for_update().all()) if lock else list_active_extras(db)
    found = {extra.kodas: extra for extra in rows if extra.kodas in codes}
    missing = [code for code in codes if code not in found]
    if missing:
        raise PricingError(400, "Nežinoma papildoma paslauga")
    return [found[code] for code in codes]


def to_extra_prices(extras: list[Extra]) -> list[ExtraPrice]:
    return [ExtraPrice(extra.kodas, extra.pavadinimas, extra.kaina_parai) for extra in extras]


# Kainos pasiūlymas pagal dabartinius tarifus.
def quote_for_car(db: Session, car: Car, date_from: date, date_to: date, extra_codes: list[str]) -> Quote:
    try:
        days = booking_rules.validate_period(date_from, date_to)
    except booking_rules.BookingRuleError as error:
        raise PricingError(400, error.message)
    extras = load_extras(db, extra_codes)
    return calculate(car.kaina_parai, days, to_extra_prices(extras))
