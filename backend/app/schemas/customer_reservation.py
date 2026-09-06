# Kliento (ne darbuotojo) rezervacijų schemos. kliento_id niekada nepriimamas iš
# užklausos - jis visada nustatomas iš prisijungimo tokeno (žr. customer.py), kad
# klientas negalėtų sukurti rezervacijos kito kliento vardu.
from datetime import date
from pydantic import BaseModel


class CustomerReservationCreate(BaseModel):
    automobilio_id: int
    date_from: date
    date_to: date


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

    class Config:
        from_attributes = True
