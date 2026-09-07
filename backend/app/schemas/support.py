from datetime import datetime
from pydantic import BaseModel


class ConversationCreate(BaseModel):
    tema: str
    kategorija: str = "kita"
    pranesimas: str
    rezervacijos_id: int | None = None


class MessageCreate(BaseModel):
    tekstas: str


class NoteCreate(BaseModel):
    tekstas: str


class ResolveRequest(BaseModel):
    santrauka: str


class StaffMessageCreate(BaseModel):
    tekstas: str
    busena: str  # "sprendziama" | "laukiama_kliento"


class ReassignRequest(BaseModel):
    darbuotojo_id: int


class SeenRequest(BaseModel):
    zinutes_id: int


class ReservationContext(BaseModel):
    rezervacijos_id: int
    marke: str
    modelis: str
    rezervacijos_pradzia: str
    rezervacijos_pabaiga: str

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    zinutes_id: int
    autoriaus_tipas: str
    autorius_vardas: str | None = None  # "AutoRent (Vardas)" arba kliento vardas - niekada el.paštas/tel.
    tekstas: str
    sukurimo_data: datetime

    class Config:
        from_attributes = True


class NoteOut(BaseModel):
    pastabos_id: int
    darbuotojo_vardas: str
    tekstas: str
    sukurimo_data: datetime

    class Config:
        from_attributes = True


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


class ConversationDetailOut(ConversationSummaryOut):
    zinutes: list[MessageOut]


class StaffConversationSummaryOut(ConversationSummaryOut):
    kliento_vardas: str
    darbuotojo_id: int | None = None
    darbuotojo_vardas: str | None = None
    reikia_atsakyti: bool = False


class StaffConversationDetailOut(StaffConversationSummaryOut):
    zinutes: list[MessageOut]
    pastabos: list[NoteOut]
