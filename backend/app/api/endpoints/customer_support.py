# Kliento pusė pagalbos pokalbių sistemos - klientas čia gali pradėti naują pokalbį su AutoRent darbuotojais, peržiūrėti savo pokalbių sąrašą ir rašyti/skaityti žinutes; pati pokalbio/žinutės kūrimo logika laikoma VIENAME bendrame faile (support_service.py), kurį naudoja IR šis failas, IR darbuotojų pusės support.py, kad abi pusės visada veiktų identiškai, nesiskirdamos tarpusavyje.
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, tuple_  # desc - rikiuoti NAUJAUSIUS pirmi (žr. list_conversations žemiau); tuple_ - sudėtinė (rezervacijos_id, kliento_id) IN patikra žr. _reservation_context_map

from app.api.deps import get_db, get_current_customer
from app.models.client import Client
from app.models.employee import Employee  # reikalingas, kad pokalbio žinutėse parodytume darbuotojo VARDĄ (ne ID)
from app.models.support_conversation import SupportConversation
from app.models.support_message import SupportMessage
from app.models.reservation import Reservation  # pokalbis gali būti susietas su konkrečia rezervacija - rodoma kaip kontekstas
from app.models.car import Car  # reikalingas rezervacijos kontekstui (kokiu automobiliu klausiama)
from app.rate_limit import limiter  # apsauga nuo per dažno spėliojimo iš eilės (@limiter.limit(...) žemiau)
from app.schemas.support import (
    ConversationCreate,
    MessageCreate,
    SeenRequest,
    ConversationSummaryOut,
    ConversationDetailOut,
    MessageOut,
    ReservationContext,
)
from app.services import support_service  # bendra pokalbių logika (sukūrimas, žinutės, "seen") - naudoja IR šis failas, IR darbuotojų support.py

router = APIRouter(prefix="/customer/support", tags=["Customer Support"])


# Vienu DB kreipiniu paverčia (rezervacijos_id, kliento_id) poras į žodyną {rezervacijos_id: automobilio info} - naudojama rodyti, su kokiu automobiliu susijęs pokalbis.
# "kliento_id" ČIA PRIVALOMAS kartu su rezervacijos_id (NE vien rezervacijos_id.in_(...)) - : rezervacijos SAVININKAS (kliento_id) GALI pasikeisti VĖLIAU (darbuotojas perskiria rezervaciją kitam klientui, žr. reservation.py update_reservation), bet pokalbio "rezervacijos_id" nuoroda IŠLIEKA SENA. Be šios sudėtinės (rezervacijos_id, kliento_id) patikros, SENAS pokalbio savininkas toliau matytų NAUJO (dabartinio) rezervacijos savininko automobilio/datų informaciją - ši funkcija dabar grąžina kontekstą TIK kai dabartinė DB eilutė VIS TIEK priklauso TAM PAČIAM klientui, kuriam priklauso pats pokalbis.
def _reservation_context_map(db: Session, pairs: list[tuple[int, int]]) -> dict[int, ReservationContext]:
    pairs = {(rid, cid) for rid, cid in pairs if rid}
    if not pairs:
        return {}
    rows = (
        db.query(Reservation, Car)
        .join(Car, Reservation.automobilio_id == Car.automobilio_id)
        .filter(tuple_(Reservation.rezervacijos_id, Reservation.kliento_id).in_(pairs))
        .all()
    )
    return {
        res.rezervacijos_id: ReservationContext(
            rezervacijos_id=res.rezervacijos_id,
            marke=car.marke,
            modelis=car.modelis,
            rezervacijos_pradzia=str(res.rezervacijos_pradzia),
            rezervacijos_pabaiga=str(res.rezervacijos_pabaiga),
        )
        for res, car in rows
    }


# Grąžina {pokalbio_id: PASKUTINĖ žinutė} - SQL parenka tik didžiausio ID žinutę kiekvienam pokalbiui, nekraudama visos istorijos.
def _last_messages_map(db: Session, pokalbio_ids: list[int]) -> dict[int, SupportMessage]:
    if not pokalbio_ids:
        return {}
    latest = db.query(func.max(SupportMessage.zinutes_id)).filter(
        SupportMessage.pokalbio_id.in_(pokalbio_ids)
    ).group_by(SupportMessage.pokalbio_id)
    rows = db.query(SupportMessage).filter(SupportMessage.zinutes_id.in_(latest)).all()
    return {message.pokalbio_id: message for message in rows}


# Paverčia pokalbių sąrašą į "santraukos" formatą (sąrašo/apžvalgos rodymui, ne pilną žinučių turinį) - vienu kreipiniu visiems, ne po vieną kiekvienam pokalbiui.
def _to_summaries(db: Session, convos: list[SupportConversation]) -> list[ConversationSummaryOut]:
    if not convos:
        return []
    pokalbio_ids = [c.pokalbio_id for c in convos]
    rezervacijos_pairs = [(c.rezervacijos_id, c.kliento_id) for c in convos if c.rezervacijos_id]
    last_map = _last_messages_map(db, pokalbio_ids)
    res_map = _reservation_context_map(db, rezervacijos_pairs)

    out = []
    for convo in convos:
        last = last_map.get(convo.pokalbio_id)
        # "Neperskaityta" - paskutinė žinutė yra NUO DARBUOTOJO ir jos ID didesnis už tai, ką klientas paskutinį kartą matė.
        unread = bool(last and last.autoriaus_tipas == "darbuotojas" and last.zinutes_id > (convo.kliento_paskutinis_matytas or 0))
        out.append(ConversationSummaryOut(
            pokalbio_id=convo.pokalbio_id,
            tema=convo.tema,
            kategorija=convo.kategorija,
            busena=convo.busena,
            sukurimo_data=convo.sukurimo_data,
            atnaujinimo_data=convo.atnaujinimo_data,
            paskutine_zinute=last.tekstas if last else None,
            paskutine_zinute_autorius=last.autoriaus_tipas if last else None,
            neperskaityta=unread,
            rezervacija=res_map.get(convo.rezervacijos_id) if convo.rezervacijos_id else None,
            sprendimo_santrauka=convo.sprendimo_santrauka,
        ))
    return out


