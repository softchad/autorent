# Adreso (teksto) pavertimas žemėlapio koordinatėmis (lat/lng) - naudojama darbuotojų žemėlapio komponente, piešiant automobilių/vietų žymeklius pagal adresą iš DB.
from fastapi import APIRouter, HTTPException, Depends, Request
from app.rate_limit import limiter
from app.schemas.geocode import GeocodeRequest, GeocodeResponse
from app.services.geocode_service import geocode_address  # kreipiasi į IŠORINĮ Nominatim geokodavimo servisą internetu - žr. services/geocode_service.py
from app.api.deps import get_current_user

# Tik prisijungusiems darbuotojams - Nominatim servisas riboja užklausų dažnį, tad viešai neatveriame, kad svetimi nenaudotų jos be apribojimų.
router = APIRouter(tags=["Geo Code"], dependencies=[Depends(get_current_user)])
public_router = APIRouter(tags=["Public"])

# Grąžina VIENO adreso koordinates - žemėlapio komponentas kviečia šį endpoint'ą atskirai KIEKVIENAM rodomam adresui.
@router.post("/geocode", response_model=GeocodeResponse, operation_id="geoCode")
async def geocode(req: GeocodeRequest):
    coords = await geocode_address(req.adresas)

    if coords is None:
        raise HTTPException(status_code=404, detail="Koordinatės nerastos")

    lat, lng = coords
    return GeocodeResponse(lat=lat, lng=lng)


# Vieša adreso paieška dalijasi darbuotojų talpykla ir Nominatim užklausų eile.
@public_router.post("/public/geocode", response_model=GeocodeResponse)
@limiter.limit("10/minute")
async def public_geocode(request: Request, req: GeocodeRequest):
    return await geocode(req)
