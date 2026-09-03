# Kliento (ne darbuotojo) registracija ir prisijungimas slaptažodžiu. Google/GitHub
# OAuth klientams yra auth.py faile (dalinasi ten jau sukonfigūruotu OAuth klientu).
# Tai visiškai atskiras identitetas nuo darbuotojų - žr. app/api/deps.py
# get_current_customer ir jo komentarus dėl tokeno tipo atskyrimo.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.schemas.customer_auth import (
    CustomerRegisterRequest,
    CustomerLoginRequest,
    CustomerTokenResponse,
    CustomerInfo,
)
from app.repositories import client as client_repo
from app.services.auth_service import verify_password, create_access_token, get_password_hash
from app.api.deps import get_db, get_current_customer

router = APIRouter(prefix="/customer", tags=["Customer Auth"])


@router.post("/register", response_model=CustomerTokenResponse, operation_id="customerRegister")
def register(request: CustomerRegisterRequest, db: Session = Depends(get_db)):
    if client_repo.get_by_email(db, request.el_pastas):
        raise HTTPException(status_code=400, detail="Klientas su šiuo el. paštu jau užregistruotas")

    data = request.dict()
    data["slaptazodis"] = get_password_hash(data.pop("slaptazodis"))
    customer = client_repo.create_customer(db, data)

    token = create_access_token(data={"sub": customer.el_pastas, "type": "customer"})
    return CustomerTokenResponse(access_token=token)


@router.post("/login", response_model=CustomerTokenResponse, operation_id="customerLogin")
def login(request: CustomerLoginRequest, db: Session = Depends(get_db)):
    customer = client_repo.get_by_email(db, request.el_pastas)
    if not customer or not customer.slaptazodis or not verify_password(request.slaptazodis, customer.slaptazodis):
        raise HTTPException(status_code=401, detail="Neteisingas el. paštas arba slaptažodis")

    token = create_access_token(data={"sub": customer.el_pastas, "type": "customer"})
    return CustomerTokenResponse(access_token=token)


@router.get("/me", response_model=CustomerInfo, operation_id="customerMe")
def me(current_customer = Depends(get_current_customer)):
    return current_customer
