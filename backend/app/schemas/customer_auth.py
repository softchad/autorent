# Kliento (ne darbuotojo) prisijungimo schemos. Atskira nuo app/schemas/auth.py,
# nes tai visiškai atskiras identitetas - žr. customer_auth.py endpointą.
from datetime import date, datetime
from pydantic import BaseModel, EmailStr


class CustomerRegisterRequest(BaseModel):
    vardas: str
    pavarde: str
    el_pastas: EmailStr
    telefono_nr: str
    gimimo_data: date
    slaptazodis: str


class CustomerLoginRequest(BaseModel):
    el_pastas: EmailStr
    slaptazodis: str


class CustomerTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CustomerInfo(BaseModel):
    kliento_id: int
    vardas: str
    pavarde: str
    el_pastas: str
    telefono_nr: str
    gimimo_data: date
    registracijos_data: datetime | None = None
    bonus_taskai: int

    class Config:
        from_attributes = True
