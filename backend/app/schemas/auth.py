# Darbuotojų (ne kliento, žr. customer_auth.py) prisijungimo/profilio formos - naudojamos auth.py endpoint'uose.
from pydantic import BaseModel
from datetime import date

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
