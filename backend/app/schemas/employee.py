from pydantic import BaseModel, EmailStr, field_validator
from datetime import date
from typing import Optional, List, Dict


class EmployeeBase(BaseModel):
    vardas: str
    pavarde: str
    el_pastas: EmailStr
    telefono_nr: Optional[str] = None
    pareigos: str
    atlyginimas: float
    isidarbinimo_data: date

    @field_validator("vardas", "pavarde")
    @classmethod
    def validate_names(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Vardas ir pavardė turi būti bent 2 simbolių ilgio")
        return v.strip()

    @field_validator("atlyginimas")
    @classmethod
    def validate_atlyginimas(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Atlyginimas turi būti teigiamas skaičius")
        return v

    @field_validator("pareigos")
    @classmethod
    def validate_pareigos(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Pareigos turi būti bent 2 simbolių ilgio")
        return v.strip()


class EmployeeCreate(EmployeeBase):
    slaptazodis: str

    @field_validator("slaptazodis")
    @classmethod
    def validate_slaptazodis(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Slaptažodis turi būti bent 8 simbolių ilgio")
        return v


class EmployeeUpdate(BaseModel):
    vardas: Optional[str] = None
    pavarde: Optional[str] = None
    el_pastas: Optional[EmailStr] = None
    telefono_nr: Optional[str] = None
    pareigos: Optional[str] = None
    atlyginimas: Optional[float] = None
    isidarbinimo_data: Optional[date] = None
    slaptazodis: Optional[str] = None

    @field_validator("atlyginimas")
    @classmethod
    def validate_atlyginimas(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError("Atlyginimas turi būti teigiamas skaičius")
        return v

    @field_validator("slaptazodis")
    @classmethod
    def validate_slaptazodis(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) < 8:
            raise ValueError("Slaptažodis turi būti bent 8 simbolių ilgio")
        return v


class EmployeeOut(EmployeeBase):
    darbuotojo_id: int
    links: List[Dict]

    class Config:
        from_attributes = True
