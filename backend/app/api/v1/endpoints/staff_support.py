# Darbuotojų pusė naujam pokalbių modeliui. Pakeičia seną client_support.py
# lentelės DataTable sąsają viena eile. Prieiga apribota "aptarnavimo" pareigoms -
# bendras EDIT (kurį turi ir mechanikai) čia nepakanka, žr. specifikacijos 13 skyrių.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from app.api.deps import get_db, get_current_user
from app.models.employee import Employee
from app.models.client import Client
from app.models.support_conversation import SupportConversation
from app.models.support_message import SupportMessage, SupportNote
from app.models.reservation import Reservation
from app.models.car import Car
from app.schemas.support import (
    MessageOut,
    NoteOut,
    ReservationContext,
    StaffMessageCreate,
    NoteCreate,
    ResolveRequest,
    ReassignRequest,
    SeenRequest,
    StaffConversationSummaryOut,
    StaffConversationDetailOut,
)
from app.services import support_service

router = APIRouter(prefix="/support", tags=["Staff Support"])

# Bendras darbuotojo EDIT (turi ir Mechanikas) NEREIŠKIA prieigos prie privačių
# klientų pokalbių - tai atskira, siauresnė sritis.
SUPPORT_ROLES = {"Administratorius", "Vadybininkas", "Klientų aptarnavimas"}
MANAGER_ROLES = {"Administratorius", "Vadybininkas"}


def require_support_access(user: Employee = Depends(get_current_user)) -> Employee:
    if user.pareigos not in SUPPORT_ROLES:
        raise HTTPException(status_code=403, detail="Neturite prieigos prie klientų aptarnavimo")
    return user


def require_support_manager(user: Employee = Depends(get_current_user)) -> Employee:
    if user.pareigos not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Reikia vadovo teisių")
    return user


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
        rezervacijos_id=res.rezervacijos_id, marke=car.marke, modelis=car.modelis,
        rezervacijos_pradzia=str(res.rezervacijos_pradzia), rezervacijos_pabaiga=str(res.rezervacijos_pabaiga),
    )


def _last_message(db: Session, pokalbio_id: int) -> SupportMessage | None:
    return (
        db.query(SupportMessage)
        .filter(SupportMessage.pokalbio_id == pokalbio_id)
        .order_by(desc(SupportMessage.zinutes_id))
        .first()
    )


def _author_name(db: Session, msg: SupportMessage) -> str | None:
    if msg.autoriaus_tipas == "darbuotojas":
        emp = db.query(Employee).filter(Employee.darbuotojo_id == msg.darbuotojo_id).first()
        return emp.vardas if emp else "Darbuotojas"
    client = db.query(Client).filter(Client.kliento_id == msg.kliento_id).first()
    return f"{client.vardas} {client.pavarde}" if client else "Klientas"


def _to_summary(db: Session, convo: SupportConversation) -> StaffConversationSummaryOut:
    last = _last_message(db, convo.pokalbio_id)
    unread = bool(last and last.autoriaus_tipas == "klientas" and last.zinutes_id > (convo.darbuotojo_paskutinis_matytas or 0))
    client = db.query(Client).filter(Client.kliento_id == convo.kliento_id).first()
    agent = db.query(Employee).filter(Employee.darbuotojo_id == convo.darbuotojo_id).first() if convo.darbuotojo_id else None
    return StaffConversationSummaryOut(
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
        kliento_vardas=f"{client.vardas} {client.pavarde}" if client else f"#{convo.kliento_id}",
        darbuotojo_id=convo.darbuotojo_id,
        darbuotojo_vardas=agent.vardas if agent else None,
        reikia_atsakyti=(convo.busena == "atvira"),
    )


def _to_detail(db: Session, convo: SupportConversation) -> StaffConversationDetailOut:
    messages = (
        db.query(SupportMessage)
        .filter(SupportMessage.pokalbio_id == convo.pokalbio_id)
        .order_by(SupportMessage.zinutes_id.asc())
        .all()
    )
    notes = (
        db.query(SupportNote)
        .filter(SupportNote.pokalbio_id == convo.pokalbio_id)
        .order_by(SupportNote.pastabos_id.asc())
        .all()
    )
    summary = _to_summary(db, convo)
    return StaffConversationDetailOut(
        **summary.model_dump(),
        zinutes=[
            MessageOut(
                zinutes_id=m.zinutes_id, autoriaus_tipas=m.autoriaus_tipas,
                autorius_vardas=_author_name(db, m), tekstas=m.tekstas, sukurimo_data=m.sukurimo_data,
            )
            for m in messages
        ],
        pastabos=[
            NoteOut(
                pastabos_id=n.pastabos_id,
                darbuotojo_vardas=(db.query(Employee).filter(Employee.darbuotojo_id == n.darbuotojo_id).first() or Employee(vardas="?")).vardas,
                tekstas=n.tekstas, sukurimo_data=n.sukurimo_data,
            )
            for n in notes
        ],
    )


