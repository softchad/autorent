# Kliento (ne darbuotojo) verslo endpointai - rezervacijos ir pan. Autentifikacija
# yra customer_auth.py faile. kliento_id visada imamas iš get_current_customer
# tokeno, niekada iš užklausos kūno - žr. app/api/deps.py komentarus.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_customer
from app.models.car import Car
from app.models.client import Client
from app.models.reservation import Reservation
from app.schemas.customer_reservation import CustomerReservationCreate, CustomerReservationOut
from app.services.availability_service import get_busy_car_ids, NOT_BOOKABLE_STATUSES

router = APIRouter(prefix="/customer", tags=["Customer"])


@router.post("/reservations", response_model=CustomerReservationOut, operation_id="createCustomerReservation")
def create_reservation(
    request: CustomerReservationCreate,
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    if request.date_from >= request.date_to:
        raise HTTPException(status_code=400, detail="Pabaigos data turi būti vėlesnė nei pradžios data")

    car = db.query(Car).filter(Car.automobilio_id == request.automobilio_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Automobilis nerastas")

    if car.automobilio_statusas in NOT_BOOKABLE_STATUSES:
        raise HTTPException(status_code=409, detail="Šis automobilis šiuo metu neišnuomojamas")

    # Tas pats realaus laisvumo tikrinimas, kurį jau matė klientas automobilio
    # puslapyje (žr. public.py) - patvirtinama dar kartą serveryje prieš kuriant įrašą.
    busy_car_ids = get_busy_car_ids(db, request.date_from, request.date_to)
    if car.automobilio_id in busy_car_ids:
        raise HTTPException(status_code=409, detail="Automobilis jau užimtas pasirinktu laikotarpiu")

    reservation = Reservation(
        kliento_id=current_customer.kliento_id,
        automobilio_id=car.automobilio_id,
        rezervacijos_pradzia=request.date_from,
        rezervacijos_pabaiga=request.date_to,
        busena="laukia",
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)

    return _to_out(reservation, car)


@router.get("/reservations", response_model=list[CustomerReservationOut], operation_id="getCustomerReservations")
def get_reservations(
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    rows = (
        db.query(Reservation, Car)
        .join(Car, Reservation.automobilio_id == Car.automobilio_id)
        .filter(Reservation.kliento_id == current_customer.kliento_id)
        .order_by(Reservation.rezervacijos_pradzia.desc())
        .all()
    )
    return [_to_out(reservation, car) for reservation, car in rows]


def _to_out(reservation: Reservation, car: Car) -> CustomerReservationOut:
    dienu_skaicius = (reservation.rezervacijos_pabaiga - reservation.rezervacijos_pradzia).days
    kaina_parai = float(car.kaina_parai)
    return CustomerReservationOut(
        rezervacijos_id=reservation.rezervacijos_id,
        automobilio_id=car.automobilio_id,
        marke=car.marke,
        modelis=car.modelis,
        rezervacijos_pradzia=reservation.rezervacijos_pradzia,
        rezervacijos_pabaiga=reservation.rezervacijos_pabaiga,
        busena=reservation.busena,
        dienu_skaicius=dienu_skaicius,
        kaina_parai=kaina_parai,
        viso_kaina=round(kaina_parai * dienu_skaicius, 2),
    )
