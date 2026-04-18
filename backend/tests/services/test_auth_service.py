import datetime
import pytest
from jose import jwt, JWTError, ExpiredSignatureError

from app.services import auth_service

SECRET_KEY = getattr(auth_service, "SECRET_KEY", None) or getattr(auth_service, "SECRET", None)
ALGORITHM = getattr(auth_service, "ALGORITHM", "HS256")


def test_password_hash_and_verify():
    password = "SlaptasTestas!@#"
    hashed = auth_service.get_password_hash(password)

    assert isinstance(hashed, str)
    assert hashed != password
    assert auth_service.verify_password(password, hashed)


def test_verify_password_fail():
    password = "SlaptasTestas!@#"
    hashed = auth_service.get_password_hash(password)
    assert not auth_service.verify_password("blogas", hashed)


def test_create_access_token_and_decode():
    assert SECRET_KEY is not None, "SECRET_KEY turi būti aprašytas auth_service modulyje"

    user_data = {"sub": "test@viko.lt", "role": "employee"}
    token = auth_service.create_access_token(user_data)
    assert isinstance(token, str)

    decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert decoded["sub"] == user_data["sub"]
    if "role" in decoded:
        assert decoded["role"] == user_data["role"]


def test_decode_access_token_invalid():
    assert SECRET_KEY is not None
    with pytest.raises(JWTError):
        jwt.decode("this.is.not.a.jwt", SECRET_KEY, algorithms=[ALGORITHM])


def test_decode_access_token_expired():
    assert SECRET_KEY is not None

    payload = {
        "sub": "test@viko.lt",
        "role": "employee",
        "exp": datetime.datetime.utcnow() - datetime.timedelta(seconds=10),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    with pytest.raises(ExpiredSignatureError):
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
