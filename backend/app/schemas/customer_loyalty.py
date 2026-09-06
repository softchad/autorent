from datetime import datetime
from pydantic import BaseModel


class LoyaltyRewardOut(BaseModel):
    atlygio_id: int
    etapo_numeris: int
    busena: str
    verte_eur: float
    sukurimo_data: datetime | None = None
    panaudojimo_data: datetime | None = None

    class Config:
        from_attributes = True


class LoyaltyStatusOut(BaseModel):
    uzbaigtu_nuomu_skaicius: int
    progresas_dabartiniame_etape: int
    etapo_dydis: int
    atlygio_verte_eur: float
    atlygiai: list[LoyaltyRewardOut]
