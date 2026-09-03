# Prisijungimo, registracijos ir OAuth (Google/GitHub) endpointai
from fastapi import APIRouter, Depends, HTTPException, Request, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.schemas.auth import LoginRequest, TokenResponse, RegisterRequest, UserInfo, ChangePasswordRequest
from app.repositories import employee as employee_repo
from app.repositories import client as client_repo
from app.services.auth_service import verify_password, create_access_token, get_password_hash
from app.api.deps import get_current_user, get_db
from app.api.permissions import require_perm, Perm
from authlib.integrations.starlette_client import OAuth
from utils.config import settings

router = APIRouter()

FRONTEND_URL = str(settings.FRONTEND_URL).rstrip("/")
GOOGLE_REDIRECT_URL = str(settings.GOOGLE_REDIRECT_URL)
GITHUB_REDIRECT_URL = settings.GITHUB_REDIRECT_URL or None

oauth = OAuth()

oauth.register(
    name="google",
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

# GitHub registruojamas tik jei sukonfigūruotas .env faile
if settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET:
    oauth.register(
        name="github",
        client_id=settings.GITHUB_CLIENT_ID,
        client_secret=settings.GITHUB_CLIENT_SECRET,
        access_token_url="https://github.com/login/oauth/access_token",
        authorize_url="https://github.com/login/oauth/authorize",
        api_base_url="https://api.github.com/",
        client_kwargs={"scope": "read:user user:email"},
    )

# ---------- GitHub ----------
# Vienas /github/callback aptarnauja ir darbuotojų, ir klientų prisijungimą - kuris
# kelias tai yra, saugoma sesijoje (request.session), kurią nustato /github/login
# arba /customer/github/login. Google turi tik vieną registruotą redirect URI Google
# Cloud konsolėje, tad negalime turėti atskirų /customer/google/callback kelių be
# papildomos Google konfigūracijos - sesijos požymis sprendžia tą patį be jos.

@router.get("/github/login")
async def github_login(request: Request):
    if not (GITHUB_REDIRECT_URL and settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET):
        raise HTTPException(status_code=503, detail="GitHub OAuth neaktyvus: trūksta konfigūracijos.")
    request.session["oauth_intent"] = "staff"
    return await oauth.github.authorize_redirect(
        request, GITHUB_REDIRECT_URL,
        allow_signup="true",
    )

@router.get("/customer/github/login")
async def customer_github_login(request: Request):
    if not (GITHUB_REDIRECT_URL and settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET):
        raise HTTPException(status_code=503, detail="GitHub OAuth neaktyvus: trūksta konfigūracijos.")
    request.session["oauth_intent"] = "customer"
    return await oauth.github.authorize_redirect(
        request, GITHUB_REDIRECT_URL,
        allow_signup="true",
    )

@router.get("/github/callback", name="github_callback")
async def github_callback(request: Request, db: Session = Depends(get_db)):
    if not (settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET):
        raise HTTPException(status_code=503, detail="GitHub OAuth neaktyvus.")
    intent = request.session.pop("oauth_intent", "staff")
    token = await oauth.github.authorize_access_token(request)
    if not token:
        raise HTTPException(status_code=400, detail="Nepavyko gauti GitHub tokeno.")

    me = (await oauth.github.get("user", token=token)).json()
    emails = (await oauth.github.get("user/emails", token=token)).json()
    email = next((e["email"] for e in emails if e.get("primary") and e.get("verified")), None) or (emails[0]["email"] if emails else None)
    if not email:
        raise HTTPException(status_code=400, detail="Nepavyko gauti el. pašto iš GitHub.")

    if intent == "customer":
        full = (me.get("name") or me.get("login") or "GitHub Klientas").split(" ", 1)
        first, last = (full[0], (full[1] if len(full) > 1 else ""))
        jwt_token = _get_or_create_customer_token(db, email, first, last, auth="github")
        return RedirectResponse(url=f"{FRONTEND_URL}/paskyra/oauth#access_token={jwt_token}", status_code=303)

    # SVARBU: darbuotojo paskyra per OAuth NEBĖRA kuriama automatiškai. Anksčiau bet
    # kas su GitHub paskyra galėjo prisijungti ir gauti naują "Svečias" darbuotojo
    # įrašą su tikru JWT tokenu - tai darbuotojo identitetas, jį turi sukurti tik
    # administratorius. Nežinomas el. paštas -> aiški klaida, ne nauja paskyra.
    user = employee_repo.get_by_email(db, email)
    if not user:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=not_staff", status_code=303)

    jwt_token = create_access_token(data={"sub": email, "type": "staff", "auth": "github"})
    return RedirectResponse(url=f"{FRONTEND_URL}/oauth#access_token={jwt_token}", status_code=303)

# ---------- Google ----------
@router.get("/google/login")
async def google_login(request: Request):
    request.session["oauth_intent"] = "staff"
    return await oauth.google.authorize_redirect(
        request,
        GOOGLE_REDIRECT_URL,
        scope="openid email profile",
        prompt="select_account",  # verčia rodyti paskyros pasirinkimą
    )

@router.get("/customer/google/login")
async def customer_google_login(request: Request):
    request.session["oauth_intent"] = "customer"
    return await oauth.google.authorize_redirect(
        request,
        GOOGLE_REDIRECT_URL,
        scope="openid email profile",
        prompt="select_account",
    )

@router.get("/google/callback", name="google_callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    intent = request.session.pop("oauth_intent", "staff")
    token = await oauth.google.authorize_access_token(request)

    userinfo = token.get("userinfo")
    if not userinfo:
        try:
            userinfo = await oauth.google.parse_id_token(request, token)
        except Exception:
            resp = await oauth.google.get("userinfo", token=token)
            userinfo = resp.json()

    if not userinfo or not userinfo.get("email"):
        raise HTTPException(status_code=400, detail="Nepavyko gauti Google el. pašto.")
    if not userinfo.get("email_verified", True):
        raise HTTPException(status_code=400, detail="Google el. paštas nepatvirtintas.")

    email = userinfo["email"]

    if intent == "customer":
        first = userinfo.get("given_name") or "Google"
        last = userinfo.get("family_name") or "Klientas"
        jwt_token = _get_or_create_customer_token(db, email, first, last, auth="google")
        return RedirectResponse(url=f"{FRONTEND_URL}/paskyra/oauth#access_token={jwt_token}", status_code=303)

    # SVARBU: ta pati taisyklė kaip GitHub aukščiau - žr. komentarą ten. Darbuotojo
    # paskyrą turi sukurti administratorius, ne bet kas su Google paskyra.
    user = employee_repo.get_by_email(db, email)
    if not user:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=not_staff", status_code=303)

    jwt_token = create_access_token(data={"sub": email, "type": "staff", "auth": "google"})
    return RedirectResponse(url=f"{FRONTEND_URL}/oauth#access_token={jwt_token}", status_code=303)


def _get_or_create_customer_token(db: Session, email: str, first: str, last: str, auth: str) -> str:
    """OAuth klientui: jei paskyros dar nėra - sukuriama iškart (tai ir yra norimas
    'lengva užsiregistruoti su Google' elgesys), priešingai nei darbuotojui aukščiau."""
    customer = client_repo.get_by_email(db, email)
    if not customer:
        from datetime import date as date_cls
        customer = client_repo.create_customer(db, {
            "vardas": first,
            "pavarde": last or "Klientas",
            "el_pastas": email,
            "telefono_nr": "",
            "gimimo_data": date_cls(2000, 1, 1),
            "slaptazodis": None,
        })
    return create_access_token(data={"sub": email, "type": "customer", "auth": auth})

# ---------- Klasikinis prisijungimas ----------
@router.post("/login", response_model=TokenResponse, operation_id="login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    db_user = employee_repo.get_by_email(db, request.el_pastas)
    if not db_user or not verify_password(request.slaptazodis, db_user.slaptazodis):
        raise HTTPException(status_code=401, detail="Invalid login credentials")
    token = create_access_token(data={"sub": db_user.el_pastas, "type": "staff"})
    return TokenResponse(access_token=token)

@router.post("/register", operation_id="register",
             dependencies=[Depends(require_perm(Perm.ADMIN))])
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    if employee_repo.get_by_email(db, request.el_pastas):
        raise HTTPException(status_code=400, detail="Employee with this email already exists")
    data = request.dict()
    data["slaptazodis"] = get_password_hash(data.pop("slaptazodis"))
    new_employee = employee_repo.create_employee(db, data)
    return {"message": "Employee created successfully", "id": new_employee.darbuotojo_id}

@router.post("/logout", operation_id="logout")
def logout():
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=UserInfo)
def me(current_user = Depends(get_current_user)):
    return current_user

@router.post("/change-password", operation_id="changePassword")
def change_password(request: ChangePasswordRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    user = employee_repo.get_by_email(db, current_user.el_pastas)
    if not verify_password(request.senas_slaptazodis, user.slaptazodis):
        raise HTTPException(status_code=400, detail="Wrong current password")
    user.slaptazodis = get_password_hash(request.naujas_slaptazodis)
    db.commit()
    return {"message": "Password updated successfully"}

@router.post("/token", response_model=TokenResponse, operation_id="swaggerLogin")
def login_swagger(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = employee_repo.get_by_email(db, username)
    if not user or not verify_password(password, user.slaptazodis):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(data={"sub": user.el_pastas, "type": "staff"})
    return TokenResponse(access_token=token)
