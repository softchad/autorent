# Kliento (ne darbuotojo) registracija ir prisijungimas slaptažodžiu - Google OAuth klientams yra atskirai, auth.py faile (GitHub ten tik darbuotojams, klientams jo nėra).
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError  # klaida, kurią duomenų bazė meta, kai veiksmas atmetamas dėl susijusių įrašų (pvz. el. paštas jau užimtas)
from sqlalchemy.orm import Session

from app.schemas.customer_auth import (
    CustomerRegisterRequest,
    CustomerLoginRequest,
    CustomerTokenResponse,
    CustomerInfo,
    CustomerProfileUpdate,
    CustomerProfileUpdateOut,
)
from app.rate_limit import limiter  # apsauga nuo per dažno spėliojimo iš eilės (@limiter.limit(...) žemiau)
from app.models.client import Client
from app.services.auth_service import verify_password, create_access_token, get_password_hash  # slaptažodžio tikrinimas/šifravimas, JWT "bilieto" kūrimas
from app.api.deps import get_db, get_current_customer, get_client_by_email  # get_current_customer - "kas prisijungęs" KLIENTAMS, atskiras nuo darbuotojų get_current_user (JWT turi skirtingą "type" reikšmę)

router = APIRouter(prefix="/customer", tags=["Customer Auth"])


# Naujo kliento registracija - iškart grąžina JWT, kad po registracijos nereikėtų atskirai jungtis.
@router.post("/register", response_model=CustomerTokenResponse, operation_id="customerRegister")
@limiter.limit("10/minute")
def register(payload: CustomerRegisterRequest, request: Request, db: Session = Depends(get_db)):
    if get_client_by_email(db, payload.el_pastas):
        raise HTTPException(status_code=409, detail="Klientas su šiuo el. paštu jau užregistruotas")

    data = payload.dict()
    data["slaptazodis"] = get_password_hash(data.pop("slaptazodis"))
    try:
        customer = Client(**data)
        db.add(customer)
        db.commit()
        db.refresh(customer)
    except IntegrityError:
        # Reta lenktynių spraga - du vienalaikiai prašymai su tuo pačiu el. paštu abu praėjo patikrą aukščiau; šitas IntegrityError pagauna antrąjį.
        db.rollback()
        raise HTTPException(status_code=409, detail="Klientas su šiuo el. paštu jau užregistruotas")

    token = create_access_token(data={"sub": customer.el_pastas, "type": "customer"})
    return CustomerTokenResponse(access_token=token)


# Klasikinis kliento prisijungimas - el. paštas + slaptažodis (OAuth variantas - auth.py).
@router.post("/login", response_model=CustomerTokenResponse, operation_id="customerLogin")
@limiter.limit("5/minute")
def login(payload: CustomerLoginRequest, request: Request, db: Session = Depends(get_db)):
    customer = get_client_by_email(db, payload.el_pastas)
    # "not customer.slaptazodis" - jei klientas registravosi TIK per Google (slaptažodžio neturi) arba yra anonimizuotas (žr. client.py delete_client - ten slaptazodis nustatomas į None), slaptažodžiu prisijungti negalima.
    if not customer or not customer.slaptazodis or not verify_password(payload.slaptazodis, customer.slaptazodis):
        raise HTTPException(status_code=401, detail="Neteisingas el. paštas arba slaptažodis")

    token = create_access_token(data={"sub": customer.el_pastas, "type": "customer"})
    return CustomerTokenResponse(access_token=token)


# Grąžina duomenis apie DABAR prisijungusį klientą - get_current_customer jau patikrino JWT ir jį surado.
@router.get("/me", response_model=CustomerInfo, operation_id="customerMe")
def me(current_customer = Depends(get_current_customer)):
    return current_customer


# Leidžia klientui atnaujinti savo profilį - JWT "bilieto" "sub" reikšmė yra el. paštas, tad jį pakeitus senas tokenas nebeatpažins kliento, reikia naujo (žr. žemiau).
@router.patch("/profile", response_model=CustomerProfileUpdateOut, operation_id="updateCustomerProfile")
def update_profile(
    payload: CustomerProfileUpdate,
    db: Session = Depends(get_db),
    current_customer = Depends(get_current_customer),
):
    updates = payload.dict(exclude_unset=True)
    email_changed = "el_pastas" in updates and updates["el_pastas"] != current_customer.el_pastas

    if email_changed and get_client_by_email(db, updates["el_pastas"]):
        raise HTTPException(status_code=409, detail="Šis el. paštas jau naudojamas kitos paskyros")

    for field, value in updates.items():
        setattr(current_customer, field, value)

    try:
        db.commit()
    except IntegrityError:
        # Reta lenktynių spraga - lygiai ta pati logika kaip register aukščiau.
        db.rollback()
        raise HTTPException(status_code=409, detail="Šis el. paštas jau naudojamas kitos paskyros")
    db.refresh(current_customer)

    # Naujas tokenas išduodamas TIK jei el. paštas pasikeitė - kitais atvejais senas tebegalioja, frontend'as jo neliečia.
    new_token = None
    if email_changed:
        new_token = create_access_token(data={"sub": current_customer.el_pastas, "type": "customer"})

    # CustomerInfo - DB objekto pavertimas žodynu; CustomerProfileUpdateOut - tas pats žodynas PLIUS access_token laukas.
    return CustomerProfileUpdateOut(**CustomerInfo.model_validate(current_customer).model_dump(), access_token=new_token)
