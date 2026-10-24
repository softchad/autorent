# Slaptažodžių maišymas ir JWT ("skaitmeninio bilieto") kūrimas - naudojama VISUR, kur reikia patikrinti/išduoti prisijungimą (darbuotojų auth.py IR klientų customer_auth.py).
import bcrypt
from jose import jwt
from datetime import datetime, timedelta
from utils.config import settings

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
STAFF_TOKEN_EXPIRE_MINUTES = 12 * 60

# Slaptažodis ribojamas iki 72 UTF-8 baitų, nes bcrypt ilgesnės reikšmės nepalaiko; ribą tikrina autentifikacijos schemos ir šio failo maišymo bei tikrinimo funkcijos.
MAX_PASSWORD_BYTES = 72

# Paverčia patikrintą slaptažodį UTF-8 baitais, kurių ilgį riboja bcrypt.
def _bcrypt_bytes(password: str) -> bytes:
    return password.encode("utf-8")

# Tikrina, ar PLAIN (neužšifruotas) slaptažodis atitinka SAUGOMĄ hash'ą - naudojama prisijungimo metu. Bcrypt - VIENPUSIS maišymo algoritmas: iš slaptažodžio galima gauti hash'ą, bet IŠ hash'o slaptažodžio atgal atgauti negalima.
def verify_password(plain_password: str, hashed_password: str) -> bool:
    if len(plain_password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        return False
    return bcrypt.checkpw(_bcrypt_bytes(plain_password), hashed_password.encode("utf-8"))

# Verčia PLAIN slaptažodį į hash'ą - naudojama registracijos/slaptažodžio keitimo metu, PRIEŠ įrašant į DB (DB niekada nelaiko tikro slaptažodžio). "gensalt()" kiekvieną kartą sugeneruoja NAUJĄ atsitiktinę "druską", tad TAS PATS slaptažodis du kartus maišant duoda SKIRTINGĄ hash'ą.
def get_password_hash(password: str) -> str:
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError("Slaptažodis negali viršyti 72 UTF-8 baitų.")
    return bcrypt.hashpw(_bcrypt_bytes(password), bcrypt.gensalt()).decode("utf-8")

# JWT yra pasirašytas prisijungimo bilietas: naršyklė jį siunčia Authorization antraštėje, o deps.py patikrina parašą, galiojimą ir paskyros duomenis bazėje.
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    # ".copy()" - kad NEpakeistume kviečiančio kodo ORIGINALAUS žodyno, pridedant "iat"/"exp" laukus tik į KOPIJĄ.
    to_encode = data.copy()
    now = datetime.utcnow()
    # „iat“ žymi išdavimo laiką, „exp“ – galiojimo pabaigą; darbuotojams perduodama ilgesnė darbo pamainos trukmė.
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"iat": now, "exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# "sub" YRA darbuotojo_id (NE el_pastas) - el. paštas yra MUTUOJAMA reikšmė; jei tokenas būtų pasirašytas su SENU el. paštu, jis vėliau galėtų klaidingai atpažinti KITĄ (naują) darbuotoją, kuris užregistruotų TĄ PATĮ, jau "atlaisvintą" el. paštą (žr. deps.py get_current_user). "ver"=employee.token_version - leidžia ATŠAUKTI šį konkretų tokeną ateityje, net jei jo parašas/galiojimas liktų teisingi.
def create_staff_token(employee, auth: str | None = None) -> str:
    data = {"sub": str(employee.darbuotojo_id), "type": "staff", "ver": employee.token_version}
    if auth:
        data["auth"] = auth
    return create_access_token(data, expires_delta=timedelta(minutes=STAFF_TOKEN_EXPIRE_MINUTES))


# Tas pats principas kaip create_staff_token aukščiau, klientams.
def create_customer_token(customer, auth: str | None = None) -> str:
    data = {"sub": str(customer.kliento_id), "type": "customer", "ver": customer.token_version}
    if auth:
        data["auth"] = auth
    return create_access_token(data)
