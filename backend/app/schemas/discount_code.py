# Nuolaidos kodų formos - DiscountCodeOut grąžinamas IR klientui (jo pačio kodų sąrašas), IR darbuotojui (ką tik sugeneruoto kodo patvirtinimas).
from datetime import datetime
from pydantic import BaseModel, field_validator


# VIENAS nuolaidos kodas - "panaudojimo_data" užpildoma TIK kai jis panaudotas (žr. DiscountCode modelį).
class DiscountCodeOut(BaseModel):
    kodo_id: int
    kodas: str
    verte_eur: float
    kilme: str
    pastaba: str | None = None
    sukurimo_data: datetime | None = None
    panaudojimo_data: datetime | None = None


# Darbuotojo ranka sukuriamo aptarnavimo kodo užklausa - "kliento_id" ČIA NĖRA, nes jis visada išvedamas iš pokalbio (žr. staff_support.py), kad darbuotojas negalėtų netyčia nurodyti SVETIMO kliento ID; "priezastis" PRIVALOMA, kad kodo kilmė liktų aiški, jei klientas vėliau klaustų, už ką jis gautas.
class GenerateDiscountCodeRequest(BaseModel):
    verte_eur: float
    priezastis: str

    @field_validator("verte_eur")
    @classmethod
    def validate_verte(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Nuolaidos vertė turi būti didesnė už 0")
        return v

    @field_validator("priezastis")
    @classmethod
    def validate_priezastis(cls, v: str) -> str:
        if len(v.strip()) < 3:
            raise ValueError("Nurodykite priežastį (bent 3 simboliai)")
        return v.strip()
