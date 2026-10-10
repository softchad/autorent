# Darbuotojų pusė pagalbos pokalbių sistemos - leidžia peržiūrėti, prisiimti ir atsakyti į klientų pokalbius; prieiga apribota ATSKIRU pareigų sąrašu (SUPPORT_ROLES), ne bendra EDIT teise, kurią turi IR mechanikai, bet jie neturi matyti privačių klientų pokalbių.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc  # desc/asc - rikiavimo tvarka (žr. list_conversations žemiau, kodėl kartais reikia AUGANČIOS, ne mažėjančios)

from app.api.deps import get_db, get_current_user
from app.models.employee import Employee
from app.models.client import Client
from app.models.support_conversation import SupportConversation
from app.models.support_message import SupportMessage, SupportNote
from app.models.reservation import Reservation  # pokalbis gali būti susietas su konkrečia rezervacija - rodoma kaip kontekstas (žr. _reservation_context_map žemiau)
from app.models.car import Car  # reikalingas rezervacijos kontekstui (kokiu automobiliu klausiama)
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
from app.schemas.discount_code import GenerateDiscountCodeRequest, DiscountCodeOut
from app.services import support_service, discount_code_service  # bendra pokalbių logika (sukūrimas, žinutės, būsenų perėjimai) - naudoja IR šis failas, IR kliento pusės customer_support.py
from app.services.support_service import SUPPORT_ROLES

router = APIRouter(prefix="/support", tags=["Staff Support"])

# TIK vadovai (Administratorius/Vadybininkas) gali perskirti bylą KITAM darbuotojui - eilinis aptarnavimo darbuotojas gali bylą tik PRISIIMTI sau (žr. claim), ne perduoti kam nori.
MANAGER_ROLES = {"Administratorius", "Vadybininkas"}


# Sargas prieš VISUS šio failo endpoint'us (žr. Depends(require_support_access) žemiau) - leidžia tik SUPPORT_ROLES sąraše esančioms pareigoms, net jei darbuotojas turi bendrą EDIT teisę.
def require_support_access(user: Employee = Depends(get_current_user)) -> Employee:
    if user.pareigos not in SUPPORT_ROLES:
        raise HTTPException(status_code=403, detail="Neturite prieigos prie klientų aptarnavimo")
    return user


# Griežtesnis sargas TIK reassign endpoint'ui - reikia MANAGER_ROLES, ne bet kokios aptarnavimo prieigos.
def require_support_manager(user: Employee = Depends(get_current_user)) -> Employee:
    if user.pareigos not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Reikia vadovo teisių")
    return user


# Vienu DB kreipiniu paverčia rezervacijų ID sąrašą į žodyną {rezervacijos_id: automobilio info} - naudojama rodyti, su kokiu automobiliu susijęs pokalbis.
def _reservation_context_map(db: Session, rezervacijos_ids: list[int]) -> dict[int, ReservationContext]:
    # "if i" atmeta None reikšmes - ne visi pokalbiai susieti su rezervacija, tad sąraše gali būti tuščių vietų.
    ids = {i for i in rezervacijos_ids if i}
    if not ids:
        return {}
    rows = (
        db.query(Reservation, Car)
        .join(Car, Reservation.automobilio_id == Car.automobilio_id)
        .filter(Reservation.rezervacijos_id.in_(ids))
        .all()
    )
    return {
        res.rezervacijos_id: ReservationContext(
            rezervacijos_id=res.rezervacijos_id, marke=car.marke, modelis=car.modelis,
            rezervacijos_pradzia=str(res.rezervacijos_pradzia), rezervacijos_pabaiga=str(res.rezervacijos_pabaiga),
        )
        for res, car in rows
    }


# Grąžina {pokalbio_id: PASKUTINĖ žinutė} - rikiuojame SENIAUSIAS pirmi ir tiesiog PERRAŠOME žodyną eidami per visas, tad paskutinis perrašymas visada yra naujausia žinutė.
def _last_messages_map(db: Session, pokalbio_ids: list[int]) -> dict[int, SupportMessage]:
    if not pokalbio_ids:
        return {}
    rows = (
        db.query(SupportMessage)
        .filter(SupportMessage.pokalbio_id.in_(pokalbio_ids))
        .order_by(SupportMessage.zinutes_id.asc())
        .all()
    )
    last: dict[int, SupportMessage] = {}
    for m in rows:
        last[m.pokalbio_id] = m
    return last


