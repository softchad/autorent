from datetime import date

from sqlalchemy.orm import Session

from app.models.car import Car
from app.models.order import Order
from app.models.reservation import Reservation

# Rezervacijos/užsakymo būsenos, kurios realiai blokuoja automobilį pasirinktu laikotarpiu - atšaukta rezervacija ir neaktyvus/užbaigtas užsakymas automobilio nebeblokuoja.
BLOCKING_RESERVATION_STATUSES = ["patvirtinta", "laukia"]
BLOCKING_ORDER_STATUSES = ["patvirtinta", "vykdoma"]

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
            Order.grazinimo_data > date_from,
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
            Order.grazinimo_data > window_from,
        )
        .all()
    )
    return [(r[0], r[1]) for r in reservations] + [(o[0], o[1]) for o in orders]


# "SELECT ... FOR UPDATE" - užrakina automobilio eilutę, kad konkurentai dėl TO PATIES automobilio booking'o negalėtų abu vienu metu pamatyti "laisva" (be šito persidengimo patikra turėtų check-then-insert lenktynių spragą). Kviesti PRIEŠ conflict patikrą, toje pačioje transakcijoje.
def lock_car_row(db: Session, automobilio_id: int) -> Car | None:
    return db.query(Car).filter(Car.automobilio_id == automobilio_id).with_for_update().first()
