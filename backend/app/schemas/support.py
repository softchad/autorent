# Pagalbos pokalbių formos - BENDROS klientui (customer_support.py) ir darbuotojui (staff_support.py). Teksto laukų (tema/pranesimas/tekstas/santrauka) ilgio patikra vyksta NE čia, o support_service.py _clean() funkcijoje - viena vieta abiem pusėms, ne dubliuoti field_validator'iai.
from datetime import datetime
from pydantic import BaseModel


# Kliento NAUJO pokalbio sukūrimas - "rezervacijos_id" pasirenkamas, jei pokalbis apie konkrečią rezervaciją.
class ConversationCreate(BaseModel):
    tema: str
    kategorija: str = "kita"
    pranesimas: str
    rezervacijos_id: int | None = None


# Kliento NAUJA žinutė į JAU esamą pokalbį.
class MessageCreate(BaseModel):
    tekstas: str


# Darbuotojo VIDINĖ pastaba - niekada nerodoma klientui.
class NoteCreate(BaseModel):
    tekstas: str


class ResolveRequest(BaseModel):
    santrauka: str


# Darbuotojo atsakymas klientui - "busena" nurodo, kas toliau (patikra VALID_KATEGORIJOS/NEXT_STAFF_STATUSES vyksta support_service.py, ne čia).
class StaffMessageCreate(BaseModel):
    tekstas: str
    busena: str  # "sprendziama" | "laukiama_kliento"


class ReassignRequest(BaseModel):
    darbuotojo_id: int


# "zinutes_id" - KURI žinutė paskutinė matyta (naudojama "neperskaityta" žymai skaičiuoti, žr. endpoints/mark_seen).
class SeenRequest(BaseModel):
    zinutes_id: int


# Rodoma pokalbio šalia, jei jis susietas su konkrečia rezervacija - kad darbuotojas/klientas matytų, KOKIU automobiliu klausiama, nereikėdami atskirai jos atsidaryti.
class ReservationContext(BaseModel):
    rezervacijos_id: int
    marke: str
    modelis: str
    rezervacijos_pradzia: str
    rezervacijos_pabaiga: str


# VIENA žinutė pokalbyje - "autoriaus_tipas" ("klientas"/"darbuotojas") sako, KAS parašė; "autorius_vardas" formatas SKIRIASI pagal tai, KAM rodoma (žr. _author_names_map abiejuose endpoint'uose).
class MessageOut(BaseModel):
    zinutes_id: int
    autoriaus_tipas: str
    autorius_vardas: str | None = None  # "AutoRent (Vardas)" arba kliento vardas - niekada el.paštas/tel.
    tekstas: str
    sukurimo_data: datetime


# VIENA vidinė pastaba - matoma TIK darbuotojams (žr. StaffConversationDetailOut žemiau, kurio customer_support.py NEnaudoja).
class NoteOut(BaseModel):
    pastabos_id: int
    darbuotojo_vardas: str
    tekstas: str
    sukurimo_data: datetime


# Pokalbio "santrauka" sąrašo rodymui - su PASKUTINE žinute (ne visomis), kad sąrašas nebūtų sunkus siunčiant visą istoriją kiekvienam pokalbiui.
class ConversationSummaryOut(BaseModel):
    pokalbio_id: int
    tema: str
    kategorija: str
    busena: str
    sukurimo_data: datetime
    atnaujinimo_data: datetime
    paskutine_zinute: str | None = None
    paskutine_zinute_autorius: str | None = None
    neperskaityta: bool = False
    rezervacija: ReservationContext | None = None
    sprendimo_santrauka: str | None = None


# Papildo santrauką VISOMIS žinutėmis - naudojama vieno konkretaus pokalbio puslapiui (žr. customer_support.py _to_detail).
class ConversationDetailOut(ConversationSummaryOut):
    zinutes: list[MessageOut]


# DARBUOTOJO pusės santrauka - papildo bendrą ConversationSummaryOut kliento/priskirto darbuotojo info, kurios klientui rodyti nereikia (jis pats žino, kas jis yra).
class StaffConversationSummaryOut(ConversationSummaryOut):
    kliento_vardas: str
    darbuotojo_id: int | None = None
    darbuotojo_vardas: str | None = None
    reikia_atsakyti: bool = False


# DARBUOTOJO pusės detalė - vienintelė vieta, kur "pastabos" (vidinės, klientui NIEKADA nerodomos) patenka į atsakymą.
class StaffConversationDetailOut(StaffConversationSummaryOut):
    zinutes: list[MessageOut]
    pastabos: list[NoteOut]