# Patogumo variantas VIENAM pokalbiui - viduje tiesiog kviečia _to_summaries su sąrašu iš vieno elemento.
def _to_summary(db: Session, convo: SupportConversation) -> ConversationSummaryOut:
    return _to_summaries(db, [convo])[0]


# Žinutės rodo autorių kaip ID darbuotojo žinutėse - šis paverčia tuos ID į vardus (su "AutoRent" prefiksu), kad klientas matytų žmogišką pavadinimą, ne skaičių.
def _author_names_map(db: Session, messages: list[SupportMessage]) -> dict[int, str | None]:
    staff_ids = {m.darbuotojo_id for m in messages if m.autoriaus_tipas == "darbuotojas" and m.darbuotojo_id}
    staff = {e.darbuotojo_id: e.vardas for e in db.query(Employee).filter(Employee.darbuotojo_id.in_(staff_ids)).all()} if staff_ids else {}
    names: dict[int, str | None] = {}
    for m in messages:
        if m.autoriaus_tipas != "darbuotojas":
            names[m.zinutes_id] = None
        else:
            # Klientui rodomas TIK darbuotojo vardas (su "AutoRent" priešdėliu) - jo el. paštas ir telefono numeris NIEKADA neatskleidžiami, kad klientas neturėtų darbuotojo asmeninio kontakto ir visa komunikacija vyktų TIK per šią pokalbių sistemą.
            vardas = staff.get(m.darbuotojo_id)
            names[m.zinutes_id] = f"AutoRent ({vardas})" if vardas else "AutoRent"
    return names


# Pilnas pokalbio vaizdas VISOMIS žinutėmis (ne tik santrauka) - naudojamas vieno konkretaus pokalbio puslapiui.
def _to_detail(db: Session, convo: SupportConversation) -> ConversationDetailOut:
    messages = (
        db.query(SupportMessage)
        .filter(SupportMessage.pokalbio_id == convo.pokalbio_id)
        .order_by(SupportMessage.zinutes_id.asc())
        .all()
    )
    summary = _to_summary(db, convo)
    author_names = _author_names_map(db, messages)
    return ConversationDetailOut(
        **summary.model_dump(),
        zinutes=[
            MessageOut(
                zinutes_id=m.zinutes_id,
                autoriaus_tipas=m.autoriaus_tipas,
                autorius_vardas=author_names.get(m.zinutes_id),
                tekstas=m.tekstas,
                sukurimo_data=m.sukurimo_data,
            )
            for m in messages
        ],
    )


# Suranda pokalbį IR patikrina, kad jis priklauso TAM PAČIAM klientui - kitaip 404 (ne 403), kad klientas negalėtų atspėti, ar svetimas pokalbio ID egzistuoja.
def _get_owned(db: Session, pokalbio_id: int, kliento_id: int) -> SupportConversation:
    convo = db.query(SupportConversation).filter(SupportConversation.pokalbio_id == pokalbio_id).first()
    if not convo or convo.kliento_id != kliento_id:
        raise HTTPException(status_code=404, detail="Pokalbis nerastas")
    return convo


# Klientas pradeda NAUJĄ pagalbos pokalbį (iškart su pirma žinute) - gali būti susietas su konkrečia rezervacija.
@router.post("/conversations", response_model=ConversationDetailOut, operation_id="createCustomerConversation")
@limiter.limit("10/minute")
def create_conversation(
    payload: ConversationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    convo = support_service.create_conversation(
        db, current_customer.kliento_id, payload.tema, payload.pranesimas,
        payload.kategorija, payload.rezervacijos_id,
    )
    return _to_detail(db, convo)


# Grąžina VISUS kliento pokalbius (santraukos formatu), naujausius pirma.
@router.get("/conversations", response_model=list[ConversationSummaryOut], operation_id="getCustomerConversations")
def list_conversations(db: Session = Depends(get_db), current_customer: Client = Depends(get_current_customer)):
    convos = (
        db.query(SupportConversation)
        .filter(SupportConversation.kliento_id == current_customer.kliento_id)
        .order_by(desc(SupportConversation.atnaujinimo_data))
        .all()
    )
    return _to_summaries(db, convos)


# Grąžina VIENĄ pokalbį su visomis žinutėmis - tik jei jis priklauso ŠIAM klientui (žr. _get_owned aukščiau).
@router.get("/conversations/{pokalbio_id}", response_model=ConversationDetailOut, operation_id="getCustomerConversation")
def get_conversation(
    pokalbio_id: int,
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    convo = _get_owned(db, pokalbio_id, current_customer.kliento_id)
    return _to_detail(db, convo)


# Klientas rašo NAUJĄ žinutę į JAU esamą pokalbį.
@router.post("/conversations/{pokalbio_id}/messages", response_model=ConversationDetailOut, operation_id="addCustomerMessage")
@limiter.limit("30/minute")
def add_message(
    pokalbio_id: int,
    payload: MessageCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    convo = _get_owned(db, pokalbio_id, current_customer.kliento_id)
    support_service.add_customer_message(db, convo, current_customer.kliento_id, payload.tekstas)
    return _to_detail(db, convo)


# Pažymi, kiek toliausiai klientas matė žinutes - naudojama "neperskaityta" žymai (žr. _to_summaries aukščiau).
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
