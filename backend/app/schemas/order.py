from pydantic import BaseModel, field_validator, model_validator
from datetime import date
from typing import List, Dict, Optional

VALID_BUSENA = {"laukiama", "patvirtinta", "vykdoma", "užbaigta", "atšaukta"}


class OrderBase(BaseModel):
    kliento_id: int
    automobilio_id: int
    darbuotojo_id: int
    nuomos_data: date
    grazinimo_data: date
    paemimo_vietos_id: int
    grazinimo_vietos_id: int
    bendra_kaina: float
    uzsakymo_busena: str
    turi_papildomas_paslaugas: bool

    @field_validator("uzsakymo_busena")
    @classmethod
    def validate_busena(cls, v: str) -> str:
        if v not in VALID_BUSENA:
            raise ValueError(f"Negalima būsena. Leistinos: {', '.join(VALID_BUSENA)}")
        return v

    @field_validator("bendra_kaina")
    @classmethod
    def validate_kaina(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Bendra kaina negali būti neigiama")
        return v

    @model_validator(mode="after")
    def validate_dates(self) -> "OrderBase":
        if self.grazinimo_data and self.nuomos_data:
            if self.grazinimo_data < self.nuomos_data:
                raise ValueError("Grąžinimo data negali būti ankstesnė nei nuomos data")
        return self


class OrderCreate(OrderBase):
    pass


class OrderUpdate(BaseModel):
    uzsakymo_busena: Optional[str] = None
    grazinimo_data: Optional[date] = None
    turi_papildomas_paslaugas: Optional[bool] = None

    @field_validator("uzsakymo_busena")
    @classmethod
    def validate_busena(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_BUSENA:
            raise ValueError(f"Negalima būsena. Leistinos: {', '.join(VALID_BUSENA)}")
        return v


class OrderOut(OrderBase):
    uzsakymo_id: int
    kliento_id: int
    automobilio_id: int
    links: List[Dict]

    class Config:
        from_attributes = True
