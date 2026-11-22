"""Mėnesio užimtumo kalendorius. Gryna logika: iš užimtų intervalų sudaro kiekvienos dienos būseną."""
import calendar
from datetime import date, timedelta

DAY_PAST = "praeitis"
DAY_FREE = "laisva"
# Tą dieną viena nuoma baigiasi arba prasideda: automobilis laisvas tik dalį dienos.
DAY_PARTIAL = "dalinai"
DAY_BUSY = "uzimta"


# Intervalas [pradžia, pabaiga) užima „naktis“: nuoma gruodžio 1–5 d. užima naktis 1, 2, 3, 4.
def occupied_nights(ranges: list[tuple[date, date]]) -> set[date]:
    nights: set[date] = set()
    for start, end in ranges:
        day = start
        while day < end:
            nights.add(day)
            day += timedelta(days=1)
    return nights


def classify_day(day: date, nights: set[date], today: date) -> dict:
    night_taken = day in nights
    previous_night_taken = (day - timedelta(days=1)) in nights

    if day < today:
        status = DAY_PAST
    elif night_taken and previous_night_taken:
        status = DAY_BUSY
    elif night_taken or previous_night_taken:
        status = DAY_PARTIAL
    else:
        status = DAY_FREE

    return {
        "data": day,
        "busena": status,
        # Pradėti nuomą galima, jei šios dienos naktis laisva (paėmimas nuo 12:00, kai ankstesnis klientas jau grąžino).
        "galima_pradeti": day >= today and not night_taken,
        # Baigti nuomą galima, jei ankstesnė naktis laisva (grąžinimas iki 10:00, prieš kito kliento paėmimą).
        "galima_baigti": day > today and not previous_night_taken,
    }


def month_bounds(year: int, month: int) -> tuple[date, date]:
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def build_month(year: int, month: int, ranges: list[tuple[date, date]], today: date) -> list[dict]:
    first, last = month_bounds(year, month)
    # Intervalai apkarpomi iki [ankstesnė naktis, mėnesio pabaiga + 1): labai ilga nuoma neiteruojama per visas savo dienas.
    window_from, window_to = first - timedelta(days=1), last + timedelta(days=1)
    nights = occupied_nights([(max(start, window_from), min(end, window_to)) for start, end in ranges])
    days = []
    day = first
    while day <= last:
        days.append(classify_day(day, nights, today))
        day += timedelta(days=1)
    return days
