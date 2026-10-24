from datetime import date, timedelta

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.car import Car
from app.models.client import Client
from app.models.order import Order
from app.models.reservation import Reservation

# Rezervacijos/užsakymo būsenos, kurios realiai blokuoja automobilį pasirinktu laikotarpiu - atšaukta rezervacija ir neaktyvus/užbaigtas užsakymas automobilio nebeblokuoja. "laukiama" PRIKLAUSO čia (kaip "laukia" rezervacijoms žemiau) - laukiantis patvirtinimo užsakymas VIS TIEK rezervuoja tas dienas, kitaip du "laukiama" užsakymai tam pačiam automobiliui/datoms abu praeitų konflikto patikrą.
BLOCKING_RESERVATION_STATUSES = ["patvirtinta", "laukia"]
BLOCKING_ORDER_STATUSES = ["patvirtinta", "vykdoma", "laukiama"]


# Normalizuoja [date_from, date_to) - jei date_to <= date_from (VIENOS DIENOS užsakymas, žr. schemas/order.py validatorių, kuris leidžia grazinimo_data == nuomos_data), pusiau atviro intervalo persidengimo formulė ("existing.start < new.end AND existing.end > new.start") duotų NULINIO PLOTIO intervalą, kuris NIEKADA nesikerta su NIEKUO, nepriklausomai nuo to, kiek realių booking'ų ta diena jau yra. ČIA priverčiame bent VIENOS dienos plotį TIK konflikto PATIKRAI - saugomos reikšmės (date_from/date_to patys) niekada nepakeičiami.
def _effective_window(date_from: date, date_to: date) -> tuple[date, date]:
    if date_to <= date_from:
        return date_from, date_from + timedelta(days=1)
    return date_from, date_to


# SQL versija aukščiau esančio _effective_window principo - PRITAIKYTA ESAMOMS (DB) Uzsakymai eilutėms, ne tik NAUJAM, tikrinamam booking'ui. Be šios SQL pusės normalizacijos, esamas VIENOS DIENOS užsakymas (grazinimo_data == nuomos_data) NIEKADA nesikryžiuotų su jokiu kitu booking'u užklausos lygmenyje  - "Order.grazinimo_data > date_from" būtų False, kai esamo įrašo grazinimo_data == nuomos_data == date_from, nepriklausomai nuo to, ar automobilis tą dieną TIKRAI užimtas.
# "effective_end > date_from" PERRAŠYTA kaip grynai loginė (NE aritmetinė) sąlyga - "Column + timedelta" SQL lygmenyje NEVEIKIA portabiliai (SQLite dialektas jį atmeta kompiliavimo metu; tikrinta tiesiogiai). Lygybė "pradžia + 1 diena > X" ⟺ "pradžia >= X" (sveikos dienos granuliacija), tad arifmetikos išvis nereikia.
def _order_end_after(date_from: date):
    return or_(
        and_(Order.grazinimo_data <= Order.nuomos_data, Order.nuomos_data >= date_from),
        and_(Order.grazinimo_data > Order.nuomos_data, Order.grazinimo_data > date_from),
    )

# Šių automobilio_statusas reikšmių automobilis neišnuomojamas NEPRIKLAUSOMAI nuo pasirinktų datų (tai fizinė būsena, ne rezervacijos konfliktas) - naudojama IR public.py sąraše, IR kliento rezervacijos kūrime (customer.py), kad abi vietos neišsiskirtų, kas laikoma "laisvu" automobiliu.
NOT_BOOKABLE_STATUSES = ["servise", "remonte"]


