from pydantic import BaseModel, Field

class GeocodeRequest(BaseModel):
    adresas: str = Field(..., min_length=1)

class GeocodeResponse(BaseModel):
    lat: float
    lng: float
