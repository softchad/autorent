from pydantic import BaseModel

class LocationOut(BaseModel):
    vietos_id: int
    pavadinimas: str
    adresas: str
    miestas: str

    class Config:
        from_attributes = True
