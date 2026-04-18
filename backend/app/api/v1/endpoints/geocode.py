from fastapi import APIRouter, HTTPException, Depends
from app.schemas.geocode import GeocodeRequest, GeocodeResponse
from app.repositories.geocode import geocode_address
from app.api.deps import get_current_user

router = APIRouter(tags=["Geo Code"], dependencies=[Depends(get_current_user)])

@router.post("/geocode", response_model=GeocodeResponse, operation_id="geoCode")
async def geocode(req: GeocodeRequest):
    coords = await geocode_address(req.adresas)

    if coords is None:
        raise HTTPException(status_code=404, detail="Koordinatės nerastos")

    lat, lng = coords
    return GeocodeResponse(lat=lat, lng=lng)
