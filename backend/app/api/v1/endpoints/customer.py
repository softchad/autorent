# Kliento savitarnos verslo endpointai (rezervacijų kūrimas ir sąrašas) - registracija/prisijungimas yra atskirai customer_auth.py faile, šis failas tik tai, ką JAU prisijungęs klientas gali daryti savo paskyroje.
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_customer  # get_current_customer - patikrina JWT ir randa PRISIJUNGUSĮ klientą; jo grąžintą kliento_id naudojame žemiau, NIEKADA tą, kurį klientas pats atsiųstų užklausos kūne (kitaip galėtų sukurti rezervaciją SVETIMO kliento vardu).
from app.models.car import Car
from app.models.client import Client
from app.models.reservation import Reservation
from app.rate_limit import limiter  # apsauga nuo per dažno kviečiamo endpoint'o (@limiter.limit(...) žemiau)
from app.schemas.customer_reservation import CustomerReservationCreate, CustomerReservationOut
from app.services import availability_service  # availability_service.lock_car_row - naudojamas žemiau, prieš tikrinant laisvumą
from app.services.availability_service import get_busy_car_ids, NOT_BOOKABLE_STATUSES  # get_busy_car_ids - grąžina užimtų automobilių ID per datų langą; NOT_BOOKABLE_STATUSES - fizinės automobilio būsenos (servise/remonte), kai jis neišnuomojamas NEPRIKLAUSOMAI nuo datų

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
    if payload.date_from >= payload.date_to:
        raise HTTPException(status_code=400, detail="Pabaigos data turi būti vėlesnė nei pradžios data")

    car = db.query(Car).filter(Car.automobilio_id == payload.automobilio_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Automobilis nerastas")

    # Šis patikrinimas NESUSIJĘS su pasirinktomis datomis - automobilis servise/remonte neišnuomojamas apskritai, kol vėl netaps "laisvas".
    if car.automobilio_statusas in NOT_BOOKABLE_STATUSES:
        raise HTTPException(status_code=409, detail="Šis automobilis šiuo metu neišnuomojamas")

    # SELECT ... FOR UPDATE - užrakina šią automobilio eilutę DB lygmeniu, kad du vienu metu atėję prašymai dėl TO PATIES automobilio negalėtų abu vienu metu pamatyti "laisva" prieš bet kuriam užsicommit'inant (lenktynių spraga).
    availability_service.lock_car_row(db, car.automobilio_id)

    # Tas pats laisvumo skaičiavimas, kurį klientas jau matė automobilio puslapio kalendoriuje - čia patvirtinamas IŠ NAUJO serveryje, nes nuo tada kitas klientas galėjo spėti užimti tas pačias datas.
    busy_car_ids = get_busy_car_ids(db, payload.date_from, payload.date_to)
    if car.automobilio_id in busy_car_ids:
        raise HTTPException(status_code=409, detail="Automobilis jau užimtas pasirinktu laikotarpiu")

    # Nauja rezervacija visada pradeda "laukia" būsena - ją į "patvirtinta" arba "atšaukta" paverčia darbuotojas vėliau administravimo pusėje, klientas pats jos patvirtinti negali.
    reservation = Reservation(
        kliento_id=current_customer.kliento_id,
        automobilio_id=car.automobilio_id,
        rezervacijos_pradzia=payload.date_from,
        rezervacijos_pabaiga=payload.date_to,
        busena="laukia",
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)

    return _to_out(reservation, car)


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
    return [_to_out(reservation, car) for reservation, car in rows]


# Paverčia DB eilutes į atsakymo formatą IR paskaičiuoja kainą - dienų skaičius gaunamas iš datų atimties, bendra kaina = parų skaičius * kaina parai (automobilio dabartinė kaina, ne užfiksuota rezervacijos sukūrimo metu).
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
