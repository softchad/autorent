# Kliento savitarnos verslo endpointai (rezervacijų kūrimas ir sąrašas) - registracija/prisijungimas yra atskirai customer_auth.py faile, šis failas tik tai, ką JAU prisijungęs klientas gali daryti savo paskyroje.
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_customer  # get_current_customer - patikrina JWT ir randa PRISIJUNGUSĮ klientą; jo grąžintą kliento_id naudojame žemiau, NIEKADA tą, kurį klientas pats atsiųstų užklausos kūne (kitaip galėtų sukurti rezervaciją SVETIMO kliento vardu).
from app.models.car import Car
from app.models.client import Client
from app.models.reservation import Reservation
from app.rate_limit import limiter  # apsauga nuo per dažno kviečiamo endpoint'o (@limiter.limit(...) žemiau)
from app.schemas.customer_reservation import CustomerReservationCreate, CustomerReservationOut, ReservationExtraOut
from app.services import reservation_service

router = APIRouter(prefix="/customer", tags=["Customer"])


# Klientas pats kuria sau rezervaciją (be darbuotojo pagalbos) - serveris dar kartą patikrina laisvumą, nepasitikėdamas vien frontend'o kalendoriumi, kuris galėjo pasenti, kol klientas pildė formą.
@router.post("/reservations", response_model=CustomerReservationOut, operation_id="createCustomerReservation")
@limiter.limit("10/minute")
def create_reservation(
    payload: CustomerReservationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    # Visa tikrinimo ir kūrimo logika – reservation_service: tą pačią funkciją kviečia ir programėlės patvirtinimas.
    try:
        reservation, car = reservation_service.create_customer_reservation(
            db, current_customer, payload.automobilio_id, payload.date_from, payload.date_to
        )
    except reservation_service.ReservationError as error:
        raise HTTPException(status_code=error.status, detail=error.message)
    db.commit()
    db.refresh(reservation)

    return _to_out(db, reservation, car)


# Grąžina TIK prisijungusio kliento SAVO rezervacijas (ne visų klientų), naujausią datą pirma - naudojama "Mano nuomos" sąrašui paskyros puslapyje.
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
    return [_to_out(db, reservation, car) for reservation, car in rows]


# Paverčia DB eilutes į atsakymo formatą. Kaina = parų skaičius × užfiksuotas automobilio tarifas
# + parų skaičius × kiekvienos pasirinktos paslaugos užfiksuotas tarifas (reservation_service.reservation_quote).
# Senoms rezervacijoms be užfiksuoto tarifo imama dabartinė automobilio kaina.
def _to_out(db: Session, reservation: Reservation, car: Car) -> CustomerReservationOut:
    quote = reservation_service.reservation_quote(db, reservation, car)
    return CustomerReservationOut(
        rezervacijos_id=reservation.rezervacijos_id,
        automobilio_id=car.automobilio_id,
        marke=car.marke,
        modelis=car.modelis,
        rezervacijos_pradzia=reservation.rezervacijos_pradzia,
        rezervacijos_pabaiga=reservation.rezervacijos_pabaiga,
        busena=reservation.busena,
        dienu_skaicius=quote.paru_skaicius,
        kaina_parai=float(quote.kaina_parai),
        viso_kaina=float(quote.viso),
        paemimo_valanda=reservation.paemimo_valanda,
        salygu_versija=reservation.salygu_versija,
        paslaugos=[
            ReservationExtraOut(kodas=line.kodas, pavadinimas=line.pavadinimas, kaina_parai=float(line.kaina_parai), suma=float(line.suma))
            for line in quote.paslaugos
        ],
    )
