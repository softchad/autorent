from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict
from datetime import date

from app.schemas.location import LocationOut

VALID_PAVARŲ_DEZE  = {"mechaninė", "automatinė", "pusiau automatinė"}
VALID_KURO_TIPAS   = {"benzinas", "dyzelinas", "elektra", "hibridas", "dujos"}
VALID_STATUSAS     = {"laisvas", "isnuomotas", "servise", "remonte"}


class CarBase(BaseModel):
    marke: str
    modelis: str
    metai: int
    numeris: str
    vin_kodas: str
    spalva: str
    kebulo_tipas: str
    pavarų_deze: str
    variklio_turis: float
    galia_kw: int
    kuro_tipas: str
    rida: int
    sedimos_vietos: int
    klimato_kontrole: bool
    navigacija: bool
    kaina_parai: float
    automobilio_statusas: str
    technikines_galiojimas: date
    dabartine_vieta_id: int
    pastabos: Optional[str] = None

    @field_validator("metai")
    @classmethod
    def validate_metai(cls, v: int) -> int:
        if not (1900 <= v <= 2030):
            raise ValueError("Metai turi būti tarp 1900 ir 2030")
        return v

    @field_validator("kaina_parai")
    @classmethod
    def validate_kaina(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Kaina parai turi būti teigiamas skaičius")
        return v

    @field_validator("rida")
    @classmethod
    def validate_rida(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Rida negali būti neigiama")
        return v

    @field_validator("sedimos_vietos")
    @classmethod
    def validate_sedimos_vietos(cls, v: int) -> int:
        if not (2 <= v <= 9):
            raise ValueError("Sėdimų vietų skaičius turi būti tarp 2 ir 9")
        return v

    @field_validator("galia_kw")
    @classmethod
    def validate_galia(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Galia (kW) turi būti teigiamas skaičius")
        return v

    @field_validator("pavarų_deze")
    @classmethod
    def validate_pavarų_deze(cls, v: str) -> str:
        if v not in VALID_PAVARŲ_DEZE:
            raise ValueError(f"Negalima pavarų dėžė. Leistinos: {', '.join(VALID_PAVARŲ_DEZE)}")
        return v

    @field_validator("kuro_tipas")
    @classmethod
    def validate_kuro_tipas(cls, v: str) -> str:
        if v not in VALID_KURO_TIPAS:
            raise ValueError(f"Negalimas kuro tipas. Leistini: {', '.join(VALID_KURO_TIPAS)}")
        return v

    @field_validator("automobilio_statusas")
    @classmethod
    def validate_statusas(cls, v: str) -> str:
        if v not in VALID_STATUSAS:
            raise ValueError(f"Negalimas statusas. Leistini: {', '.join(VALID_STATUSAS)}")
        return v


class CarCreate(CarBase):
    pass


class CarUpdate(BaseModel):
    marke: Optional[str] = None
    modelis: Optional[str] = None
    metai: Optional[int] = None
    numeris: Optional[str] = None
    vin_kodas: Optional[str] = None
    spalva: Optional[str] = None
    kebulo_tipas: Optional[str] = None
    pavarų_deze: Optional[str] = None
    variklio_turis: Optional[float] = None
    galia_kw: Optional[int] = None
    kuro_tipas: Optional[str] = None
    rida: Optional[int] = None
    sedimos_vietos: Optional[int] = None
    klimato_kontrole: Optional[bool] = None
    navigacija: Optional[bool] = None
    kaina_parai: Optional[float] = None
    automobilio_statusas: Optional[str] = None
    technikines_galiojimas: Optional[date] = None
    dabartine_vieta_id: Optional[int] = None
    pastabos: Optional[str] = None

    @field_validator("metai")
    @classmethod
    def validate_metai(cls, v: int) -> int:
        if v is not None and not (1900 <= v <= 2030):
            raise ValueError("Metai turi būti tarp 1900 ir 2030")
        return v

    @field_validator("kaina_parai")
    @classmethod
    def validate_kaina(cls, v: float) -> float:
        if v is not None and v <= 0:
            raise ValueError("Kaina parai turi būti teigiamas skaičius")
        return v

    @field_validator("automobilio_statusas")
    @classmethod
    def validate_statusas(cls, v: str) -> str:
        if v is not None and v not in VALID_STATUSAS:
            raise ValueError(f"Negalimas statusas. Leistini: {', '.join(VALID_STATUSAS)}")
        return v

    class Config:
        from_attributes = True


class CarOut(CarBase):
    automobilio_id: int
    lokacija: Optional[LocationOut]
    links: List[Dict]

    class Config:
        from_attributes = True


class CarStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSAS:
            raise ValueError(f"Negalimas statusas. Leistini: {', '.join(VALID_STATUSAS)}")
        return v