# Žinutės DB laikomos su autoriaus ID (darbuotojo arba kliento) - šis paverčia tuos ID į žmogiškus vardus, kad darbuotojų sąsaja matytų vardus, ne skaičius (skirtingai nei customer_support.py, darbuotojas ČIA matosi su TIKRU vardu, ne "AutoRent" prefiksu).
def _author_names_map(db: Session, messages: list[SupportMessage]) -> dict[int, str]:
    staff_ids = {m.darbuotojo_id for m in messages if m.autoriaus_tipas == "darbuotojas" and m.darbuotojo_id}
    client_ids = {m.kliento_id for m in messages if m.autoriaus_tipas != "darbuotojas" and m.kliento_id}
    staff = {e.darbuotojo_id: e.vardas for e in db.query(Employee).filter(Employee.darbuotojo_id.in_(staff_ids)).all()} if staff_ids else {}
    clients = {
        c.kliento_id: f"{c.vardas} {c.pavarde}" for c in db.query(Client).filter(Client.kliento_id.in_(client_ids)).all()
    } if client_ids else {}
    names: dict[int, str] = {}
    for m in messages:
        if m.autoriaus_tipas == "darbuotojas":
            names[m.zinutes_id] = staff.get(m.darbuotojo_id, "Darbuotojas")
        else:
            names[m.zinutes_id] = clients.get(m.kliento_id, "Klientas")
    return names


# Paverčia pokalbių sąrašą į "santraukos" formatą sąrašo rodymui - vienu kreipiniu VISIEMS susijusiems klientams/darbuotojams/rezervacijoms, ne po vieną kiekvienam pokalbiui.
def _to_summaries(db: Session, convos: list[SupportConversation]) -> list[StaffConversationSummaryOut]:
    if not convos:
        return []
    # Visi reikalingi ID surenkami iš KARTO iš VISŲ pokalbių, kad žemiau būtų galima užklausti VIENU kreipiniu kiekvienai susijusiai lentelei (klientai/darbuotojai/rezervacijos), ne po vieną užklausą KIEKVIENAM pokalbiui atskirai.
    pokalbio_ids = [c.pokalbio_id for c in convos]
    kliento_ids = {c.kliento_id for c in convos}
    darbuotojo_ids = {c.darbuotojo_id for c in convos if c.darbuotojo_id}
    rezervacijos_ids = [c.rezervacijos_id for c in convos if c.rezervacijos_id]

    last_map = _last_messages_map(db, pokalbio_ids)
    clients = {c.kliento_id: c for c in db.query(Client).filter(Client.kliento_id.in_(kliento_ids)).all()} if kliento_ids else {}
    agents = {e.darbuotojo_id: e for e in db.query(Employee).filter(Employee.darbuotojo_id.in_(darbuotojo_ids)).all()} if darbuotojo_ids else {}
    res_map = _reservation_context_map(db, rezervacijos_ids)

    out = []
    for convo in convos:
        last = last_map.get(convo.pokalbio_id)
        # "Neperskaityta" DARBUOTOJUI - paskutinė žinutė yra NUO KLIENTO (atvirkščiai nei customer_support.py) ir jos ID didesnis už tai, ką darbuotojas paskutinį kartą matė.
        unread = bool(last and last.autoriaus_tipas == "klientas" and last.zinutes_id > (convo.darbuotojo_paskutinis_matytas or 0))
        client = clients.get(convo.kliento_id)
        agent = agents.get(convo.darbuotojo_id) if convo.darbuotojo_id else None
        out.append(StaffConversationSummaryOut(
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
            # "#id" atsarginis variantas - praktiškai NIEKADA neįvyksta (Klientai eilutė negali būti ištrinta, kol yra susietų pokalbių, žr. client.py), bet paliktas kaip apsauga nuo nenuspėtų duomenų nesuderinamumų.
            kliento_vardas=f"{client.vardas} {client.pavarde}" if client else f"#{convo.kliento_id}",
            darbuotojo_id=convo.darbuotojo_id,
            darbuotojo_vardas=agent.vardas if agent else None,
            # "atvira" būsena reiškia, kad PASKUTINIS veiksmas buvo kliento (nauja byla arba klientas atsakė) - darbuotojas TURI sureaguoti.
            reikia_atsakyti=(convo.busena == "atvira"),
        ))
    return out


# Patogumo variantas VIENAM pokalbiui - viduje tiesiog kviečia _to_summaries su sąrašu iš vieno elemento.
def _to_summary(db: Session, convo: SupportConversation) -> StaffConversationSummaryOut:
    return _to_summaries(db, [convo])[0]


