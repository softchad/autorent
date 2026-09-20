# Vietos (paėmimo/grąžinimo punkto) atsakymo forma - naudojama IR savarankiškai (getLocations car.py faile), IR kaip CarOut.lokacija lauko tipas.
from pydantic import BaseModel

class LocationOut(BaseModel):
    vietos_id: int
    pavadinimas: str
    adresas: str
    miestas: str

    # from_attributes=True BŪTINAS - skirtingai nuo daugelio kitų *Out schemų šiame projekte, šita GRĄŽINAMA tiesiai iš ORM objekto (db.query(Location).all() car.py faile, arba car.lokacija ryšio objektas), ne iš žodyno.
    class Config:
        from_attributes = True