def _get_conversation(db: Session, pokalbio_id: int) -> SupportConversation:
    convo = db.query(SupportConversation).filter(SupportConversation.pokalbio_id == pokalbio_id).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Pokalbis nerastas")
    return convo


@router.get("/conversations", response_model=list[StaffConversationSummaryOut], operation_id="getStaffConversations")
def list_conversations(
    filter: str = "all",
    db: Session = Depends(get_db),
    current_user: Employee = Depends(require_support_access),
):
    query = db.query(SupportConversation)
    if filter == "unassigned":
        query = query.filter(SupportConversation.darbuotojo_id.is_(None))
    elif filter == "mine":
        query = query.filter(SupportConversation.darbuotojo_id == current_user.darbuotojo_id)
    elif filter == "needs_reply":
        query = query.filter(SupportConversation.busena == "atvira")
    elif filter == "waiting":
        query = query.filter(SupportConversation.busena == "laukiama_kliento")
    elif filter == "resolved":
        query = query.filter(SupportConversation.busena == "isspresta")

    # Reikia atsakyti byloms - seniausia pirma (kad naujos žinutės nenustumtų senų į galą).
    order = asc(SupportConversation.atnaujinimo_data) if filter == "needs_reply" else desc(SupportConversation.atnaujinimo_data)
    convos = query.order_by(order).all()
    return [_to_summary(db, c) for c in convos]


@router.get("/conversations/{pokalbio_id}", response_model=StaffConversationDetailOut, operation_id="getStaffConversation")
def get_conversation(
    pokalbio_id: int, db: Session = Depends(get_db), current_user: Employee = Depends(require_support_access),
):
    convo = _get_conversation(db, pokalbio_id)
    return _to_detail(db, convo)


@router.post("/conversations/{pokalbio_id}/claim", response_model=StaffConversationDetailOut, operation_id="claimStaffConversation")
def claim(
    pokalbio_id: int, db: Session = Depends(get_db), current_user: Employee = Depends(require_support_access),
):
    convo = _get_conversation(db, pokalbio_id)
    support_service.claim_conversation(db, convo, current_user.darbuotojo_id)
    return _to_detail(db, convo)


@router.post("/conversations/{pokalbio_id}/reassign", response_model=StaffConversationDetailOut, operation_id="reassignStaffConversation")
def reassign(
    pokalbio_id: int, request: ReassignRequest, db: Session = Depends(get_db),
    current_user: Employee = Depends(require_support_manager),
):
    convo = _get_conversation(db, pokalbio_id)
    support_service.reassign_conversation(db, convo, request.darbuotojo_id)
    return _to_detail(db, convo)


@router.post("/conversations/{pokalbio_id}/messages", response_model=StaffConversationDetailOut, operation_id="addStaffMessage")
def add_message(
    pokalbio_id: int, request: StaffMessageCreate, db: Session = Depends(get_db),
    current_user: Employee = Depends(require_support_access),
):
    convo = _get_conversation(db, pokalbio_id)
    support_service.add_staff_message(db, convo, current_user.darbuotojo_id, request.tekstas, request.busena)
    return _to_detail(db, convo)


@router.post("/conversations/{pokalbio_id}/notes", response_model=StaffConversationDetailOut, operation_id="addStaffNote")
def add_note(
    pokalbio_id: int, request: NoteCreate, db: Session = Depends(get_db),
    current_user: Employee = Depends(require_support_access),
):
    convo = _get_conversation(db, pokalbio_id)
    support_service.add_note(db, convo, current_user.darbuotojo_id, request.tekstas)
    return _to_detail(db, convo)


@router.post("/conversations/{pokalbio_id}/resolve", response_model=StaffConversationDetailOut, operation_id="resolveStaffConversation")
def resolve(
    pokalbio_id: int, request: ResolveRequest, db: Session = Depends(get_db),
    current_user: Employee = Depends(require_support_access),
):
    convo = _get_conversation(db, pokalbio_id)
    support_service.resolve_conversation(db, convo, request.santrauka)
    return _to_detail(db, convo)


@router.post("/conversations/{pokalbio_id}/seen", response_model=StaffConversationSummaryOut, operation_id="markStaffConversationSeen")
def mark_seen(
    pokalbio_id: int, request: SeenRequest, db: Session = Depends(get_db),
    current_user: Employee = Depends(require_support_access),
):
    convo = _get_conversation(db, pokalbio_id)
    support_service.mark_seen(db, convo, is_staff=True, last_seen_id=request.zinutes_id)
    return _to_summary(db, convo)
