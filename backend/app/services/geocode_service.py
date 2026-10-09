import httpx

from utils.config import settings

# VIENAS bendras klientas visai appsesijai (ne naujas kiekvienam kvietimui) - httpx.AsyncClient savyje palaiko ryšių "pool"ą, tad pakartotiniai kreipiniai į TĄ PATĮ OpenCage serverį gali pernaudoti jau atidarytą TCP/TLS ryšį, ne derėtis iš naujo kiekvieną kartą.
_client: httpx.AsyncClient | None = None

# Adresas -> koordinatės, PROCESO atmintyje - automobilių "dabartinė vieta" realiai yra TIK keli pristatymo punktai (žr. database/seed.sql), tad be šios talpyklos TAS PATS adresas būtų pakartotinai geokoduojamas per OpenCage KIEKVIENĄ kartą, kai BET KURIS darbuotojas atidaro žemėlapį - talpykla paverčia tai į "vieną kartą per adresą, kol serveris veikia".
_cache: dict[str, tuple[float, float] | None] = {}


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient()
    return _client


# Kreipiasi į OpenCage (išorinis, trečios šalies geokodavimo servisas) - verčia adreso tekstą į lat/lng koordinates; grąžina None, jei adresas nerastas arba servisas pasiekiamas nepavyko.
async def geocode_address(adresas: str) -> tuple[float, float] | None:
    if adresas in _cache:
        return _cache[adresas]

    # ", Lietuva" priklijuojama prie VISŲ adresų - sumažina klaidingų atitikmenų riziką su tuo pačiu gatvės pavadinimu KITOJE šalyje.
    query = f"{adresas}, Lietuva"

    try:
        # Per `params`, ne f-string'u į URL - apsaugo nuo "&"/"#" užklausos injekcijos.
        response = await _get_client().get(
            "https://api.opencagedata.com/geocode/v1/json",
            params={"q": query, "key": settings.OPENCAGE_API_KEY or ""},
        )
        response.raise_for_status()
        data = response.json()
    except Exception:
        # Bet kokia klaida (nėra interneto, servisas negrąžino 200, neteisingas JSON) - traktuojama kaip "nerasta", ne nulūžta su 500; NETALPINAMA į talpyklą, kad laikinas nesklandumas nebūtų "įšaldytas" amžinai.
        return None

    if not data.get("results"):
        _cache[adresas] = None
        return None

    geometry = data["results"][0]["geometry"]
    result = (geometry["lat"], geometry["lng"])
    _cache[adresas] = result
    return result