# Grąžina automobilių ID, kurie užimti [date_from, date_to) laikotarpiu - naudoja tą pačią pusiau atviro intervalo persidengimo taisyklę visur šioje sistemoje: du intervalai persidengia, kai vieno pradžia < kito galas IR kito pradžia < vieno galas.
def get_busy_car_ids(db: Session, date_from: date, date_to: date) -> set[int]:
    busy_from_reservations = {
        row[0]
        for row in db.query(Reservation.automobilio_id)
        .filter(
            Reservation.busena.in_(BLOCKING_RESERVATION_STATUSES),
            Reservation.rezervacijos_pradzia < date_to,
            Reservation.rezervacijos_pabaiga > date_from,
        )
        .all()
    }
    busy_from_orders = {
        row[0]
        for row in db.query(Order.automobilio_id)
        .filter(
            Order.uzsakymo_busena.in_(BLOCKING_ORDER_STATUSES),
            Order.nuomos_data < date_to,
            _order_end_after(date_from),
        )
        .all()
    }
    return busy_from_reservations | busy_from_orders


# Grąžina [pradžia, pabaiga) intervalus, kada KONKRETUS automobilis užimtas, apsiribojant [window_from, window_to) langu - naudojama kalendoriuje vizualiai pažymėti užimtas dienas, kad klientas rinktųsi datas nebe aklai.
def get_busy_ranges_for_car(
    db: Session, automobilio_id: int, window_from: date, window_to: date
) -> list[tuple[date, date]]:
    reservations = (
        db.query(Reservation.rezervacijos_pradzia, Reservation.rezervacijos_pabaiga)
        .filter(
            Reservation.automobilio_id == automobilio_id,
            Reservation.busena.in_(BLOCKING_RESERVATION_STATUSES),
            Reservation.rezervacijos_pradzia < window_to,
            Reservation.rezervacijos_pabaiga > window_from,
        )
        .all()
    )
    orders = (
        db.query(Order.nuomos_data, Order.grazinimo_data)
        .filter(
            Order.automobilio_id == automobilio_id,
            Order.uzsakymo_busena.in_(BLOCKING_ORDER_STATUSES),
            Order.nuomos_data < window_to,
            _order_end_after(window_from),
        )
        .all()
    )
    # "pabaiga arba pradžia+1" ČIA (Python, NE SQL) - vienos dienos užsakymas (nuomos_data == grazinimo_data) kitaip grąžintų NULINIO PLOTIO intervalą, kuris kalendoriuje nepažymėtų NĖ VIENOS dienos kaip užimtos, nors automobilis tą dieną realiai užimtas.
    order_ranges = [
        (o[0], o[1] if o[1] > o[0] else o[0] + timedelta(days=1))
        for o in orders
    ]
    return [(r[0], r[1]) for r in reservations] + order_ranges


# "SELECT ... FOR UPDATE" - užrakina automobilio eilutę, kad konkurentai dėl TO PATIES automobilio booking'o negalėtų abu vienu metu pamatyti "laisva" (be šito persidengimo patikra turėtų check-then-insert lenktynių spragą). Kviesti PRIEŠ conflict patikrą, toje pačioje transakcijoje.
def lock_car_row(db: Session, automobilio_id: int) -> Car | None:
    return db.query(Car).filter(Car.automobilio_id == automobilio_id).populate_existing().with_for_update().first()


# "SELECT ... FOR UPDATE" ant KLIENTO eilutės - lygiai ta pati priežastis, kaip lock_car_row aukščiau, tik kliento (ne automobilio) persidengimo patikrai: du vienu metu kuriami užsakymai/rezervacijos TAM PAČIAM klientui (skirtingais automobiliais) negali abu pamatyti "laisva" prieš bet kuriam užsicommit'inant.
def lock_client_row(db: Session, kliento_id: int) -> Client | None:
    return db.query(Client).filter(Client.kliento_id == kliento_id).with_for_update().first()


