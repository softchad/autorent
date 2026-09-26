# Bendri FastAPI "Depends" sargai - naudojami VISUOSE endpoint'ų failuose, kad kiekvienas pats iš naujo neperrašytų "surask DB sesiją"/"kas yra prisijungęs" logikos.
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

# OAuth2PasswordBearer - FastAPI priemonė, kuri automatiškai iš "Authorization: Bearer <token>" HTTP antraštės išima PATĮ tokeną (tekstu); "tokenUrl" tik Swagger UI'ui parodyti, KUR gauti tokeną, pats sargas jo neskambina.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/token")


# "dependency" (priklausomybė) - FastAPI funkcija, kurią endpoint'as nurodo per Depends(...) ir kuri paleidžiama AUTOMATIŠKAI prieš patį endpoint'o kodą; čia - duoda VIENĄ DB "session" (laikiną ryšį su duomenų baze VIENAI užklausai) ir garantuoja, kad jis bus uždarytas, kai užklausa pasibaigs.
def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        # Jei endpoint'o kodas metė klaidą - atšaukiame NEBAIGTAS DB operacijas, kad pusiau įvykdytas veiksmas neliktų DB.
        db.rollback()
        raise
    finally:
        # "yield" (ne "return") - kodas PO yield paleidžiamas TIK kai užklausa baigta (sėkmingai ar su klaida), tad čia saugu uždaryti sesiją - FastAPI pati pasirūpina šia tvarka.
        db.close()

# Patvirtina, kad užklausą atlieka PRISIJUNGĘS DARBUOTOJAS (ne klientas) - naudojamas kone visuose administravimo endpoint'uose per Depends(get_current_user).
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Employee:
    try:
        # "jwt.decode" - JWT (JSON Web Token, "skaitmeninis bilietas") patikrinimas: ar parašas sutampa su SECRET_KEY (reiškia, serveris PATS jį išdavė), ir ar jis NEpasibaigęs. Jei bet kas netinka - meta JWTError žemiau.
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # "sub" (subject) - JWT standartinis laukas "kam šis bilietas priklauso"; šiame projekte tai yra el. paštas.
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        # Kliento tokenas niekada neturi būti priimtas kaip darbuotojo, net jei tas pats el. paštas sutampa abiejose lentelėse - riba yra tokeno "type" laukas, ne vien tai, ar el. paštas rastas Darbuotojai lentelėje.
        if payload.get("type") == "customer":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = get_by_email(db, email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


# Patvirtina, kad užklausą atlieka PRISIJUNGĘS KLIENTAS (ne darbuotojas) - naudojamas customer.py/customer_auth.py/customer_support.py/customer_loyalty.py endpointuose.
def get_current_customer(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Client:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        # Simetriška taisyklė kaip get_current_user aukščiau - darbuotojo tokenas čia negalioja, tikrinama pagal aiškų "type" lauką, ne tik lentelės paiešką.
        if not email or payload.get("type") != "customer":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    customer = get_client_by_email(db, email)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer
