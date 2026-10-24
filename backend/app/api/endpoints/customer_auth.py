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
from app.rate_limit import limiter, login_identity_key  # apsauga nuo per dažno spėliojimo iš eilės (@limiter.limit(...) žemiau); login_identity_key - PAPILDOMAS el. pašto raktas, kad IP rotavimas nepaneigtų limito
from app.models.client import Client
from app.services.auth_service import verify_password, create_customer_token, get_password_hash  # slaptažodžio tikrinimas/šifravimas, JWT "bilieto" kūrimas
from app.api.deps import get_db, get_current_customer, get_client_by_email  # get_current_customer - "kas prisijungęs" KLIENTAMS, atskiras nuo darbuotojų get_current_user (JWT turi skirtingą "type" reikšmę)

router = APIRouter(prefix="/customer", tags=["Customer Auth"])

# Fiksuotas, PRIEŠ laiką paskaičiuotas bcrypt hash - naudojamas login žemiau, kai klientas neegzistuoja/neturi slaptažodžio (OAuth-only paskyra), kad VIS TIEK įvyktų (lėtas) bcrypt palyginimas - žr. identišką komentarą auth.py (darbuotojų login) dėl laiko matomo šoninio kanalo.
_DUMMY_PASSWORD_HASH = get_password_hash("šis-hash-niekada-nenaudojamas-tikram-prisijungimui")


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

    token = create_customer_token(customer)
    return CustomerTokenResponse(access_token=token)


# Klasikinis kliento prisijungimas - el. paštas + slaptažodis (OAuth variantas - auth.py).
@router.post("/login", response_model=CustomerTokenResponse, operation_id="customerLogin")
@limiter.limit("5/minute")  # PAGAL IP
@limiter.limit("5/minute", key_func=login_identity_key)  # TAS PATS limitas PAGAL el. paštą - žr. rate_limit.py komentarą, kodėl vien IP nepakanka
def login(payload: CustomerLoginRequest, request: Request, db: Session = Depends(get_db)):
    customer = get_client_by_email(db, payload.el_pastas)
    has_password = bool(customer and customer.slaptazodis)
    # "verify_password" kviečiamas VISADA (net kai kliento nėra/jis OAuth-only, su _DUMMY_PASSWORD_HASH) - žr. _DUMMY_PASSWORD_HASH komentarą aukščiau dėl laiko matomo šoninio kanalo.
    password_ok = verify_password(payload.slaptazodis, customer.slaptazodis if has_password else _DUMMY_PASSWORD_HASH)
    # "not has_password" - jei klientas registravosi TIK per Google (slaptažodžio neturi) arba yra anonimizuotas (žr. client.py delete_client - ten slaptazodis nustatomas į None), slaptažodžiu prisijungti negalima.
    if not has_password or not password_ok:
        raise HTTPException(status_code=401, detail="Neteisingas el. paštas arba slaptažodis")

    token = create_customer_token(customer)
    return CustomerTokenResponse(access_token=token)


# Grąžina duomenis apie DABAR prisijungusį klientą - get_current_customer jau patikrino JWT ir jį surado.
@router.get("/me", response_model=CustomerInfo, operation_id="customerMe")
def me(current_customer = Depends(get_current_customer)):
    return current_customer


# Leidžia klientui atnaujinti savo profilį - JWT "bilieto" "sub" reikšmė yra el. paštas, tad jį pakeitus senas tokenas nebeatpažins kliento, reikia naujo (žr. žemiau). Rate limit'as - šis endpoint'as, keičiant el_pastas, tikrina dabartinį slaptažodį (žr. žemiau); be limito, trumpalaikį pavogtą JWT turintis asmuo galėtų NERIBOTAI jį spėlioti.
@router.patch("/profile", response_model=CustomerProfileUpdateOut, operation_id="updateCustomerProfile")
@limiter.limit("5/minute")
def update_profile(
    payload: CustomerProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_customer = Depends(get_current_customer),
):
    updates = payload.dict(exclude_unset=True)
    # "dabartinis_slaptazodis" NĖRA Client modelio stulpelis - ištraukiamas IŠ KARTO, kad žemiau "for field, value in updates.items(): setattr(...)" neužsibaigtų bandant jį priskirti ORM objektui.
    current_password = updates.pop("dabartinis_slaptazodis", None)
    email_changed = "el_pastas" in updates and updates["el_pastas"] != current_customer.el_pastas

    if email_changed:
        # El. pašto nuosavybė NIEKUR nepatikrinama (nėra laiško patvirtinimo infrastruktūros) - bent PAREIKALAUJAME dabartinio slaptažodžio, kad pavogtas/paliktas atviras JWT negalėtų vienas pats "persiregistruoti" paskyros ant kito el. pašto.
        if not current_customer.slaptazodis:
            raise HTTPException(status_code=400, detail="Google paskyros el. pašto pakeisti negalima - jis visada sutampa su Google paskyra.")
        if not current_password or not verify_password(current_password, current_customer.slaptazodis):
            raise HTTPException(status_code=400, detail="Norint pakeisti el. paštą, būtina teisingai nurodyti dabartinį slaptažodį.")

    if email_changed and get_client_by_email(db, updates["el_pastas"]):
        raise HTTPException(status_code=409, detail="Šis el. paštas jau naudojamas kitos paskyros")

    for field, value in updates.items():
        setattr(current_customer, field, value)
    if email_changed:
        # Pakeitus prisijungimo el. paštą padidinama paskyros token_version; deps.py atmeta kitas sesijas su ankstesne versija, nors jų parašas ir galiojimo laikas dar tinkami.
        current_customer.token_version += 1

    try:
        db.commit()
    except IntegrityError:
        # Reta lenktynių spraga - lygiai ta pati logika kaip register aukščiau.
        db.rollback()
        raise HTTPException(status_code=409, detail="Šis el. paštas jau naudojamas kitos paskyros")
    db.refresh(current_customer)

    # Naujas tokenas išduodamas TIK jei el. paštas pasikeitė - kitais atvejais senas tebegalioja, frontend'as jo neliečia. Naujas tokenas automatiškai įsideda NAUJĄ (padidintą) token_version, tad ŠITA sesija lieka galiojanti.
    new_token = None
    if email_changed:
        new_token = create_customer_token(current_customer)

    # CustomerInfo - DB objekto pavertimas žodynu; CustomerProfileUpdateOut - tas pats žodynas PLIUS access_token laukas.
    return CustomerProfileUpdateOut(**CustomerInfo.model_validate(current_customer).model_dump(), access_token=new_token)
