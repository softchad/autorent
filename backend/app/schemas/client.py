from pydantic import BaseModel, EmailStr, field_validator
from datetime import date, datetime
from typing import Optional, List, Dict


class ClientBase(BaseModel):
    vardas: Optional[str] = None
    pavarde: Optional[str] = None
    el_pastas: EmailStr
    telefono_nr: Optional[str] = None
    gimimo_data: Optional[date] = None
    registracijos_data: Optional[datetime] = None
    bonus_taskai: int = 0

    @field_validator("vardas", "pavarde")
    @classmethod
    def validate_names(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v.strip()) < 2:
            raise ValueError("Vardas ir pavardė turi būti bent 2 simbolių ilgio")
        return v.strip() if v else v

    @field_validator("bonus_taskai")
    @classmethod
    def validate_bonus(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Bonus taškų skaičius negali būti neigiamas")
        return v

    @field_validator("telefono_nr")
    @classmethod
    def validate_telefono(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v.strip()) < 6:
            raise ValueError("Telefono numeris per trumpas")
        return v


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    vardas: Optional[str] = None
    pavarde: Optional[str] = None
    el_pastas: Optional[EmailStr] = None
    telefono_nr: Optional[str] = None
    gimimo_data: Optional[date] = None
    registracijos_data: Optional[datetime] = None
    bonus_taskai: Optional[int] = None

    @field_validator("vardas", "pavarde")
    @classmethod
    def validate_names(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v.strip()) < 2:
            raise ValueError("Vardas ir pavardė turi būti bent 2 simbolių ilgio")
        return v.strip() if v else v

    @field_validator("bonus_taskai")
    @classmethod
    def validate_bonus(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("Bonus taškų skaičius negali būti neigiamas")
        return v

    @field_validator("telefono_nr")
    @classmethod
    def validate_telefono(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v.strip()) < 6:
            raise ValueError("Telefono numeris per trumpas")
        return v


class ClientOut(ClientBase):
    kliento_id: int
    bonus_taskai: int = 0
    links: List[Dict]

    class Config:
        from_attributes = True
