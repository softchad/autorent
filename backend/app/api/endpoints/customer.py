# Kliento savitarnos verslo endpointai (rezervacijų kūrimas ir sąrašas) - registracija/prisijungimas yra atskirai customer_auth.py faile, šis failas tik tai, ką JAU prisijungęs klientas gali daryti savo paskyroje.
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_customer  # get_current_customer - patikrina JWT ir randa PRISIJUNGUSĮ klientą; jo grąžintą kliento_id naudojame žemiau, NIEKADA tą, kurį klientas pats atsiųstų užklausos kūne (kitaip galėtų sukurti rezervaciją SVETIMO kliento vardu).
from app.models.car import Car
from app.models.client import Client
from app.models.reservation import Reservation
from app.rate_limit import limiter  # apsauga nuo per dažno kviečiamo endpoint'o (@limiter.limit(...) žemiau)
from app.schemas.customer_reservation import (
    CancellationPreviewOut,
    CancelRequest,
    CustomerReservationCreate,
    CustomerReservationOut,
    ReservationExtraOut,
)
from app.services import (
    availability_service,
    booking_rules,
    cancellation_policy,
    clock,
    reservation_lifecycle,
    reservation_service,
)

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
        **_lifecycle_fields(reservation, quote),
        paslaugos=[
            ReservationExtraOut(kodas=line.kodas, pavadinimas=line.pavadinimas, kaina_parai=float(line.kaina_parai), suma=float(line.suma))
            for line in quote.paslaugos
        ],
    )


def _stage(reservation: Reservation) -> str:
    return reservation_lifecycle.stage_of(
        reservation.busena, reservation.rezervacijos_pradzia, reservation.rezervacijos_pabaiga,
        reservation.atsaukimo_tipas, booking_rules.today_vilnius(),
    )


CANCEL_NOT_ALLOWED = "Šios rezervacijos atšaukti nebegalima"
CANCEL_AT_BRANCH = "Dėl rezervacijos atšaukimo kreipkitės į padalinį."


# Ta pati politika peržiūrai ir atšaukimui. Grąžina (pasekmė, None) arba (None, atsisakymo priežastis).
# Vėlyvo atšaukimo mokestis taikomas tik klientui priėmus jį numatančią sąlygų versiją; kitaip vėlyvas atšaukimas – per padalinį.
def _app_cancellation(reservation: Reservation, quote):
    if not reservation_lifecycle.can(_stage(reservation), reservation_lifecycle.ACTION_CANCEL):
        return None, CANCEL_NOT_ALLOWED
    outcome = cancellation_policy.evaluate(
        reservation.rezervacijos_pradzia, reservation.paemimo_valanda, quote.kaina_parai, quote.viso, clock.utc_now()
    )
    if not outcome.galima:
        return None, CANCEL_NOT_ALLOWED
    if not outcome.nemokamai and reservation.salygu_versija not in cancellation_policy.FEE_TERMS_VERSIONS:
        return None, CANCEL_AT_BRANCH
    return outcome, None


# Etapas, leidžiami veiksmai ir atšaukimo pasekmė – apskaičiuojami kiekvienam atsakymui iš tų pačių taisyklių.
def _lifecycle_fields(reservation: Reservation, quote) -> dict:
    stage = _stage(reservation)
    actions = reservation_lifecycle.allowed_actions(stage)
    preview = None
    if reservation_lifecycle.ACTION_CANCEL in actions:
        outcome, _ = _app_cancellation(reservation, quote)
        if outcome:
            preview = CancellationPreviewOut(
                nemokamai=outcome.nemokamai, mokestis=float(outcome.mokestis), nemokamai_iki=outcome.nemokamai_iki
            )
        else:
            actions.remove(reservation_lifecycle.ACTION_CANCEL)
    fee = reservation.atsaukimo_mokestis
    return {
        "etapas": stage,
        "veiksmai": actions,
        "atsaukimas": preview,
        "atsaukimo_tipas": reservation.atsaukimo_tipas,
        "atsaukimo_mokestis": float(fee) if fee is not None else None,
    }


# Rezervacija ieškoma kartu pagal ID ir prisijungusio kliento ID: svetima rezervacija atrodo kaip neegzistuojanti (404).
def _get_own_reservation(db: Session, rezervacijos_id: int, customer: Client):
    row = (
        db.query(Reservation, Car)
        .join(Car, Reservation.automobilio_id == Car.automobilio_id)
        .filter(Reservation.rezervacijos_id == rezervacijos_id, Reservation.kliento_id == customer.kliento_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Rezervacija nerasta")
    return row


@router.get("/reservations/{rezervacijos_id}", response_model=CustomerReservationOut, operation_id="getCustomerReservation")
def get_reservation(
    rezervacijos_id: int,
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    reservation, car = _get_own_reservation(db, rezervacijos_id, current_customer)
    return _to_out(db, reservation, car)


# Kliento atšaukimas. Pasekmė (nemokamai / mokestis) apskaičiuojama serveryje atšaukimo momentu.
@router.post(
    "/reservations/{rezervacijos_id}/cancel", response_model=CustomerReservationOut, operation_id="cancelCustomerReservation"
)
@limiter.limit("10/minute")
def cancel_reservation(
    rezervacijos_id: int,
    payload: CancelRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    kliento_id = current_customer.kliento_id
    # Užraktų tvarka kaip kituose keliuose: automobilis → klientas → rezervacija. Pirmas skaitymas be užrakto
    # tik suranda automobilį; sprendimas priimamas pagal užrakintą eilutę, perskaitytą iš naujo (populate_existing).
    owned = (
        db.query(Reservation.automobilio_id)
        .filter(Reservation.rezervacijos_id == rezervacijos_id, Reservation.kliento_id == kliento_id)
        .first()
    )
    if not owned:
        raise HTTPException(status_code=404, detail="Rezervacija nerasta")
    automobilio_id = owned.automobilio_id
    car = availability_service.lock_car_row(db, automobilio_id)
    availability_service.lock_client_row(db, kliento_id)
    reservation = (
        db.query(Reservation)
        .filter(Reservation.rezervacijos_id == rezervacijos_id, Reservation.kliento_id == kliento_id)
        .populate_existing()
        .with_for_update()
        .first()
    )
    if not reservation or not car:
        raise HTTPException(status_code=404, detail="Rezervacija nerasta")
    if reservation.automobilio_id != automobilio_id:
        raise HTTPException(status_code=409, detail="Rezervacija buvo pakeista. Atnaujinkite ir bandykite dar kartą.")

    # Pakartotas prašymas jau atšauktai rezervacijai nieko nekeičia ir grąžina tą patį rezultatą.
    if reservation.busena == "atšaukta" and reservation.atsaukimo_tipas == "klientas":
        return _to_out(db, reservation, car)

    quote = reservation_service.reservation_quote(db, reservation, car)
    outcome, refusal = _app_cancellation(reservation, quote)
    if refusal:
        raise HTTPException(status_code=409, detail=refusal)
    # Klientas turi būti matęs būtent tą mokestį, kuris bus pritaikytas.
    if Decimal(str(payload.tiketinas_mokestis)).quantize(Decimal("0.01")) != outcome.mokestis:
        raise HTTPException(status_code=409, detail="Atšaukimo sąlygos pasikeitė. Peržiūrėkite jas iš naujo.")

    reservation.busena = "atšaukta"
    reservation.atsaukimo_tipas = "klientas"
    reservation.atsaukta = clock.utc_now_naive()
    reservation.atsaukimo_mokestis = outcome.mokestis
    db.commit()
    db.refresh(reservation)
    return _to_out(db, reservation, car)
