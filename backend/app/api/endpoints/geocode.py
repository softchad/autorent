# Adreso (teksto) pavertimas žemėlapio koordinatėmis (lat/lng) - naudojama darbuotojų žemėlapio komponente, piešiant automobilių/vietų žymeklius pagal adresą iš DB.
from fastapi import APIRouter, HTTPException, Depends
from app.schemas.geocode import GeocodeRequest, GeocodeResponse
from app.services.geocode_service import geocode_address  # kreipiasi į IŠORINĮ OpenCage geokodavimo servisą internetu - žr. services/geocode_service.py
from app.api.deps import get_current_user

# Tik prisijungusiems darbuotojams - OpenCage servisas turi mokamą/ribotą užklausų kvotą, tad viešai neatveriame, kad svetimi nenaudotų jos be apribojimų.
router = APIRouter(tags=["Geo Code"], dependencies=[Depends(get_current_user)])

# Grąžina VIENO adreso koordinates - žemėlapio komponentas kviečia šį endpoint'ą atskirai KIEKVIENAM rodomam adresui.
@router.post("/geocode", response_model=GeocodeResponse, operation_id="geoCode")
async def geocode(req: GeocodeRequest):
    coords = await geocode_address(req.adresas)

    if coords is None:
        raise HTTPException(status_code=404, detail="Koordinatės nerastos")

    lat, lng = coords
    return GeocodeResponse(lat=lat, lng=lng)
