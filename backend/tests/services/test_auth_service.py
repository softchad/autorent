import datetime
import pytest
from types import SimpleNamespace
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


# Neleidžia ilgesniam slaptažodžiui būti laikomam teisingu vien todėl, kad sutampa pirmieji 72 baitai.
def test_password_byte_limit_applies_to_hashing_and_verification():
    valid = "a" * 72
    hashed = auth_service.get_password_hash(valid)
    assert not auth_service.verify_password(valid + "suffix", hashed)
    with pytest.raises(ValueError):
        auth_service.get_password_hash(valid + "suffix")


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


# Patikrina, kad perduota tokeno galiojimo trukmė pakeičia numatytąją.
def test_create_access_token_custom_expires_delta():
    token = auth_service.create_access_token({"sub": "custom@viko.lt"}, expires_delta=datetime.timedelta(minutes=5))
    decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    lifetime_seconds = decoded["exp"] - decoded["iat"]
    assert lifetime_seconds == 5 * 60


# Darbuotojo pamainos trukmė taikoma ir išoriniam prisijungimui, bet neprailgina klientų sesijų.
@pytest.mark.parametrize("auth", [None, "google"])
def test_staff_and_customer_session_lifetimes(auth):
    identity = SimpleNamespace(darbuotojo_id=7, kliento_id=9, token_version=3)
    staff = jwt.decode(auth_service.create_staff_token(identity, auth), SECRET_KEY, algorithms=[ALGORITHM])
    customer = jwt.decode(auth_service.create_customer_token(identity, auth), SECRET_KEY, algorithms=[ALGORITHM])
    assert staff["exp"] - staff["iat"] == 12 * 60 * 60
    assert customer["exp"] - customer["iat"] == 60 * 60
    assert (staff["sub"], staff["type"], staff["ver"]) == ("7", "staff", 3)
    assert (customer["sub"], customer["type"], customer["ver"]) == ("9", "customer", 3)


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
