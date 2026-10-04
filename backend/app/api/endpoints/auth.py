# Šiame faile - VISI būdai prisijungti: darbuotojo el. paštas+slaptažodis, ir "prisijunk su Google/GitHub paskyra" (darbuotojams - abu, klientams - tik Google).
from fastapi import APIRouter, Depends, HTTPException, Request, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.schemas.auth import LoginRequest, TokenResponse, UserInfo, ChangePasswordRequest
from app.repositories import employee as employee_repo  # paketas funkcijų, kurios ieško/keičia darbuotojus duomenų bazėje
from app.repositories import client as client_repo  # tas pats, bet klientams - reikalinga, nes per Google galima prisijungti ir kaip klientas
from app.services.auth_service import verify_password, create_access_token, get_password_hash  # slaptažodžio tikrinimas ir JWT "bilieto" (įrodymas, kad esi prisijungęs) kūrimas
from app.api.deps import get_current_user, get_db  # "automatiškai paduok man" dabartinį prisijungusį vartotoją ir ryšį su duomenų baze
from app.rate_limit import limiter  # apsauga nuo per dažno spėliojimo iš eilės (@limiter.limit(...) žemiau)
from authlib.integrations.starlette_client import OAuth  # paketas, mokantis "susikalbėti" su Google/GitHub prisijungimo sistema
from utils.config import settings  # reikšmės iš .env failo - slapti raktai ir adresai, kurių nerodome viešai kode

router = APIRouter()

# Kai naudotojas sėkmingai prisijungia per Google/GitHub, naršyklė nukreipiama į FRONTEND_URL; GOOGLE/GITHUB_REDIRECT_URL - "grįžimo" adresai, kuriuos TU pats užregistravai Google/GitHub paskyrų kūrimo puslapyje.
FRONTEND_URL = str(settings.FRONTEND_URL).rstrip("/")
GOOGLE_REDIRECT_URL = str(settings.GOOGLE_REDIRECT_URL)
GITHUB_REDIRECT_URL = settings.GITHUB_REDIRECT_URL or None

# "OAuth" - standartinis būdas prisijungti per kito tinklapio (Google/GitHub) paskyrą, nesukuriant naujo slaptažodžio. Šis objektas žemiau "užregistruoja" abu tiekėjus su jų raktais.
oauth = OAuth()

