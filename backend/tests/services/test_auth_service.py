import datetime
import pytest
from jose import jwt, JWTError, ExpiredSignatureError

from app.services import auth_service

# auth_service.py apibrėžia SECRET_KEY/ALGORITHM kaip modulio konstantas (ne funkcijas) - juos reikia perskaityti čia, kad testai galėtų PATYS dekoduoti tokenus tais pačiais raktais, kuriuos naudoja create_access_token.
SECRET_KEY = auth_service.SECRET_KEY
ALGORITHM = auth_service.ALGORITHM


# Bcrypt hash'as NIEKADA nelygus originaliam slaptažodžiui (vienpusis maišymas), bet verify_password turi atpažinti TEISINGĄ slaptažodį.
def test_password_hash_and_verify():
    password = "SlaptasTestas!@#"
    hashed = auth_service.get_password_hash(password)

    assert isinstance(hashed, str)
    assert hashed != password
    assert auth_service.verify_password(password, hashed)


# Tas pats hash'as kaip aukščiau, bet NETEISINGAS slaptažodis - verify_password turi atmesti, ne tyliai praleisti.
def test_verify_password_fail():
    password = "SlaptasTestas!@#"
    hashed = auth_service.get_password_hash(password)
    assert not auth_service.verify_password("blogas", hashed)


# Tokeno kūrimas IR dekodavimas - create_access_token perduoda VISUS žodyno laukus (žr. "to_encode.update" auth_service.py), tad "role" PRIVALO pasiekti dekoduotą tokeną taip pat, kaip "sub".
def test_create_access_token_and_decode():
    user_data = {"sub": "test@viko.lt", "role": "employee"}
    token = auth_service.create_access_token(user_data)
    assert isinstance(token, str)

    decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert decoded["sub"] == user_data["sub"]
    assert decoded["role"] == user_data["role"]


# Struktūriškai neteisingas tekstas (ne JWT formatas) turi mesti JWTError, ne grąžinti klaidingus duomenis ar kitą klaidos tipą.
def test_decode_access_token_invalid():
    with pytest.raises(JWTError):
        jwt.decode("this.is.not.a.jwt", SECRET_KEY, algorithms=[ALGORITHM])


# expires_delta parametras niekur projekte realiai nenaudojamas (visur numatytasis ACCESS_TOKEN_EXPIRE_MINUTES) - šis testas garantuoja, kad jis VEIKIA, jei kada prireiktų.
def test_create_access_token_custom_expires_delta():
    token = auth_service.create_access_token({"sub": "custom@viko.lt"}, expires_delta=datetime.timedelta(minutes=5))
    decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    lifetime_seconds = decoded["exp"] - decoded["iat"]
    assert lifetime_seconds == 5 * 60


# Rankiniu būdu užkoduotas tokenas su PRAĖJUSIU "exp" - jose biblioteka turi atmesti su ExpiredSignatureError (paveldi iš JWTError), nepriklausomai nuo parašo galiojimo.
def test_decode_access_token_expired():
    payload = {
        "sub": "test@viko.lt",
        "role": "employee",
        "exp": datetime.datetime.utcnow() - datetime.timedelta(seconds=10),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    with pytest.raises(ExpiredSignatureError):
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
