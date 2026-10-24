# Darbuotojų (ne kliento, žr. customer_auth.py) prisijungimo/profilio formos - naudojamos auth.py endpoint'uose.
from pydantic import BaseModel, field_validator
from datetime import date
from app.services.auth_service import MAX_PASSWORD_BYTES

class LoginRequest(BaseModel):
    el_pastas: str
    slaptazodis: str

# "Bearer" - standartinis žodis, sakantis naršyklei/klientui, KAIP siųsti tokeną: "Authorization: Bearer <token>" antraštėje; tai ne slaptažodis, tiesiog nurodo tokeno TIPĄ.
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

# Grąžinama iš /me - visi Employee laukai, IŠSKYRUS slaptazodis (niekada nerodomas, net savo paskyros peržiūroje).
class UserInfo(BaseModel):
    darbuotojo_id: int
    vardas: str
    pavarde: str
    telefono_nr: str
    el_pastas: str
    pareigos: str
    atlyginimas: float
    isidarbinimo_data: date

class ChangePasswordRequest(BaseModel):
    senas_slaptazodis: str
    naujas_slaptazodis: str

    # Tas pats minimalus ilgis kaip EmployeeCreate.validate_slaptazodis (schemas/employee.py) - be šio, keičiant slaptažodį (ne pirmą kartą nustatant jį) šis apribojimas visai NEgaliotų.
    @field_validator("naujas_slaptazodis")
    @classmethod
    def validate_naujas_slaptazodis(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Slaptažodis turi būti bent 8 simbolių ilgio")
        # žr. customer_auth.py analogišką patikrą.
        if len(v.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError(f"Slaptažodis negali būti ilgesnis nei {MAX_PASSWORD_BYTES} baitų")
        return v
