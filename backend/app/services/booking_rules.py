"""Nuomos laikotarpio taisyklės. Gryna logika be DB – ją naudoja laikymai, kaina, kalendorius ir rezervacijos."""
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from app.services import clock

# Visos „šiandien“ ir „iki paėmimo liko“ sąvokos skaičiuojamos Lietuvos laiku, nesvarbu, kur veikia serveris.
VILNIUS = ZoneInfo("Europe/Vilnius")

MIN_RENTAL_DAYS = 1
# Riba neleidžia vienam klientui užblokuoti automobilio neribotam laikui (OWASP API6).
MAX_RENTAL_DAYS = 30

# Grąžinimas iki 10:00, paėmimas nuo 12:00 – tarp dviejų nuomų lieka bent 2 val. automobiliui paruošti.
RETURN_BY_HOUR = 10
PICKUP_FROM_HOUR = 12
PICKUP_TO_HOUR = 18


class BookingRuleError(ValueError):
    """Pažeista nuomos taisyklė. message – lietuviškas tekstas klientui."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def today_vilnius() -> date:
    return clock.utc_now().astimezone(VILNIUS).date()


# Patikrina laikotarpį [date_from, date_to) ir grąžina parų skaičių.
def validate_period(date_from: date, date_to: date, today: date | None = None) -> int:
    today = today or today_vilnius()
    if date_from < today:
        raise BookingRuleError("praeitis", "Rezervacijos data negali būti praeityje")
    days = (date_to - date_from).days
    if days < MIN_RENTAL_DAYS:
        raise BookingRuleError("per_trumpa", "Pabaigos data turi būti vėlesnė nei pradžios data")
    if days > MAX_RENTAL_DAYS:
        raise BookingRuleError("per_ilga", f"Ilgiausia nuomos trukmė – {MAX_RENTAL_DAYS} parų")
    return days


def validate_pickup_hour(hour: int) -> int:
    if not PICKUP_FROM_HOUR <= hour <= PICKUP_TO_HOUR:
        raise BookingRuleError(
            "paemimo_valanda", f"Paėmimo laikas turi būti nuo {PICKUP_FROM_HOUR}:00 iki {PICKUP_TO_HOUR}:00"
        )
    return hour


# Paėmimo momentas UTC laiku. Lietuvos laikas žiemą yra UTC+2, vasarą UTC+3 – skirtumą parenka zoneinfo.
def pickup_moment_utc(pickup_date: date, pickup_hour: int | None) -> datetime:
    hour = PICKUP_FROM_HOUR if pickup_hour is None else pickup_hour
    local = datetime.combine(pickup_date, time(hour=hour), tzinfo=VILNIUS)
    return local.astimezone(timezone.utc)


# Taisyklės, kurias programėlė parodo klientui ir naudoja išankstiniam tikrinimui.
def get_rules() -> dict:
    return {
        "siandien": today_vilnius().isoformat(),
        "min_paru": MIN_RENTAL_DAYS,
        "max_paru": MAX_RENTAL_DAYS,
        "grazinimas_iki_val": RETURN_BY_HOUR,
        "paemimas_nuo_val": PICKUP_FROM_HOUR,
        "paemimas_iki_val": PICKUP_TO_HOUR,
    }
