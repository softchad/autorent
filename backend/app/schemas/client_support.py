from pydantic import BaseModel, field_serializer
from datetime import datetime, timezone
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

    # DB laikai saugomi UTC, bet be laiko juostos žymos — pažymime ją čia,
    # kad frontend'as galėtų teisingai konvertuoti į lokalų laiką
    @field_serializer("pateikimo_data", "atsakymo_data")
    def _as_utc(self, dt: Optional[datetime]) -> Optional[datetime]:
        if dt and dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt
