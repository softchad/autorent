# Šiame faile - VISI būdai prisijungti: darbuotojo el. paštas+slaptažodis, ir "prisijunk su Google/GitHub paskyra" (darbuotojams - abu, klientams - tik Google).
from fastapi import APIRouter, Depends, HTTPException, Request, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.schemas.auth import LoginRequest, TokenResponse, UserInfo, ChangePasswordRequest
from app.models.client import Client
from app.services.auth_service import verify_password, create_staff_token, create_customer_token, get_password_hash  # slaptažodžio tikrinimas ir JWT "bilieto" (įrodymas, kad esi prisijungęs) kūrimas
from app.api.deps import get_current_user, get_db, get_employee_by_email, get_client_by_email  # "automatiškai paduok man" dabartinį prisijungusį vartotoją ir ryšį su duomenų baze
from app.rate_limit import limiter, login_identity_key  # apsauga nuo per dažno spėliojimo iš eilės (@limiter.limit(...) žemiau); login_identity_key - PAPILDOMAS el. pašto raktas, kad IP rotavimas nepaneigtų limito
from authlib.integrations.starlette_client import OAuth  # paketas, mokantis "susikalbėti" su Google/GitHub prisijungimo sistema
from utils.config import settings  # reikšmės iš .env failo - slapti raktai ir adresai, kurių nerodome viešai kode

router = APIRouter()

# Fiksuotas, PRIEŠ laiką paskaičiuotas bcrypt hash - naudojamas ŽEMIAU (login/login_swagger), kai el. paštas DB iš viso nerastas, kad VIS TIEK įvyktų (lėtas) bcrypt palyginimas su JUO. Be šito "tokio naudotojo nėra" atsakymas grįžtų IŠKART (praleidus verify_password), o "slaptažodis neteisingas" - tik PO bcrypt skaičiavimo; ta laiko skirtumas (matomas net per tinklą) leistų atspėti, kurie el. paštai realiai užregistruoti, nors HTTP atsakymas abiem atvejais identiškas.
_DUMMY_PASSWORD_HASH = get_password_hash("šis-hash-niekada-nenaudojamas-tikram-prisijungimui")

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
@router.get("/github/login", operation_id="githubLogin")
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
@router.get("/github/callback", name="github_callback", operation_id="githubCallback")
async def github_callback(request: Request, db: Session = Depends(get_db)):
    if not (settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET):
        raise HTTPException(status_code=503, detail="GitHub OAuth neaktyvus.")
    # Paprašome GitHub patvirtinimo "rakto" (tokeno), kuriuo tolimesnėse eilutėse galėsime paklausti naudotojo duomenų.
    token = await oauth.github.authorize_access_token(request)
    if not token:
        raise HTTPException(status_code=400, detail="Nepavyko gauti GitHub tokeno.")

    # El. paštas gali būti paslėptas naudotojo GitHub profilyje, tad klausiame atskirai /user/emails ir renkamės pirminį/patvirtintą. ATSARGINIS variantas turi BŪTI "verified": true (GitHub leidžia pridėti SVETIMĄ, dar nepatvirtintą el. paštą prie savo paskyros) - be šito patikrinimo kažkas galėtų prisijungti kaip DARBUOTOJAS su el. paštu, kurio realiai NEVALDO, vien pridėjęs jį kaip nepatvirtintą antrinį prie SAVO GitHub paskyros.
    emails = (await oauth.github.get("user/emails", token=token)).json()
    email = (
        next((e["email"] for e in emails if e.get("primary") and e.get("verified")), None)
        or next((e["email"] for e in emails if e.get("verified")), None)
    )
    if not email:
        raise HTTPException(status_code=400, detail="Nepavyko gauti patvirtinto el. pašto iš GitHub.")

    # Ieškome DARBUOTOJO su šiuo el. paštu mūsų duomenų bazėje - jei jo nėra, paskyra NESUKURIAMA automatiškai (tik administratorius gali sukurti darbuotoją).
    user = get_employee_by_email(db, email)
    if not user:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=not_staff", status_code=303)

    # JWT - tai kaip skaitmeninis bilietas, kurį frontend'as toliau prisega prie KIEKVIENOS savo užklausos, kad serveris žinotų, kas prisijungęs.
    jwt_token = create_staff_token(user, auth="github")
    return RedirectResponse(url=f"{FRONTEND_URL}/oauth#access_token={jwt_token}", status_code=303)

