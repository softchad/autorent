# Slaptažodžių maišymas ir JWT ("skaitmeninio bilieto") kūrimas - naudojama VISUR, kur reikia patikrinti/išduoti prisijungimą (darbuotojų auth.py IR klientų customer_auth.py).
import bcrypt
from jose import jwt
from datetime import datetime, timedelta
from utils.config import settings

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Bcrypt apdoroja TIK pirmus 72 slaptažodžio baitus (ne simbolius) - ilgesnį tyliai nukarpome PRIEŠ maišymą/tikrinimą, kitaip bcrypt mestų klaidą vietoj to, kad tiesiog ignoruotų likutį.
def _bcrypt_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:72]

# Tikrina, ar PLAIN (neužšifruotas) slaptažodis atitinka SAUGOMĄ hash'ą - naudojama prisijungimo metu. Bcrypt - VIENPUSIS maišymo algoritmas: iš slaptažodžio galima gauti hash'ą, bet IŠ hash'o slaptažodžio atgal atgauti negalima.
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(_bcrypt_bytes(plain_password), hashed_password.encode("utf-8"))

# Verčia PLAIN slaptažodį į hash'ą - naudojama registracijos/slaptažodžio keitimo metu, PRIEŠ įrašant į DB (DB niekada nelaiko tikro slaptažodžio). "gensalt()" kiekvieną kartą sugeneruoja NAUJĄ atsitiktinę "druską", tad TAS PATS slaptažodis du kartus maišant duoda SKIRTINGĄ hash'ą.
def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(_bcrypt_bytes(password), bcrypt.gensalt()).decode("utf-8")

# Sukuria JWT - pasirašytą tekstą, kurį klientas saugo ir siunčia su kiekviena užklausa (Authorization: Bearer <token>), kad serveriui nereikėtų tikrinti DB kiekvienam kreipiniui - pakanka patikrinti parašą.
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    # ".copy()" - kad NEpakeistume kviečiančio kodo ORIGINALAUS žodyno, pridedant "iat"/"exp" laukus tik į KOPIJĄ.
    to_encode = data.copy()
    now = datetime.utcnow()
    # "iat" (issued at) - kada tokenas IŠDUOTAS; "exp" (expires) - kada jis BAIGIA galioti. expires_delta leidžia nustatyti KITOKĮ galiojimo laiką nei numatytasis ACCESS_TOKEN_EXPIRE_MINUTES (šiuo metu nenaudojama - visi kvietimai projekte naudoja numatytąjį).
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"iat": now, "exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
