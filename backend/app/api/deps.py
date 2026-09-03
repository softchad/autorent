from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.repositories.employee import get_by_email
from app.repositories.client import get_by_email as get_client_by_email
from app.services.auth_service import SECRET_KEY, ALGORITHM
from app.models.employee import Employee
from app.models.client import Client

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/token")


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Employee:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        # Kliento tokenas niekada neturi būti priimtas kaip darbuotojo, net jei
        # tas pats el. paštas sutampa abiejose lentelėse - riba yra tokeno tipas,
        # ne vien tai, ar el. paštas rastas Darbuotojai lentelėje.
        if payload.get("type") == "customer":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = get_by_email(db, email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def get_current_customer(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Client:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        # Simetriška taisyklė kaip get_current_user aukščiau - darbuotojo tokenas
        # čia negalioja, tikrinama pagal aiškų tipą, ne tik lentelės paiešką.
        if not email or payload.get("type") != "customer":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    customer = get_client_by_email(db, email)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer
