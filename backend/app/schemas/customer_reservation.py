# Kliento (ne darbuotojo) rezervacijų schemos - kliento_id NIEKADA nepriimamas iš užklausos (nėra šiame faile apskritai), jis visada nustatomas iš prisijungimo tokeno endpoint'e, kad klientas negalėtų sukurti rezervacijos kito kliento vardu.
from datetime import date
from pydantic import BaseModel, field_validator


# Klientas pasirenka TIK automobilį ir datas - likusi info (kliento_id, marke/modelis, kaina) užpildoma serverio pusėje.
class CustomerReservationCreate(BaseModel):
    automobilio_id: int
    date_from: date
    date_to: date

    # Kliento rezervacijos pradžia turi būti šiandien arba ateityje; API schemos patikra galioja ir tiesioginėms užklausoms, nepriklausomai nuo frontend kalendoriaus ribojimų.
    @field_validator("date_from")
    @classmethod
    def validate_date_from_not_past(cls, v: date) -> date:
        if v < date.today():
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
