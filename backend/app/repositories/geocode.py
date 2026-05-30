import httpx
import os

# Adresas verčiamas į koordinates per OpenCage API
OPENCAGE_API_KEY = os.getenv("OPENCAGE_API_KEY", "")

async def geocode_address(adresas: str) -> tuple[float, float] | None:
    query = f"{adresas}, Lietuva"
    url = f"https://api.opencagedata.com/geocode/v1/json?q={query}&key={OPENCAGE_API_KEY}"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
    except Exception:
        return None

    if not data.get("results"):
        return None

    geometry = data["results"][0]["geometry"]
    return geometry["lat"], geometry["lng"]
