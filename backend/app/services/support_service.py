# Pagalbos pokalbių verslo taisyklės (sukūrimas, žinutės, būsenų perėjimai) - BENDRAS failas, kurį naudoja IR customer_support.py (klientas), IR staff_support.py (darbuotojas), kad abi pusės visada veiktų pagal TAS PAČIAS taisykles, nepriklausomai nuo to, kas konkrečiai kviečia.
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.support_conversation import SupportConversation
from app.models.support_message import SupportMessage, SupportNote
from app.models.reservation import Reservation
from app.models.employee import Employee

TEMA_MIN, TEMA_MAX = 3, 150
TEXT_MIN, TEXT_MAX = 1, 5000

VALID_KATEGORIJOS = {"rezervacija", "atsiemimas_grazinimas", "automobilis", "saskaita", "paskyra", "kita"}
NEXT_STAFF_STATUSES = {"sprendziama", "laukiama_kliento"}

# Kurios darbuotojo pareigos turi teisę matyti/tvarkyti klientų pagalbos pokalbius - laikoma ČIA (ne staff_support.py), kad reassign_conversation žemiau galėtų šį sąrašą patikrinti be "atvirkštinio" importo iš endpoint failo į servisą.
SUPPORT_ROLES = {"Administratorius", "Vadybininkas", "Klientų aptarnavimas"}


# Apkarpo tarpus ir patikrina ilgio ribas - naudojama VISUR, kur reikia patikrinti teksto lauką (tema, žinutė, pastaba, santrauka), kad validacija nesikartotų kiekvienoje funkcijoje atskirai.
def _clean(value: str, min_len: int, max_len: int, field: str) -> str:
    v = (value or "").strip()
    if len(v) < min_len or len(v) > max_len:
        raise HTTPException(status_code=400, detail=f"{field} turi būti {min_len}-{max_len} simbolių.")
    return v


# Sukuria NAUJĄ pokalbį IR jo pirmą žinutę VIENU kvietimu - klientas niekada negali pradėti pokalbio be pirmos žinutės, tad šie du veiksmai visada vyksta kartu.
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


# Klientas rašo NAUJĄ žinutę į JAU esamą pokalbį - "kliento_id != convo.kliento_id" tikrinimas čia yra PASKUTINIS saugiklis prieš svetimo pokalbio rašymą, nors endpoint'ai (žr. _get_owned customer_support.py faile) tą patį jau patikrina anksčiau.
def add_customer_message(db: Session, convo: SupportConversation, kliento_id: int, tekstas: str) -> SupportMessage:
    if convo.kliento_id != kliento_id:
        raise HTTPException(status_code=404, detail="Pokalbis nerastas")
    tekstas = _clean(tekstas, TEXT_MIN, TEXT_MAX, "Žinutė")

    msg = SupportMessage(
        pokalbio_id=convo.pokalbio_id, autoriaus_tipas="klientas",
        kliento_id=kliento_id, tekstas=tekstas,
    )
    db.add(msg)
    # Bet kuri kliento žinutė (net į JAU IŠSPRĘSTĄ bylą) grąžina pokalbį atgal į "atvira" būseną - atsakingas darbuotojas ir sprendimo santrauka NEIŠTRINAMI, tiesiog byla vėl laikoma neatsakyta.
    convo.busena = "atvira"
    db.add(convo)
    db.commit()
    db.refresh(msg)
    return msg


# Darbuotojas atsako klientui - "next_status" verčia darbuotoją IŠ KARTO nuspręsti, kas toliau (dar sprendžiama, ar laukiama kliento atsakymo), ne tiesiog palikti seną būseną.
def add_staff_message(
    db: Session, convo: SupportConversation, darbuotojo_id: int, tekstas: str, next_status: str,
) -> SupportMessage:
    # Jei byla JAU priskirta KITAM darbuotojui - šis negali į ją atsakyti, kad du žmonės nerašytų to pačio klientui nesusiderinę.
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


