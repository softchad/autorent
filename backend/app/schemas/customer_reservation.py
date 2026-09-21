# Kliento (ne darbuotojo) rezervacijų schemos - kliento_id NIEKADA nepriimamas iš užklausos (nėra šiame faile apskritai), jis visada nustatomas iš prisijungimo tokeno endpoint'e, kad klientas negalėtų sukurti rezervacijos kito kliento vardu.
from datetime import date
from pydantic import BaseModel


# Klientas pasirenka TIK automobilį ir datas - likusi info (kliento_id, marke/modelis, kaina) užpildoma serverio pusėje.
class CustomerReservationCreate(BaseModel):
    automobilio_id: int
    date_from: date
    date_to: date


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
