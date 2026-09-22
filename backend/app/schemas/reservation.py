# Rezervacijų "formos" - ReservationCreate/ReservationUpdate apibrėžia, kokius laukus PRIIMAME, ReservationOut/ReservationSummary - kokius GRĄŽINAME.
from pydantic import BaseModel, field_validator, model_validator
from datetime import date
from typing import List, Dict, Optional

# Turi atitikti database/schema.sql ENUM reikšmes TIKSLIAI.
VALID_BUSENA = {"patvirtinta", "atšaukta", "laukia"}


class ReservationBase(BaseModel):
    kliento_id: int
    automobilio_id: int
    rezervacijos_pradzia: date
    rezervacijos_pabaiga: date
    busena: str

    @field_validator("busena")
    @classmethod
    def validate_busena(cls, v: str) -> str:
        if v not in VALID_BUSENA:
            raise ValueError(f"Negalima būsena. Leistinos: {', '.join(VALID_BUSENA)}")
        return v

    # "model_validator" (ne field_validator) - nes čia reikia PALYGINTI DU laukus tarpusavyje (pradžią su pabaiga), ne patikrinti vieną atskirai.
    @model_validator(mode="after")
    def validate_dates(self) -> "ReservationBase":
        if self.rezervacijos_pabaiga and self.rezervacijos_pradzia:
            if self.rezervacijos_pabaiga <= self.rezervacijos_pradzia:
                raise ValueError("Pabaigos data turi būti vėlesnė nei pradžios data")
        return self


class ReservationCreate(ReservationBase):
    pass


# NEgali paveldėti ReservationBase - visi laukai čia pasirenkami (dalinis atnaujinimas). validate_dates iš ReservationBase ČIA NEPASIEKIAMA (dalinis atnaujinimas gali atsiųsti TIK VIENĄ datą) - TA PATI patikra atliekama RANKA endpoint'e (reservation.py update_reservation), kuris sujungia naujas reikšmes su esamomis PRIEŠ tikrinant.
class ReservationUpdate(BaseModel):
    kliento_id: Optional[int] = None
    automobilio_id: Optional[int] = None
    rezervacijos_pradzia: Optional[date] = None
    rezervacijos_pabaiga: Optional[date] = None
    busena: Optional[str] = None

    @field_validator("busena")
    @classmethod
    def validate_busena(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_BUSENA:
            raise ValueError(f"Negalima būsena. Leistinos: {', '.join(VALID_BUSENA)}")
        return v


class ReservationOut(ReservationBase):
    rezervacijos_id: int
    links: List[Dict]


# Skirtingai nuo ReservationOut - šitas papildo AUTOMOBILIO ir KLIENTO vardus (JOIN repozitorijoje, žr. get_latest_reservations_with_details) - naudojamas darbuotojų dashboard'o "naujausios rezervacijos" sąrašui.
class ReservationSummary(BaseModel):
    rezervacijos_id: int
    kliento_id: int
    automobilio_id: int
    rezervacijos_pradzia: date
    rezervacijos_pabaiga: date
    busena: str
    marke: str
    modelis: str
    vardas: str
    pavarde: str
    links: List[Dict]
