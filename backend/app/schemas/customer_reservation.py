# Kliento (ne darbuotojo) rezervacijų schemos - kliento_id NIEKADA nepriimamas iš užklausos (nėra šiame faile apskritai), jis visada nustatomas iš prisijungimo tokeno endpoint'e, kad klientas negalėtų sukurti rezervacijos kito kliento vardu.
from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator

from app.services import booking_rules


# Klientas pasirenka TIK automobilį ir datas - likusi info (kliento_id, marke/modelis, kaina) užpildoma serverio pusėje.
class CustomerReservationCreate(BaseModel):
    automobilio_id: int
    date_from: date
    date_to: date

    # Kliento rezervacijos pradžia turi būti šiandien arba ateityje; API schemos patikra galioja ir tiesioginėms užklausoms, nepriklausomai nuo frontend kalendoriaus ribojimų.
    @field_validator("date_from")
    @classmethod
    def validate_date_from_not_past(cls, v: date) -> date:
        if v < booking_rules.today_vilnius():
            raise ValueError("Rezervacijos data negali būti praeityje")
        return v


# Grąžinama klientui apie JO rezervaciją - kaina paskaičiuota serveryje (dienu_skaicius * kaina_parai), ne priimta iš užklausos, kad klientas negalėtų pats sau nustatyti kainos.
class CustomerReservationOut(BaseModel):
    rezervacijos_id: int
    automobilio_id: int
    marke: str
    modelis: str
    rezervacijos_pradzia: date
    rezervacijos_pabaiga: date
    busena: str
    dienu_skaicius: int
    kaina_parai: float
    viso_kaina: float
    # Nauji laukai (svetainės rezervacijoms – tuščios reikšmės, todėl esamas svetainės kodas nepaveiktas).
    paemimo_valanda: int | None = None
    salygu_versija: str | None = None
    paslaugos: list["ReservationExtraOut"] = []
    # Etapas ir leidžiami veiksmai – iš reservation_lifecycle taisyklių lentelės.
    etapas: str = ""
    veiksmai: list[str] = []
    # Ką reikštų atšaukimas dabar; None – atšaukti negalima.
    atsaukimas: "CancellationPreviewOut | None" = None
    atsaukimo_tipas: str | None = None
    atsaukimo_mokestis: float | None = None


class ReservationExtraOut(BaseModel):
    kodas: str
    pavadinimas: str
    kaina_parai: float
    suma: float


# Programėlės patvirtinimo prašymas. Datos ir automobilis imami iš laikymo, klientas – iš tokeno.
class HoldConfirmRequest(BaseModel):
    paslaugos: list[str] = Field(default_factory=list, max_length=10)
    paemimo_valanda: int
    salygu_versija: str = Field(max_length=20)
    sutinku_su_salygomis: bool
    tiketina_kaina: float | None = Field(default=None, ge=0, le=100000000, allow_inf_nan=False)


class CancellationPreviewOut(BaseModel):
    nemokamai: bool
    mokestis: float
    nemokamai_iki: datetime


# Klientas atsiunčia mokestį, kurį matė ekrane; jei tuo metu jis jau kitoks – atšaukimas nevykdomas.
class CancelRequest(BaseModel):
    tiketinas_mokestis: float = Field(ge=0, le=100000)


CustomerReservationOut.model_rebuild()