# Pilnas pokalbio vaizdas VISOMIS žinutėmis IR vidinėmis pastabomis - naudojamas vieno konkretaus pokalbio puslapiui, ne sąrašui.
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
    message_authors = _author_names_map(db, messages)
    note_author_ids = {n.darbuotojo_id for n in notes}
    note_authors = {
        e.darbuotojo_id: e.vardas for e in db.query(Employee).filter(Employee.darbuotojo_id.in_(note_author_ids)).all()
    } if note_author_ids else {}
    return StaffConversationDetailOut(
        **summary.model_dump(),
        zinutes=[
            MessageOut(
                zinutes_id=m.zinutes_id, autoriaus_tipas=m.autoriaus_tipas,
                autorius_vardas=message_authors.get(m.zinutes_id), tekstas=m.tekstas, sukurimo_data=m.sukurimo_data,
            )
            for m in messages
        ],
        pastabos=[
            NoteOut(
                pastabos_id=n.pastabos_id,
                # "?" - apsauginis atsarginis variantas, jei autoriaus darbuotojo įrašas kažkodėl nerastas; normaliu atveju visada bus tikras vardas.
                darbuotojo_vardas=note_authors.get(n.darbuotojo_id, "?"),
                tekstas=n.tekstas, sukurimo_data=n.sukurimo_data,
            )
            for n in notes
        ],
    )


# Suranda pokalbį pagal ID - skirtingai nei customer_support.py _get_owned, čia NĖRA nuosavybės patikros, nes VISI aptarnavimo darbuotojai gali matyti VISUS pokalbius (ne tik savo prisiimtus).
def _get_conversation(db: Session, pokalbio_id: int) -> SupportConversation:
    convo = db.query(SupportConversation).filter(SupportConversation.pokalbio_id == pokalbio_id).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Pokalbis nerastas")
    return convo


# Grąžina pokalbių sąrašą, pasirenkamai filtruotą pagal "filter" parametrą (unassigned/mine/needs_reply/waiting/resolved) - naudojama aptarnavimo darbuotojų pagrindiniam pokalbių sąrašo puslapiui.
@router.get("/conversations", response_model=list[StaffConversationSummaryOut], operation_id="getStaffConversations")
def list_conversations(
    filter: str = "all",
    db: Session = Depends(get_db),
    current_user: Employee = Depends(require_support_access),
):
    # "all" (arba bet kuri neatpažinta reikšmė) NIEKAM iš elif šakų žemiau neatitinka - query lieka NEFILTRUOTAS, tad grąžina VISUS pokalbius.
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

    # "needs_reply" (reikia atsakyti) rikiuojama SENIAUSIA pirma (AUGANČIAI), kitaip - NAUJAUSIA pirma (mažėjančiai), kad laukiančios bylos nebūtų "nustumtos" į sąrašo galą naujesnių bylų.
    order = asc(SupportConversation.atnaujinimo_data) if filter == "needs_reply" else desc(SupportConversation.atnaujinimo_data)
    convos = query.order_by(order).all()
    return _to_summaries(db, convos)


# Grąžina VIENĄ pokalbį su visomis žinutėmis ir pastabomis - naudojama vieno pokalbio puslapiui.
@router.get("/conversations/{pokalbio_id}", response_model=StaffConversationDetailOut, operation_id="getStaffConversation")
def get_conversation(
    pokalbio_id: int, db: Session = Depends(get_db), current_user: Employee = Depends(require_support_access),
):
    convo = _get_conversation(db, pokalbio_id)
    return _to_detail(db, convo)


# Darbuotojas "prisiima" NEPRISKIRTĄ bylą sau - realią logiką (lenktynių apsauga) žr. support_service.claim_conversation.
@router.post("/conversations/{pokalbio_id}/claim", response_model=StaffConversationDetailOut, operation_id="claimStaffConversation")
def claim(
    pokalbio_id: int, db: Session = Depends(get_db), current_user: Employee = Depends(require_support_access),
):
    convo = _get_conversation(db, pokalbio_id)
    support_service.claim_conversation(db, convo, current_user.darbuotojo_id)
    return _to_detail(db, convo)


