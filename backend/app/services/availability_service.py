from datetime import date

from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.reservation import Reservation

# Rezervacijos/užsakymo būsenos, kurios realiai blokuoja automobilį pasirinktu laikotarpiu.
# Atšaukta rezervacija ir neaktyvus/užbaigtas užsakymas automobilio nebeblokuoja.
BLOCKING_RESERVATION_STATUSES = ["patvirtinta", "laukia"]
BLOCKING_ORDER_STATUSES = ["patvirtinta", "vykdoma"]

# Šių automobilio_statusas reikšmių automobilis neišnuomojamas nepriklausomai nuo
# pasirinktų datų - tai fizinė būsena, ne rezervacijos konfliktas. Naudojama ir
# public.py sąraše, ir kliento rezervacijos kūrime (customer.py), kad abu vietoj
# neišsiskirtų dėl to, kas laikoma "laisvu" automobiliu.
NOT_BOOKABLE_STATUSES = ["servise", "remonte"]


def get_busy_car_ids(db: Session, date_from: date, date_to: date) -> set[int]:
    """Grąžina automobilių ID, kurie yra užimti [date_from, date_to) laikotarpiu.

    Naudoja tą pačią pusiau atviro intervalo persidengimo taisyklę visur šioje
    sistemoje (žr. endpoints/car.py, repositories/order.py, repositories/reservation.py):
    du intervalai persidengia, kai vieno pradžia < kito galas IR kito pradžia < vieno galas.
    """
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