# Darbuotojas "prisiima" NEPRISKIRTĄ bylą - tampa už ją atsakingas, kol kažkas ją perskirs (žr. reassign_conversation žemiau).
def claim_conversation(db: Session, convo: SupportConversation, darbuotojo_id: int) -> SupportConversation:
    if convo.darbuotojo_id is not None:
        # Tas pats darbuotojas pakartotinai "prisiima" SAVO bylą - tai nėra konfliktas, grąžinama kaip yra; SVETIMo priskirta byla - atmetama.
        if convo.darbuotojo_id == darbuotojo_id:
            return convo
        raise HTTPException(status_code=409, detail="Bylą jau prisiėmė kitas darbuotojas")

    # "WHERE darbuotojo_id IS NULL" TIESIOGIAI SQL UPDATE sąlygoje (ne atskiras SELECT+UPDATE) apsaugo nuo lenktynių - jei DU darbuotojai paspaudžia "prisiimti" vienu metu, laimi tas, kurio UPDATE pirmas pasiekia DB, antras gauna 0 pakeistų eilučių ir sužino, kad pavėlavo.
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


# Vadovas priskiria bylą KITAM darbuotojui (pvz. kai kas serga ar krūvis per didelis) - skirtingai nei claim_conversation, čia PERRAŠOMA net jau priskirta byla, nereikia, kad ji būtų neprisiimta.
def reassign_conversation(db: Session, convo: SupportConversation, darbuotojo_id: int) -> SupportConversation:
    target = db.query(Employee).filter(Employee.darbuotojo_id == darbuotojo_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Darbuotojas nerastas")
    # Negalima priskirti bylos darbuotojui, kuris IŠ VISO neturi aptarnavimo prieigos (pvz. mechanikui) - jis net negalėtų jos atsidaryti.
    if target.pareigos not in SUPPORT_ROLES:
        raise HTTPException(status_code=400, detail="Šis darbuotojas neturi aptarnavimo prieigos")

    convo.darbuotojo_id = darbuotojo_id
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return convo


# Darbuotojas žymi bylą IŠSPRĘSTA - santrauka PRIVALOMA, kad kiti darbuotojai (ar pats klientas, grįžęs vėliau) matytų, KAIP klausimas buvo išspręstas, ne tik kad "uždaryta".
def resolve_conversation(db: Session, convo: SupportConversation, santrauka: str) -> SupportConversation:
    santrauka = _clean(santrauka, 1, 1000, "Santrauka")
    convo.busena = "isspresta"
    convo.sprendimo_santrauka = santrauka
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return convo


# Vidinė pastaba (pvz. "skambinau klientui, nepasiekiamas") - matoma TIK darbuotojams, klientui NIEKADA negrąžinama (žr. customer_support.py - jis šios lentelės net neskaito).
def add_note(db: Session, convo: SupportConversation, darbuotojo_id: int, tekstas: str) -> SupportNote:
    tekstas = _clean(tekstas, TEXT_MIN, TEXT_MAX, "Pastaba")
    note = SupportNote(pokalbio_id=convo.pokalbio_id, darbuotojo_id=darbuotojo_id, tekstas=tekstas)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


# Pažymi, kiek TOLIAUSIAI (kurį zinutes_id) ši pusė (darbuotojas arba klientas, žr. "is_staff") matė - naudojama "neperskaityta" žymai skaičiuoti abiejose pusėse.
def mark_seen(db: Session, convo: SupportConversation, is_staff: bool, last_seen_id: int) -> SupportConversation:
    field = "darbuotojo_paskutinis_matytas" if is_staff else "kliento_paskutinis_matytas"
    current = getattr(convo, field) or 0
    # Riba gali tik DIDĖTI - jei vartotojas atsidarė pokalbį SENAME įrenginyje/kortelėje su pasenusiais duomenimis, jis negali atsitiktinai "sumažinti" to, kas jau buvo matyta kitur.
    if last_seen_id > current:
        setattr(convo, field, last_seen_id)
        db.add(convo)
        db.commit()
        db.refresh(convo)
    return convo
