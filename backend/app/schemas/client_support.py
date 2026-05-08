from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict

class ClientSupportBase(BaseModel):
    kliento_id: int
    darbuotojo_id: int
    tema: str
    pranesimas: str
    atsakymas: Optional[str] = None
    pateikimo_data: Optional[datetime] = None
    atsakymo_data: Optional[datetime] = None

class ClientSupportCreate(ClientSupportBase):
    pass

class ClientSupportUpdate(BaseModel):
    atsakymas: Optional[str] = None
    atsakymo_data: Optional[datetime] = None
    darbuotojo_id: Optional[int] = None

class ClientSupportOut(ClientSupportBase):
    uzklausos_id: int
    kliento_id: int
    darbuotojo_id: Optional[int] = None
    tema: str
    pranesimas: str
    atsakymas: Optional[str] = None
    pateikimo_data: Optional[datetime] = None
    atsakymo_data: Optional[datetime] = None
    links: List[Dict]

    class Config:
        from_attributes = True