# Vadovas perskiria bylą KITAM darbuotojui - tik MANAGER_ROLES (žr. require_support_manager aukščiau), eilinis aptarnavimo darbuotojas šito negali.
@router.post("/conversations/{pokalbio_id}/reassign", response_model=StaffConversationDetailOut, operation_id="reassignStaffConversation")
def reassign(
    pokalbio_id: int, request: ReassignRequest, db: Session = Depends(get_db),
    current_user: Employee = Depends(require_support_manager),
):
    convo = _get_conversation(db, pokalbio_id)
    support_service.reassign_conversation(db, convo, request.darbuotojo_id)
    return _to_detail(db, convo)


# Darbuotojas rašo atsakymą klientui - request.busena nurodo, kas toliau (dar sprendžiama, ar laukiama kliento), žr. support_service.add_staff_message dėl "svetimos bylos" patikros.
@router.post("/conversations/{pokalbio_id}/messages", response_model=StaffConversationDetailOut, operation_id="addStaffMessage")
def add_message(
    pokalbio_id: int, request: StaffMessageCreate, db: Session = Depends(get_db),
    current_user: Employee = Depends(require_support_access),
):
    convo = _get_conversation(db, pokalbio_id)
    support_service.add_staff_message(db, convo, current_user.darbuotojo_id, request.tekstas, request.busena)
    return _to_detail(db, convo)


# Darbuotojas prideda VIDINĘ pastabą - niekada nerodoma klientui (žr. support_service.add_note).
@router.post("/conversations/{pokalbio_id}/notes", response_model=StaffConversationDetailOut, operation_id="addStaffNote")
def add_note(
    pokalbio_id: int, request: NoteCreate, db: Session = Depends(get_db),
    current_user: Employee = Depends(require_support_access),
):
    convo = _get_conversation(db, pokalbio_id)
    support_service.add_note(db, convo, current_user.darbuotojo_id, request.tekstas)
    return _to_detail(db, convo)


# Darbuotojas žymi bylą IŠSPRĘSTA su santrauka - galutinė būsena, kol klientas vėl nerašo (žr. support_service.add_customer_message, kuris automatiškai atidaro bylą iš naujo).
@router.post("/conversations/{pokalbio_id}/resolve", response_model=StaffConversationDetailOut, operation_id="resolveStaffConversation")
def resolve(
    pokalbio_id: int, request: ResolveRequest, db: Session = Depends(get_db),
    current_user: Employee = Depends(require_support_access),
):
    convo = _get_conversation(db, pokalbio_id)
    support_service.resolve_conversation(db, convo, request.santrauka)
    return _to_detail(db, convo)


# Pažymi, kiek toliausiai DARBUOTOJAS matė žinutes - naudojama "neperskaityta" žymai sąraše (žr. _to_summaries aukščiau).
@router.post("/conversations/{pokalbio_id}/seen", response_model=StaffConversationSummaryOut, operation_id="markStaffConversationSeen")
def mark_seen(
    pokalbio_id: int, request: SeenRequest, db: Session = Depends(get_db),
    current_user: Employee = Depends(require_support_access),
):
    convo = _get_conversation(db, pokalbio_id)
    support_service.mark_seen(db, convo, is_staff=True, last_seen_id=request.zinutes_id)
    return _to_summary(db, convo)


# Darbuotojas išduoda nuolaidos kodą TAM pokalbio klientui, pvz. atsiprašant už nesklandumą - kliento_id visada iš PAČIO pokalbio (žr. GenerateDiscountCodeRequest komentarą), ne iš užklausos kūno.
@router.post("/conversations/{pokalbio_id}/discount-code", response_model=DiscountCodeOut, operation_id="issueSupportDiscountCode")
def issue_discount_code(
    pokalbio_id: int, request: GenerateDiscountCodeRequest, db: Session = Depends(get_db),
    current_user: Employee = Depends(require_support_access),
):
    convo = _get_conversation(db, pokalbio_id)
    # issue_code TIK flush'ina (neCOMMIT'ina, žr. discount_code_service.py) - čia, skirtingai nei customer_loyalty.py redeem_reward, nėra kito įrašo, su kuriuo reikėtų commit'inti KARTU, tad commit'iname IŠ KARTO.
    code = discount_code_service.issue_code(
        db, convo.kliento_id, request.verte_eur, "aptarnavimas", f"{request.priezastis} (pokalbis #{pokalbio_id})"
    )
    db.commit()
    db.refresh(code)
    return DiscountCodeOut(
        kodo_id=code.kodo_id,
        kodas=code.kodas,
        verte_eur=code.verte_eur,
        kilme=code.kilme,
        pastaba=code.pastaba,
        sukurimo_data=code.sukurimo_data,
        panaudojimo_data=code.panaudojimo_data,
    )
