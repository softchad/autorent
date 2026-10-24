# Bendri FastAPI "Depends" sargai - naudojami VISUOSE endpoint'ų failuose, kad kiekvienas pats iš naujo neperrašytų "surask DB sesiją"/"kas yra prisijungęs" logikos.
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.services.auth_service import SECRET_KEY, ALGORITHM
from app.models.employee import Employee
from app.models.client import Client

# OAuth2PasswordBearer - FastAPI priemonė, kuri automatiškai iš "Authorization: Bearer <token>" HTTP antraštės išima PATĮ tokeną (tekstu); "tokenUrl" tik Swagger UI'ui parodyti, KUR gauti tokeną, pats sargas jo neskambina.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/token")

# Darbuotojo/kliento paieška pagal el. paštą - viena vieta VISIEMS autentikacijos keliams (šis failas, auth.py, customer_auth.py, employee.py, client.py), kad PATS ieškojimo būdas (el_pastas stulpelis) niekada neišsiskirtų tarp jų.
def get_employee_by_email(db: Session, email: str) -> Employee | None:
    return db.query(Employee).filter(Employee.el_pastas == email).first()

# Kliento paieška pagal prisijungimo adresą atskirta nuo darbuotojų, kad paskyrų tipai nesusimaišytų.
def get_client_by_email(db: Session, email: str) -> Client | None:
    return db.query(Client).filter(Client.el_pastas == email).first()


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

# Darbuotojų API priklausomybė patikrina JWT parašą, galiojimą ir staff tipą, randa darbuotoją pagal sub ID ir palygina ver su DB token_version; permissions.py šį darbuotoją naudoja teisių patikroms.
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Employee:
    try:
        # "jwt.decode" - JWT (JSON Web Token, "skaitmeninis bilietas") patikrinimas: ar parašas sutampa su SECRET_KEY (reiškia, serveris PATS jį išdavė), ir ar jis NEpasibaigęs. Jei bet kas netinka - meta JWTError žemiau.
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        # Kliento tokenas niekada neturi būti priimtas kaip darbuotojo - riba yra tokeno "type" laukas.
        if payload.get("type") == "customer":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        darbuotojo_id = int(sub)
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(Employee).filter(Employee.darbuotojo_id == darbuotojo_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # Bilieto ver turi sutapti su darbuotojo token_version bazėje; versijos pakeitimas atšaukia turimas sesijas net ir nepasibaigus jų galiojimo laikui.
    if payload.get("ver") != user.token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return user


# Patvirtina, kad užklausą atlieka PRISIJUNGĘS KLIENTAS (ne darbuotojas) - naudojamas customer.py/customer_auth.py/customer_support.py/customer_loyalty.py endpointuose. Tas pats id+versijos principas kaip get_current_user aukščiau.
def get_current_customer(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Client:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        # Simetriška taisyklė kaip get_current_user aukščiau - darbuotojo tokenas čia negalioja, tikrinama pagal aiškų "type" lauką, ne tik lentelės paiešką.
        if not sub or payload.get("type") != "customer":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        kliento_id = int(sub)
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    customer = db.query(Client).filter(Client.kliento_id == kliento_id).first()
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    if payload.get("ver") != customer.token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return customer
