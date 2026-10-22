# Bendras limiter objektas - importuojamas IR main.py (app.state.limiter), IR endpoint moduliuose (@limiter.limit decoratoriui); laikomas ATSKIRAME faile, kad endpoint'ai neimportuotų main.py tiesiogiai (tai sukeltų ciklinę importaciją - main.py importuoja endpoint'us, endpoint'ai importuotų main.py atgal).
import json
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

# "key_func" - PAGAL KĄ skaičiuojami kreipiniai; get_remote_address naudoja kliento IP adresą, tad limitas taikomas KIEKVIENAM IP atskirai, ne visai sistemai bendrai.
limiter = Limiter(key_func=get_remote_address)


# PAPILDOMAS raktas prisijungimo/registracijos endpoint'ams (žr. @limiter.limit(..., key_func=login_identity_key) naudojimą auth.py/customer_auth.py) - skaičiuoja PAGAL el. paštą UŽKLAUSOS kūne, NE IP adresą. Vien IP limitas (limiter aukščiau) trivialiai apeinamas rotuojant IP (VPN/proxy per kiekvieną bandymą) - ŠIS limitas, taikomas KARTU su IP, blokuoja TĄ PATĮ el. paštą nepriklausomai nuo to, iš kokio IP bandoma. Palaiko IR JSON (login/customer login), IR form-encoded (auth.py "/token" - Swagger "Authorize" naudoja "username" laukelio pavadinimą, ne "el_pastas") kūnus.
def login_identity_key(request: Request) -> str:
    # JSON kūnams Starlette cache'uoja ŽALIUS baitus "request._body" (žr. Request.body()); form-urlencoded/multipart kūnams - NE "_body", o JAU IŠPARSINTĄ "request._form" (FormData, žr. Request._get_form() - ji skaito "self.stream()" TIESIAI, "_body" apskritai neužpildo). Kadangi šis limiter'is apgaubia TĄ PAČIĄ endpoint'o funkciją, kuriai FastAPI reikėjo šio kūno jos parametrams (payload/username), jis JAU būna perskaitytas (ir viena iš šių dviejų reikšmių - užpildyta) PRIEŠ šį kvietimą, tad papildomo "await" čia nereikia (key_func slowapi viduje kviečiamas SINCHRONIŠKAI).
    identity = ""
    # "split(';')[0].strip" - nuplauna charset/boundary parametrus (pvz. "multipart/form-data; boundary=..."), paliekant tik PATĮ media type. "endswith('json')" (NE lygybė su "application/json") - FastAPI PRIIMA IR struktūrinius priesagų variantus (RFC 6839), pvz. "application/vnd.autorent+json"; be šio patikrinimo toks kūnas praeitų PRO "identity" ieškojimą ir limitas tyliai suskristų iki vien IP .
    media_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    try:
        if media_type.endswith("json"):
            raw = getattr(request, "_body", b"") or b""
            body = json.loads(raw)
            identity = str(body.get("el_pastas", "")).strip().lower()
        elif media_type in ("application/x-www-form-urlencoded", "multipart/form-data"):
            # Starlette "_get_form()" (Request._form) NORMALIZUOJA abu šiuos encoding'us į TĄ PATĮ FormData objektą - tad "/token" (Swagger, žr. auth.py) raktą rastų NEPRIKLAUSOMAI nuo to, kurį iš dviejų naudotų klientas.
            form = getattr(request, "_form", None)
            if form is not None:
                identity = str(form.get("username", "")).strip().lower()
    except Exception:
        identity = ""
    # Jei tapatybės rasti nepavyko (negaliojantis kūnas ar pan.) - grįžtame prie IP, kad limitas VIS TIEK veiktų, tik silpniau, ne visai išnyktų.
    return f"login-email:{identity}" if identity else get_remote_address(request)
