"""Kliento laikymų endpointai mobiliajai programėlei. Visa logika – hold_service."""
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
