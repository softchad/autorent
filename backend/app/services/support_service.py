# Aptarnavimo pokalbių verslo taisyklės. Endpointai (customer_support.py,
# support.py) tikrina autentifikaciją ir nuosavybę; šis servisas garantuoja
# būsenų perėjimus ir tekstų taisykles nepriklausomai nuo to, kas jį kviečia.
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.support_conversation import SupportConversation
from app.models.support_message import SupportMessage, SupportNote
from app.models.reservation import Reservation

TEMA_MIN, TEMA_MAX = 3, 150
TEXT_MIN, TEXT_MAX = 1, 5000

VALID_KATEGORIJOS = {"rezervacija", "atsiemimas_grazinimas", "automobilis", "saskaita", "paskyra", "kita"}
NEXT_STAFF_STATUSES = {"sprendziama", "laukiama_kliento"}


def _clean(value: str, min_len: int, max_len: int, field: str) -> str:
    v = (value or "").strip()
    if len(v) < min_len or len(v) > max_len:
        raise HTTPException(status_code=400, detail=f"{field} turi būti {min_len}-{max_len} simbolių.")
    return v


def create_conversation(
    db: Session, kliento_id: int, tema: str, pranesimas: str,
    kategorija: str = "kita", rezervacijos_id: int | None = None,
) -> SupportConversation:
    tema = _clean(tema, TEMA_MIN, TEMA_MAX, "Tema")
    pranesimas = _clean(pranesimas, TEXT_MIN, TEXT_MAX, "Žinutė")
    if kategorija not in VALID_KATEGORIJOS:
        kategorija = "kita"

    if rezervacijos_id is not None:
        # Klientas gali susieti tik SAVO rezervaciją - niekada svetimą pagal ID spėjimą.
        res = db.query(Reservation).filter(Reservation.rezervacijos_id == rezervacijos_id).first()
        if not res or res.kliento_id != kliento_id:
            raise HTTPException(status_code=404, detail="Rezervacija nerasta")

    convo = SupportConversation(
        kliento_id=kliento_id, tema=tema, kategorija=kategorija,
        busena="atvira", rezervacijos_id=rezervacijos_id,
    )
    db.add(convo)
    db.flush()

    msg = SupportMessage(
        pokalbio_id=convo.pokalbio_id, autoriaus_tipas="klientas",
        kliento_id=kliento_id, tekstas=pranesimas,
    )
    db.add(msg)
    db.commit()
    db.refresh(convo)
    return convo


def add_customer_message(db: Session, convo: SupportConversation, kliento_id: int, tekstas: str) -> SupportMessage:
    if convo.kliento_id != kliento_id:
        raise HTTPException(status_code=404, detail="Pokalbis nerastas")
    tekstas = _clean(tekstas, TEXT_MIN, TEXT_MAX, "Žinutė")

    msg = SupportMessage(
        pokalbio_id=convo.pokalbio_id, autoriaus_tipas="klientas",
        kliento_id=kliento_id, tekstas=tekstas,
    )
    db.add(msg)
    # Bet kuri kliento žinutė (net išspręstoje byloje) grąžina ją į "atvira" -
    # atsakingas darbuotojas išlieka, sprendimo santrauka lieka istorijoje.
    convo.busena = "atvira"
    db.add(convo)
    db.commit()
    db.refresh(msg)
    return msg


def add_staff_message(
    db: Session, convo: SupportConversation, darbuotojo_id: int, tekstas: str, next_status: str,
) -> SupportMessage:
    if convo.darbuotojo_id is not None and convo.darbuotojo_id != darbuotojo_id:
        raise HTTPException(status_code=403, detail="Bylą tvarko kitas darbuotojas")
    tekstas = _clean(tekstas, TEXT_MIN, TEXT_MAX, "Žinutė")
    if next_status not in NEXT_STAFF_STATUSES:
        raise HTTPException(status_code=400, detail="Neleistina būsena po atsakymo")

    msg = SupportMessage(
        pokalbio_id=convo.pokalbio_id, autoriaus_tipas="darbuotojas",
        darbuotojo_id=darbuotojo_id, tekstas=tekstas,
    )
    db.add(msg)
    convo.busena = next_status
    if convo.darbuotojo_id is None:
        convo.darbuotojo_id = darbuotojo_id
    db.add(convo)
    db.commit()
    db.refresh(msg)
    return msg


def claim_conversation(db: Session, convo: SupportConversation, darbuotojo_id: int) -> SupportConversation:
    if convo.darbuotojo_id is not None:
        if convo.darbuotojo_id == darbuotojo_id:
            return convo
        raise HTTPException(status_code=409, detail="Bylą jau prisiėmė kitas darbuotojas")

    # WHERE darbuotojo_id IS NULL apsaugo nuo dviejų darbuotojų vienu metu -
    # laimi tas, kurio UPDATE pirmas pasiekia DB, kitas gauna 0 eilučių.
    updated = (
        db.query(SupportConversation)
        .filter(SupportConversation.pokalbio_id == convo.pokalbio_id, SupportConversation.darbuotojo_id.is_(None))
        .update({"darbuotojo_id": darbuotojo_id})
    )
    db.commit()
    if updated == 0:
        raise HTTPException(status_code=409, detail="Bylą jau prisiėmė kitas darbuotojas")
    db.refresh(convo)
    return convo


def reassign_conversation(db: Session, convo: SupportConversation, darbuotojo_id: int) -> SupportConversation:
    convo.darbuotojo_id = darbuotojo_id
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return convo


def resolve_conversation(db: Session, convo: SupportConversation, santrauka: str) -> SupportConversation:
    santrauka = _clean(santrauka, 1, 1000, "Santrauka")
    convo.busena = "isspresta"
    convo.sprendimo_santrauka = santrauka
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return convo


def add_note(db: Session, convo: SupportConversation, darbuotojo_id: int, tekstas: str) -> SupportNote:
    tekstas = _clean(tekstas, TEXT_MIN, TEXT_MAX, "Pastaba")
    note = SupportNote(pokalbio_id=convo.pokalbio_id, darbuotojo_id=darbuotojo_id, tekstas=tekstas)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def mark_seen(db: Session, convo: SupportConversation, is_staff: bool, last_seen_id: int) -> SupportConversation:
    field = "darbuotojo_paskutinis_matytas" if is_staff else "kliento_paskutinis_matytas"
    current = getattr(convo, field) or 0
    # Riba gali tik didėti - senesnis įrenginys/kortelė negali jos sumažinti.
    if last_seen_id > current:
        setattr(convo, field, last_seen_id)
        db.add(convo)
        db.commit()
        db.refresh(convo)
    return convo
