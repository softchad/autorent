# Adreso -> koordinačių geokodavimo endpoint'o formos - žr. endpoints/geocode.py.
from pydantic import BaseModel, Field

class GeocodeRequest(BaseModel):
    # "Field(..., min_length=1)" - "..." (Ellipsis) Pydantic'e reiškia "PRIVALOMAS, be numatytosios reikšmės"; min_length=1 atmeta tuščią eilutę ("") PRIEŠ pasiekiant tinklo kodą.
    adresas: str = Field(..., min_length=1, max_length=300)

# lat/lng - platuma/ilguma; grąžinama iš Nominatim (žr. services/geocode_service.py).
class GeocodeResponse(BaseModel):
    lat: float
    lng: float