# Patikrina, ar KLIENTAS [date_from, date_to) laikotarpiu JAU turi AKTYVŲ booking'ą (rezervaciją ARBA užsakymą) KURIAM NORS KITAM automobiliui - naudojama order.py IR reservation.py, kad klientas negalėtų vienu metu "nuomotis" dviejų automobilių (nepriklausomai nuo to, per kurį iš dviejų kelių antrasis booking'as buvo kuriamas). "exclude_*_id" - redaguojamas įrašas pats savaime nelaikomas konfliktu su savimi.
# "with_for_update" ant PAČIŲ conflict užklausų (ne vien lock_car_row/lock_client_row) - BŪTINA : MySQL REPEATABLE READ įprastas (ne locking) SELECT skaito momentinę nuotrauką, padarytą PIRMO šios transakcijos skaitymo, NE šio konkretaus SELECT momentu - jei transakcija PRIEŠ tai (pvz. autentifikacijos ar automobilio paėmimo užklausoje) jau skaitė BET KĄ, konflikto patikra be "FOR UPDATE" galėtų "nematyti" booking'o, kurį KITA transakcija užcommit'ino TARP tų dviejų skaitymų - net jei lock_car_row/lock_client_row užraktas jau laukė IR buvo suteiktas po to commit'o. "FOR UPDATE" (locking/current read) šią nuotrauką ignoruoja ir visada skaito PASKUTINĘ užcommit'intą versiją.
def client_has_conflict(
    db: Session,
    kliento_id: int,
    date_from: date,
    date_to: date,
    exclude_reservation_id: int | None = None,
    exclude_order_id: int | None = None,
) -> bool:
    date_from, date_to = _effective_window(date_from, date_to)
    reservation_query = db.query(Reservation).filter(
        Reservation.kliento_id == kliento_id,
        Reservation.busena.in_(BLOCKING_RESERVATION_STATUSES),
        Reservation.rezervacijos_pradzia < date_to,
        Reservation.rezervacijos_pabaiga > date_from,
    )
    if exclude_reservation_id is not None:
        reservation_query = reservation_query.filter(Reservation.rezervacijos_id != exclude_reservation_id)
    if reservation_query.with_for_update().first() is not None:
        return True

    order_query = db.query(Order).filter(
        Order.kliento_id == kliento_id,
        Order.uzsakymo_busena.in_(BLOCKING_ORDER_STATUSES),
        Order.nuomos_data < date_to,
        _order_end_after(date_from),
    )
    if exclude_order_id is not None:
        order_query = order_query.filter(Order.uzsakymo_id != exclude_order_id)
    return order_query.with_for_update().first() is not None


# Patikrina, ar automobilis UŽIMTAS [date_from, date_to) laikotarpiu KURIOJE NORS iš dviejų lentelių (Rezervavimas ARBA Uzsakymai) - BENDRA funkcija order.py IR reservation.py endpoint'ams, kad rezervacija ir užsakymas dėl TO PATIES automobilio niekada negalėtų abu praeiti NEPRIKLAUSOMAS (vienos lentelės) patikras ir dubliuotis. "exclude_*_id" - redaguojamas įrašas pats savaime nelaikomas konfliktu su savimi.
def car_has_conflict(
    db: Session,
    automobilio_id: int,
    date_from: date,
    date_to: date,
    exclude_reservation_id: int | None = None,
    exclude_order_id: int | None = None,
) -> bool:
    date_from, date_to = _effective_window(date_from, date_to)
    reservation_query = db.query(Reservation).filter(
        Reservation.automobilio_id == automobilio_id,
        Reservation.busena.in_(BLOCKING_RESERVATION_STATUSES),
        Reservation.rezervacijos_pradzia < date_to,
        Reservation.rezervacijos_pabaiga > date_from,
    )
    if exclude_reservation_id is not None:
        reservation_query = reservation_query.filter(Reservation.rezervacijos_id != exclude_reservation_id)
    if reservation_query.with_for_update().first() is not None:
        return True

    order_query = db.query(Order).filter(
        Order.automobilio_id == automobilio_id,
        Order.uzsakymo_busena.in_(BLOCKING_ORDER_STATUSES),
        Order.nuomos_data < date_to,
        _order_end_after(date_from),
    )
    if exclude_order_id is not None:
        order_query = order_query.filter(Order.uzsakymo_id != exclude_order_id)
    return order_query.with_for_update().first() is not None