# Užregistruojame Google - jam tereikia vieno adreso (server_metadata_url), iš kurio paketas pats susiranda visus kitus reikalingus Google adresus.
oauth.register(
    name="google",
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

# GitHub užregistruojamas TIK jei .env faile tikrai įrašyti GitHub raktai - jei ne, GitHub prisijungimas tiesiog neveiks (žr. github_login žemiau).
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
# GitHub prisijungimas yra TIK darbuotojams - klientams rodomas tik "Tęsti su Google" mygtukas (SignInModal.tsx), GitHub pasirinkimo jiems nerodome.
@router.get("/github/login")
async def github_login(request: Request):
    # Jei GitHub raktų .env faile nėra (žr. 33 eilutę aukščiau), paspaudus mygtuką gautume klaidą, ne tylų nulūžimą.
    if not (GITHUB_REDIRECT_URL and settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET):
        raise HTTPException(status_code=503, detail="GitHub OAuth neaktyvus: trūksta konfigūracijos.")
    # Nukreipiame naudotojo naršyklę į GitHub prisijungimo puslapį - toliau viskas vyksta GitHub pusėje, iki jis grąžina į /github/callback žemiau.
    return await oauth.github.authorize_redirect(
        request, GITHUB_REDIRECT_URL,
        allow_signup="true",
    )

# GitHub naudotoją nukreipia ČIA, kai jis ten sėkmingai prisijungia - suradus darbuotoją pagal el. paštą, jam išduodamas JWT.
@router.get("/github/callback", name="github_callback")
async def github_callback(request: Request, db: Session = Depends(get_db)):
    if not (settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET):
        raise HTTPException(status_code=503, detail="GitHub OAuth neaktyvus.")
    # Paprašome GitHub patvirtinimo "rakto" (tokeno), kuriuo tolimesnėse eilutėse galėsime paklausti naudotojo duomenų.
    token = await oauth.github.authorize_access_token(request)
    if not token:
        raise HTTPException(status_code=400, detail="Nepavyko gauti GitHub tokeno.")

    # El. paštas gali būti paslėptas naudotojo GitHub profilyje, tad klausiame atskirai /user/emails ir renkamės pirminį/patvirtintą.
    emails = (await oauth.github.get("user/emails", token=token)).json()
    email = next((e["email"] for e in emails if e.get("primary") and e.get("verified")), None) or (emails[0]["email"] if emails else None)
    if not email:
        raise HTTPException(status_code=400, detail="Nepavyko gauti el. pašto iš GitHub.")

    # Ieškome DARBUOTOJO su šiuo el. paštu mūsų duomenų bazėje - jei jo nėra, paskyra NESUKURIAMA automatiškai (tik administratorius gali sukurti darbuotoją).
    user = employee_repo.get_by_email(db, email)
    if not user:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=not_staff", status_code=303)

    # JWT - tai kaip skaitmeninis bilietas, kurį frontend'as toliau prisega prie KIEKVIENOS savo užklausos, kad serveris žinotų, kas prisijungęs.
    jwt_token = create_access_token(data={"sub": email, "type": "staff", "auth": "github"})
    return RedirectResponse(url=f"{FRONTEND_URL}/oauth#access_token={jwt_token}", status_code=303)

# ---------- Google ----------
# Google prisijungimą naudoja IR darbuotojai, IR klientai - todėl yra DU "login" endpointai (šis - darbuotojams), bet VIENAS bendras /google/callback žemiau.
@router.get("/google/login")
async def google_login(request: Request):
    # "session" - tai serverio trumpalaikė atmintis, susieta su ŠIO naudotojo naršykle. Čia įsimename "staff", kad /google/callback (kai naudotojas grįš iš Google) žinotų, kad tai buvo darbuotojo prisijungimas, ne kliento.
    request.session["oauth_intent"] = "staff"
    return await oauth.google.authorize_redirect(
        request,
        GOOGLE_REDIRECT_URL,
        scope="openid email profile",
        prompt="select_account",  # priverčia Google parodyti paskyrų sąrašą, ne automatiškai prisijungti su paskutine naudota
    )

# Lygiai tas pats kaip darbuotojo prisijungimas aukščiau, bet įsimenama "customer" - tai yra mygtukas, kurį spaudžia KLIENTAS (SignInModal.tsx "Tęsti su Google").
@router.get("/customer/google/login")
async def customer_google_login(request: Request):
    request.session["oauth_intent"] = "customer"
    return await oauth.google.authorize_redirect(
        request,
        GOOGLE_REDIRECT_URL,
        scope="openid email profile",
        prompt="select_account",
    )

# Google naudotoją nukreipia ČIA po prisijungimo - pagal anksčiau įsimintą "staff"/"customer" žymę, prijungiame kaip DARBUOTOJĄ arba KLIENTĄ.
@router.get("/google/callback", name="google_callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    # Išsitraukiame anksčiau įsimintą žymę ir ją IŠTRINAME iš sesijos (daugiau nereikės).
    intent = request.session.pop("oauth_intent", "staff")
    token = await oauth.google.authorize_access_token(request)

    # Google dažniausiai pati atsiunčia naudotojo duomenis kartu su tokenu; jei ne - bandome gauti juos kitais dviem būdais.
    userinfo = token.get("userinfo")
    if not userinfo:
        try:
            userinfo = await oauth.google.parse_id_token(request, token)
        except Exception:
            resp = await oauth.google.get("userinfo", token=token)
            userinfo = resp.json()

    # Be patvirtinto el. pašto tęsti nesaugu - atmetame abu "blogus" atvejus (nėra el. pašto / jis nepatvirtintas).
    if not userinfo or not userinfo.get("email"):
        raise HTTPException(status_code=400, detail="Nepavyko gauti Google el. pašto.")
    if not userinfo.get("email_verified", True):
        raise HTTPException(status_code=400, detail="Google el. paštas nepatvirtintas.")

    email = userinfo["email"]

    # Jei tai buvo KLIENTO prisijungimas (žymė "customer" iš /customer/google/login aukščiau) - eina į šią atskirą šaką.
    if intent == "customer":
        first = userinfo.get("given_name") or "Google"
        last = userinfo.get("family_name") or "Klientas"
        jwt_token = _get_or_create_customer_token(db, email, first, last, auth="google")
        return RedirectResponse(url=f"{FRONTEND_URL}/paskyra/oauth#access_token={jwt_token}", status_code=303)

    # Kitu atveju - tai DARBUOTOJO prisijungimas. Ieškome jo pagal el. paštą; jei tokio darbuotojo nėra, paskyra NESUKURIAMA automatiškai.
    user = employee_repo.get_by_email(db, email)
    if not user:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=not_staff", status_code=303)

    # Rastam darbuotojui išduodamas JWT "bilietas" - lygiai tas pats principas kaip GitHub kelyje aukščiau.
    jwt_token = create_access_token(data={"sub": email, "type": "staff", "auth": "google"})
    return RedirectResponse(url=f"{FRONTEND_URL}/oauth#access_token={jwt_token}", status_code=303)

# Skirtingai nei darbuotojui (kuriam paskyra NIEKADA nekuriama automatiškai), KLIENTUI paskyra sukuriama iš karto, jei jos dar nėra - tai ir yra "lengva užsiregistruoti su Google" patogumas.
def _get_or_create_customer_token(db: Session, email: str, first: str, last: str, auth: str) -> str:
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
# "Normalus" prisijungimas - darbuotojas įveda el. paštą + slaptažodį (klientams toks pat, bet kitame faile - customer_auth.py).
@router.post("/login", response_model=TokenResponse, operation_id="login")
@limiter.limit("5/minute")  # leidžiama bandyti ne dažniau nei 5 kartus per minutę - apsauga nuo slaptažodžio spėliojimo botais
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    db_user = employee_repo.get_by_email(db, payload.el_pastas)
    if not db_user or not verify_password(payload.slaptazodis, db_user.slaptazodis):
        raise HTTPException(status_code=401, detail="Neteisingas el. paštas arba slaptažodis")
    # Viskas gerai - sukuriame JWT "bilietą" ir atiduodame frontend'ui, kuris jį saugos ir naudos ateities užklausoms.
    token = create_access_token(data={"sub": db_user.el_pastas, "type": "staff"})
    return TokenResponse(access_token=token)

# JWT "bilietas" neturi serverio atmintyje jokios žymos "galiojantis" - tad jo "atšaukti" nėra kaip, šis endpointas realiai NIEKO neišvalo serveryje. Tikrą atsijungimą atlieka frontend'as - tiesiog išmesdamas tokeną iš savo atminties.
@router.post("/logout", operation_id="logout")
def logout():
    return {"message": "Successfully logged out"}

# Grąžina duomenis apie DABAR prisijungusį darbuotoją - get_current_user (žr. importus viršuje) jau pati patikrino JWT ir surado darbuotoją, čia jis tiesiog atiduodamas atgal.
@router.get("/me", response_model=UserInfo)
def me(current_user = Depends(get_current_user)):
    return current_user

# Leidžia prisijungusiam darbuotojui pasikeisti savo slaptažodį - reikalaujame žinoti SENĄ slaptažodį, kad kažkas kitas, radęs tavo atvirą sesiją, negalėtų jo pasikeisti už tave.
@router.post("/change-password", operation_id="changePassword")
def change_password(request: ChangePasswordRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    user = employee_repo.get_by_email(db, current_user.el_pastas)
    if not verify_password(request.senas_slaptazodis, user.slaptazodis):
        raise HTTPException(status_code=400, detail="Neteisingas dabartinis slaptažodis")
    user.slaptazodis = get_password_hash(request.naujas_slaptazodis)
    db.commit()
    return {"message": "Password updated successfully"}

# Tas pats patikrinimas kaip /login aukščiau, bet priima duomenis KITU formatu (forma, ne JSON) - to reikalauja automatinė API dokumentacija (/docs), kad jos "Authorize" mygtukas veiktų. Frontend'as šito endpointo nenaudoja.
@router.post("/token", response_model=TokenResponse, operation_id="swaggerLogin")
@limiter.limit("5/minute")
def login_swagger(request: Request, username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = employee_repo.get_by_email(db, username)
    if not user or not verify_password(password, user.slaptazodis):
        raise HTTPException(status_code=401, detail="Neteisingi prisijungimo duomenys")
    token = create_access_token(data={"sub": user.el_pastas, "type": "staff"})
    return TokenResponse(access_token=token)
