"""Kliento laikymų endpointai mobiliajai programėlei. Laikymai – hold_service, patvirtinimas rezervacija – reservation_service."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_customer, get_db
from app.models.client import Client
from app.rate_limit import limiter
from app.schemas.hold import HoldCreate, HoldOut, to_hold_out
from app.services import clock, hold_service

router = APIRouter(prefix="/customer/holds", tags=["Customer Holds"])


def _get_own_hold(db: Session, laikymo_id: int, customer: Client):
    hold = hold_service.get_hold_for_customer(db, laikymo_id, customer.kliento_id)
    if not hold:
        # Svetimam ir neegzistuojančiam ID atsakymas vienodas – ID spėlioti neįmanoma.
        raise HTTPException(status_code=404, detail="Laikymas nerastas")
    return hold


@router.post("", response_model=HoldOut, status_code=201, operation_id="createCustomerHold")
@limiter.limit("10/minute")
def create_hold(
    payload: HoldCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    try:
        hold = hold_service.create_hold(db, current_customer, payload.automobilio_id, payload.date_from, payload.date_to)
    except hold_service.HoldError as error:
        # create_hold klaidos atveju pats atšaukia transakciją (rollback); get_db lieka tik papildoma apsauga.
        raise HTTPException(status_code=error.status, detail=error.message)
    return to_hold_out(hold, clock.utc_now_naive())


@router.get("/{laikymo_id}", response_model=HoldOut, operation_id="getCustomerHold")
def get_hold(
    laikymo_id: int,
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    return to_hold_out(_get_own_hold(db, laikymo_id, current_customer), clock.utc_now_naive())


# Klientas pats nutraukia laikymą (grįžo atgal ar pakeitė datas) – automobilis iškart atlaisvinamas kitiems.
@router.delete("/{laikymo_id}", status_code=204, operation_id="releaseCustomerHold")
def release_hold(
    laikymo_id: int,
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    hold_service.release_hold(db, _get_own_hold(db, laikymo_id, current_customer))
    return Response(status_code=204)


from fastapi import Header

from app.api.endpoints.customer import _to_out
from app.schemas.customer_reservation import CustomerReservationOut, HoldConfirmRequest
from app.services import reservation_service


# Laikymas paverčiamas rezervacija. Idempotency-Key antraštė užtikrina, kad pakartotas prašymas
# (dvigubas paspaudimas, pakartojimas nutrūkus ryšiui) nesukurtų antros rezervacijos.
@router.post("/{laikymo_id}/confirm", response_model=CustomerReservationOut, operation_id="confirmCustomerHold")
@limiter.limit("10/minute")
def confirm_hold(
    laikymo_id: int,
    payload: HoldConfirmRequest,
    request: Request,
    response: Response,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    try:
        reservation, car, replayed = reservation_service.confirm_hold(
            db, current_customer, laikymo_id, idempotency_key or "",
            payload.paslaugos, payload.paemimo_valanda, payload.salygu_versija, payload.sutinku_su_salygomis, payload.tiketina_kaina,
        )
    except reservation_service.ReservationError as error:
        raise HTTPException(status_code=error.status, detail=error.message)
    # 201 – sukurta nauja rezervacija, 200 – grąžinta anksčiau sukurta (pakartotas prašymas).
    response.status_code = 200 if replayed else 201
    return _to_out(db, reservation, car)
