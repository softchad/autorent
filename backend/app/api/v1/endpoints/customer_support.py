# Kliento pusė naujam pokalbių modeliui. Pakeičia seną vieno klausimo/atsakymo
# customer_support.py versiją - žr. docs/AUTORENT_KLIENTU_APTARNAVIMO_SISTEMOS_SPECIFIKACIJA.md.
# Sena Klientu_Palaikymas lentelė lieka DB neliesta, bet šis modulis jos nebenaudoja.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api.deps import get_db, get_current_customer
from app.models.client import Client
from app.models.employee import Employee
from app.models.support_conversation import SupportConversation
from app.models.support_message import SupportMessage
from app.models.reservation import Reservation
from app.models.car import Car
from app.schemas.support import (
    ConversationCreate,
    MessageCreate,
    SeenRequest,
    ConversationSummaryOut,
    ConversationDetailOut,
    MessageOut,
    ReservationContext,
)
from app.services import support_service

router = APIRouter(prefix="/customer/support", tags=["Customer Support"])


def _reservation_context(db: Session, rezervacijos_id: int | None) -> ReservationContext | None:
    if not rezervacijos_id:
        return None
    row = (
        db.query(Reservation, Car)
        .join(Car, Reservation.automobilio_id == Car.automobilio_id)
        .filter(Reservation.rezervacijos_id == rezervacijos_id)
        .first()
    )
    if not row:
        return None
    res, car = row
    return ReservationContext(
        rezervacijos_id=res.rezervacijos_id,
        marke=car.marke,
        modelis=car.modelis,
        rezervacijos_pradzia=str(res.rezervacijos_pradzia),
        rezervacijos_pabaiga=str(res.rezervacijos_pabaiga),
    )


def _last_message(db: Session, pokalbio_id: int) -> SupportMessage | None:
    return (
        db.query(SupportMessage)
        .filter(SupportMessage.pokalbio_id == pokalbio_id)
        .order_by(desc(SupportMessage.zinutes_id))
        .first()
    )


def _to_summary(db: Session, convo: SupportConversation) -> ConversationSummaryOut:
    last = _last_message(db, convo.pokalbio_id)
    unread = bool(last and last.autoriaus_tipas == "darbuotojas" and last.zinutes_id > (convo.kliento_paskutinis_matytas or 0))
    return ConversationSummaryOut(
        pokalbio_id=convo.pokalbio_id,
        tema=convo.tema,
        kategorija=convo.kategorija,
        busena=convo.busena,
        sukurimo_data=convo.sukurimo_data,
        atnaujinimo_data=convo.atnaujinimo_data,
        paskutine_zinute=last.tekstas if last else None,
        paskutine_zinute_autorius=last.autoriaus_tipas if last else None,
        neperskaityta=unread,
        rezervacija=_reservation_context(db, convo.rezervacijos_id),
        sprendimo_santrauka=convo.sprendimo_santrauka,
    )


def _author_name(db: Session, msg: SupportMessage) -> str | None:
    if msg.autoriaus_tipas != "darbuotojas":
        return None
    emp = db.query(Employee).filter(Employee.darbuotojo_id == msg.darbuotojo_id).first()
    # Klientui - tik vardas, jokio el. pašto/telefono (žr. specifikacijos 6 skyrių).
    return f"AutoRent ({emp.vardas})" if emp else "AutoRent"


def _to_detail(db: Session, convo: SupportConversation) -> ConversationDetailOut:
    messages = (
        db.query(SupportMessage)
        .filter(SupportMessage.pokalbio_id == convo.pokalbio_id)
        .order_by(SupportMessage.zinutes_id.asc())
        .all()
    )
    summary = _to_summary(db, convo)
    return ConversationDetailOut(
        **summary.model_dump(),
        zinutes=[
            MessageOut(
                zinutes_id=m.zinutes_id,
                autoriaus_tipas=m.autoriaus_tipas,
                autorius_vardas=_author_name(db, m),
                tekstas=m.tekstas,
                sukurimo_data=m.sukurimo_data,
            )
            for m in messages
        ],
    )


def _get_owned(db: Session, pokalbio_id: int, kliento_id: int) -> SupportConversation:
    convo = db.query(SupportConversation).filter(SupportConversation.pokalbio_id == pokalbio_id).first()
    if not convo or convo.kliento_id != kliento_id:
        raise HTTPException(status_code=404, detail="Pokalbis nerastas")
    return convo


@router.post("/conversations", response_model=ConversationDetailOut, operation_id="createCustomerConversation")
def create_conversation(
    request: ConversationCreate,
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    convo = support_service.create_conversation(
        db, current_customer.kliento_id, request.tema, request.pranesimas,
        request.kategorija, request.rezervacijos_id,
    )
    return _to_detail(db, convo)


@router.get("/conversations", response_model=list[ConversationSummaryOut], operation_id="getCustomerConversations")
def list_conversations(db: Session = Depends(get_db), current_customer: Client = Depends(get_current_customer)):
    convos = (
        db.query(SupportConversation)
        .filter(SupportConversation.kliento_id == current_customer.kliento_id)
        .order_by(desc(SupportConversation.atnaujinimo_data))
        .all()
    )
    return [_to_summary(db, c) for c in convos]


@router.get("/conversations/{pokalbio_id}", response_model=ConversationDetailOut, operation_id="getCustomerConversation")
def get_conversation(
    pokalbio_id: int,
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    convo = _get_owned(db, pokalbio_id, current_customer.kliento_id)
    return _to_detail(db, convo)


@router.post("/conversations/{pokalbio_id}/messages", response_model=ConversationDetailOut, operation_id="addCustomerMessage")
def add_message(
    pokalbio_id: int,
    request: MessageCreate,
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    convo = _get_owned(db, pokalbio_id, current_customer.kliento_id)
    support_service.add_customer_message(db, convo, current_customer.kliento_id, request.tekstas)
    return _to_detail(db, convo)


@router.post("/conversations/{pokalbio_id}/seen", response_model=ConversationSummaryOut, operation_id="markCustomerConversationSeen")
def mark_seen(
    pokalbio_id: int,
    request: SeenRequest,
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    convo = _get_owned(db, pokalbio_id, current_customer.kliento_id)
    support_service.mark_seen(db, convo, is_staff=False, last_seen_id=request.zinutes_id)
    return _to_summary(db, convo)
