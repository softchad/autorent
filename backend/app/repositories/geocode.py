import httpx

from utils.config import settings

# Kreipiasi į OpenCage (išorinis, trečios šalies geokodavimo servisas) - verčia adreso tekstą į lat/lng koordinates; grąžina None, jei adresas nerastas arba servisas pasiekiamas nepavyko.
async def geocode_address(adresas: str) -> tuple[float, float] | None:
    # ", Lietuva" priklijuojama prie VISŲ adresų - sumažina klaidingų atitikmenų riziką su tuo pačiu gatvės pavadinimu KITOJE šalyje.
    query = f"{adresas}, Lietuva"

    try:
        async with httpx.AsyncClient() as client:
            # Per `params`, ne f-string'u į URL - apsaugo nuo "&"/"#" užklausos injekcijos.
            response = await client.get(
                "https://api.opencagedata.com/geocode/v1/json",
                params={"q": query, "key": settings.OPENCAGE_API_KEY or ""},
            )
            response.raise_for_status()
            data = response.json()
    except Exception:
        # Bet kokia klaida (nėra interneto, servisas negrąžino 200, neteisingas JSON) - traktuojama kaip "nerasta", ne nulūžta su 500.
        return None

    if not data.get("results"):
        return None

    geometry = data["results"][0]["geometry"]
    return geometry["lat"], geometry["lng"]