# ---------- Google ----------
# Google prisijungimą naudoja IR darbuotojai, IR klientai - todėl yra DU "login" endpointai (šis - darbuotojams), bet VIENAS bendras /google/callback žemiau.
@router.get("/google/login", operation_id="googleLogin")
async def google_login(request: Request):
    # OAuth paskirtis įrašoma į pasirašytą naršyklės sesijos slapuką; /google/callback pagal ją atskiria darbuotojo prisijungimą nuo kliento prisijungimo.
    request.session["oauth_intent"] = "staff"
    return await oauth.google.authorize_redirect(
        request,
        GOOGLE_REDIRECT_URL,
        scope="openid email profile",
        prompt="select_account",  # priverčia Google parodyti paskyrų sąrašą, ne automatiškai prisijungti su paskutine naudota
    )

# Lygiai tas pats kaip darbuotojo prisijungimas aukščiau, bet įsimenama "customer" - tai yra mygtukas, kurį spaudžia KLIENTAS (SignInModal.tsx "Tęsti su Google").
@router.get("/customer/google/login", operation_id="customerGoogleLogin")
async def customer_google_login(request: Request):
    request.session["oauth_intent"] = "customer"
    return await oauth.google.authorize_redirect(
        request,
        GOOGLE_REDIRECT_URL,
        scope="openid email profile",
        prompt="select_account",
    )

