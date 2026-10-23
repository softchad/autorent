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


# Darbuotojo išduodamo aptarnavimo kodo vertės riba apsaugo nuo per didelės nuolaidos; automatinio lojalumo atlygio sumą atskirai nustato customer_loyalty.py.
MAX_MANUAL_DISCOUNT_EUR = 200.0

# "priezastis" vėliau sulipdoma į DiscountCode.pastaba (String(255), žr. staff_support.py "f'{priezastis} (pokalbis #{id})'") - riba su atsarga likusiai sufikso daliai.
MAX_PRIEZASTIS_LEN = 220


# Darbuotojo ranka sukuriamo aptarnavimo kodo užklausa - "kliento_id" ČIA NĖRA, nes jis visada išvedamas iš pokalbio (žr. staff_support.py), kad darbuotojas negalėtų netyčia nurodyti SVETIMO kliento ID; "priezastis" PRIVALOMA, kad kodo kilmė liktų aiški, jei klientas vėliau klaustų, už ką jis gautas.
class GenerateDiscountCodeRequest(BaseModel):
    verte_eur: float
    priezastis: str

    # Nuolaida turi būti teigiama ir atitikti leistiną vertę.
    @field_validator("verte_eur")
    @classmethod
    def validate_verte(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Nuolaidos vertė turi būti didesnė už 0")
        if v > MAX_MANUAL_DISCOUNT_EUR:
            raise ValueError(f"Nuolaidos vertė negali viršyti {MAX_MANUAL_DISCOUNT_EUR:.0f} EUR")
        return v

    # Viršutinė riba BŪTINA (žr. MAX_PRIEZASTIS_LEN aukščiau) - be jos per ilgas tekstas MySQL strict mode režime keltų DataError, KURIO "except IntegrityError" (discount_code_service.py) NEPAGAUTŲ - užklausa nulūžtų su neaiškia 500, ne aiškia 422.
    @field_validator("priezastis")
    @classmethod
    def validate_priezastis(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Nurodykite priežastį (bent 3 simboliai)")
        if len(v) > MAX_PRIEZASTIS_LEN:
            raise ValueError(f"Priežastis negali būti ilgesnė nei {MAX_PRIEZASTIS_LEN} simbolių")
        return v
