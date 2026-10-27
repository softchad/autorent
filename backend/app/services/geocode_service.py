import asyncio
import math
import time

import httpx
from utils.config import settings

# Abu portalai naudoja bendrą talpyklą ir eilę: viešasis Nominatim leidžia vieną užklausą per sekundę.
_client: httpx.AsyncClient | None = None
_cache: dict[str, tuple[float, float] | None] = {}
_lock = asyncio.Lock()
_last_request = 0.0


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=10, headers={"User-Agent": "AutoRent/1.0 (address lookup)"})
    return _client


# Nominatim grąžina koordinates tekstu; API jas perduoda žemėlapiams kaip skaičius.
async def geocode_address(adresas: str) -> tuple[float, float] | None:
    global _last_request
    adresas = adresas.strip()
    if not adresas:
        return None
    async with _lock:
        if adresas in _cache:
            return _cache[adresas]
        await asyncio.sleep(max(0, 1.1 - (time.monotonic() - _last_request)))
        _last_request = time.monotonic()
        try:
            response = await _get_client().get(
                str(settings.NOMINATIM_URL),
                params={"q": adresas, "format": "json", "limit": 1, "countrycodes": "lt"},
            )
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, list):
                return None
            if not data:
                _cache[adresas] = None
                return None
            result = (float(data[0]["lat"]), float(data[0]["lon"]))
            if not all(math.isfinite(n) for n in result) or not (-90 <= result[0] <= 90 and -180 <= result[1] <= 180):
                return None
        except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError):
            # Laikina klaida nesaugoma talpykloje, kad paiešką būtų galima pakartoti.
            return None
        _cache[adresas] = result
        return result