# Google grąžintą OAuth atsakymą priima bendras callback; sesijoje įrašytas staff arba customer ketinimas parenka darbuotojo arba kliento paskyros kelią.
@router.get("/google/callback", name="google_callback", operation_id="googleCallback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    # Prisijungimo ketinimas perskaitomas ir pašalinamas iš sesijos, kad būtų panaudotas tik šiam OAuth grįžimui.
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
    # "False" (NE "True") kaip trūkstamos reikšmės atsarginis variantas - jei šis saugumui svarbus laukas kada nors ATEITŲ VISIŠKAI nebūtų atsakyme (skirtingas Google API atsakymo formatas ar pan.), privalu ATMESTI, ne tyliai PRIIMTI, laikant jį "patvirtintu" vien dėl to, kad signalo nebuvo.
    if not userinfo.get("email_verified", False):
        raise HTTPException(status_code=400, detail="Google el. paštas nepatvirtintas.")

    email = userinfo["email"]

    # Jei tai buvo KLIENTO prisijungimas (žymė "customer" iš /customer/google/login aukščiau) - eina į šią atskirą šaką.
    if intent == "customer":
        first = userinfo.get("given_name") or "Google"
        last = userinfo.get("family_name") or "Klientas"
        jwt_token = _get_or_create_customer_token(db, email, first, last, auth="google")
        return RedirectResponse(url=f"{FRONTEND_URL}/paskyra/oauth#access_token={jwt_token}", status_code=303)

    # Kitu atveju - tai DARBUOTOJO prisijungimas. Ieškome jo pagal el. paštą; jei tokio darbuotojo nėra, paskyra NESUKURIAMA automatiškai.
    user = get_employee_by_email(db, email)
    if not user:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=not_staff", status_code=303)

    # Rastam darbuotojui išduodamas JWT "bilietas" - lygiai tas pats principas kaip GitHub kelyje aukščiau.
    jwt_token = create_staff_token(user, auth="google")
    return RedirectResponse(url=f"{FRONTEND_URL}/oauth#access_token={jwt_token}", status_code=303)

# Skirtingai nei darbuotojui (kuriam paskyra NIEKADA nekuriama automatiškai), KLIENTUI paskyra sukuriama iš karto, jei jos dar nėra - tai ir yra "lengva užsiregistruoti su Google" patogumas.
def _get_or_create_customer_token(db: Session, email: str, first: str, last: str, auth: str) -> str:
    customer = get_client_by_email(db, email)
    if not customer:
        from datetime import date as date_cls
        customer = Client(
            vardas=first,
            pavarde=last or "Klientas",
            el_pastas=email,
            telefono_nr="",
            gimimo_data=date_cls(2000, 1, 1),
            slaptazodis=None,
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
    elif customer.slaptazodis is not None:
        # Google patvirtinus el. pašto nuosavybę, esama slaptažodinė kliento paskyra susiejama su OAuth: slaptažodis panaikinamas, o token_version padidinama, kad deps.py atmestų jos turimus senus bilietus.
        customer.slaptazodis = None
        customer.token_version += 1
        db.commit()
        db.refresh(customer)
    return create_customer_token(customer, auth=auth)

# ---------- Klasikinis prisijungimas ----------
# "Normalus" prisijungimas - darbuotojas įveda el. paštą + slaptažodį (klientams toks pat, bet kitame faile - customer_auth.py).
@router.post("/login", response_model=TokenResponse, operation_id="login")
@limiter.limit("5/minute")  # leidžiama bandyti ne dažniau nei 5 kartus per minutę PAGAL IP - apsauga nuo slaptažodžio spėliojimo botais
@limiter.limit("5/minute", key_func=login_identity_key)  # TAS PATS limitas, bet PAGAL el. paštą (žr. rate_limit.py) - be šito IP rotavimas (VPN/proxy) visiškai paneigtų limitą aukščiau
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    db_user = get_employee_by_email(db, payload.el_pastas)
    # "has_password" - TIKRINA ABU atvejus (naudotojo iš viso nėra, ARBA jis yra, bet jungiasi TIK per Google/GitHub ir slaptazodis=NULL); be šios patikros antrasis atvejis bandytų "verify_password(x, None)" ir mestų neaiškų AttributeError (500), ne aiškų 401.
    has_password = bool(db_user and db_user.slaptazodis)
    # "verify_password" kviečiamas VISADA (net kai has_password=False, su _DUMMY_PASSWORD_HASH) - žr. _DUMMY_PASSWORD_HASH komentarą aukščiau dėl laiko matomo šoninio kanalo.
    password_ok = verify_password(payload.slaptazodis, db_user.slaptazodis if has_password else _DUMMY_PASSWORD_HASH)
    if not has_password or not password_ok:
        raise HTTPException(status_code=401, detail="Neteisingas el. paštas arba slaptažodis")
    # Viskas gerai - sukuriame JWT "bilietą" ir atiduodame frontend'ui, kuris jį saugos ir naudos ateities užklausoms.
    token = create_staff_token(db_user)
    return TokenResponse(access_token=token)

# JWT "bilietas" neturi serverio atmintyje jokios žymos "galiojantis" - tad jo "atšaukti" nėra kaip, šis endpointas realiai NIEKO neišvalo serveryje. Tikrą atsijungimą atlieka frontend'as - tiesiog išmesdamas tokeną iš savo atminties.
@router.post("/logout", operation_id="logout")
def logout():
    return {"message": "Successfully logged out"}

# Grąžina duomenis apie DABAR prisijungusį darbuotoją - get_current_user (žr. importus viršuje) jau pati patikrino JWT ir surado darbuotoją, čia jis tiesiog atiduodamas atgal.
@router.get("/me", response_model=UserInfo, operation_id="getCurrentUser")
def me(current_user = Depends(get_current_user)):
    return current_user

# Leidžia prisijungusiam darbuotojui pasikeisti savo slaptažodį - reikalaujame žinoti SENĄ slaptažodį, kad kažkas kitas, radęs tavo atvirą sesiją, negalėtų jo pasikeisti už tave. Rate limit'as - be jo, trumpalaikį (pvz. XSS pavogtą) JWT turintis asmuo galėtų NERIBOTAI spėlioti TIKRĄ slaptažodį čia pat ir, atspėjęs, įsitvirtinti paskyroje IR PO TO, kai pavogtas tokenas baigs galioti.
@router.post("/change-password", operation_id="changePassword")
@limiter.limit("5/minute")
def change_password(payload: ChangePasswordRequest, request: Request, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    user = get_employee_by_email(db, current_user.el_pastas)
    # "slaptazodis" GALI būti NULL - darbuotojas, kuris JUNGIASI TIK per Google/GitHub OAuth (žr. google_callback/github_callback aukščiau), savo slaptažodžio neturi; "verify_password(x, None)" kitaip mestų neaiškų AttributeError (500), ne aiškų 400.
    if not user.slaptazodis:
        raise HTTPException(status_code=400, detail="Jūsų paskyra neturi slaptažodžio (prisijungiate per Google/GitHub) - slaptažodžio keitimas negalimas.")
    if not verify_password(payload.senas_slaptazodis, user.slaptazodis):
        raise HTTPException(status_code=400, detail="Neteisingas dabartinis slaptažodis")
    user.slaptazodis = get_password_hash(payload.naujas_slaptazodis)
    db.commit()
    return {"message": "Password updated successfully"}

# Tas pats patikrinimas kaip /login aukščiau, bet priima duomenis KITU formatu (forma, ne JSON) - to reikalauja automatinė API dokumentacija (/docs), kad jos "Authorize" mygtukas veiktų. Frontend'as šito endpointo nenaudoja.
@router.post("/token", response_model=TokenResponse, operation_id="swaggerLogin")
@limiter.limit("5/minute")  # PAGAL IP
@limiter.limit("5/minute", key_func=login_identity_key)  # TAS PATS limitas PAGAL "username" - be šito /login'o brute-force apsauga būtų trivialiai apeinama tiesiog taikant į ŠĮ, ne /login, endpoint'ą
def login_swagger(request: Request, username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = get_employee_by_email(db, username)
    # "has_password" - ta pati OAuth-only patikra kaip "login" aukščiau.
    has_password = bool(user and user.slaptazodis)
    password_ok = verify_password(password, user.slaptazodis if has_password else _DUMMY_PASSWORD_HASH)
    if not has_password or not password_ok:
        raise HTTPException(status_code=401, detail="Neteisingi prisijungimo duomenys")
    token = create_staff_token(user)
    return TokenResponse(access_token=token)
