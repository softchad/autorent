# Automobilio "formos" - CarCreate/CarUpdate apibrėžia, kokius laukus PRIIMAME, CarOut - kokius GRĄŽINAME.
from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict
from datetime import date

from app.schemas.location import LocationOut

# Turi atitikti database/schema.sql ENUM reikšmes TIKSLIAI - jei DB leidžia naują reikšmę, ją reikia pridėti IR čia.
VALID_PAVARU_DEZE  = {"mechaninė", "automatinė", "pusiau automatinė"}
VALID_KURO_TIPAS   = {"benzinas", "dyzelinas", "elektra", "hibridas", "dujos"}
VALID_STATUSAS     = {"laisvas", "isnuomotas", "servise", "remonte"}


# Bendri laukai IR kūrimui (CarCreate), IR grąžinimui (CarOut) - visi PRIVALOMI, nes tikras automobilio įrašas DB juos visada turi.
class CarBase(BaseModel):
    marke: str
    modelis: str
    metai: int
    numeris: str
    vin_kodas: str
    spalva: str
    kebulo_tipas: str
    pavaru_deze: str
    variklio_turis: float
    galia_kw: int
    kuro_tipas: str
    rida: int
    sedimos_vietos: int
    klimato_kontrole: bool
    navigacija: bool
    kaina_parai: float
    automobilio_statusas: str
    technikines_galiojimas: date
    dabartine_vieta_id: int
    pastabos: Optional[str] = None

    # Netinkami automobilio metai atmetami prieš įrašymą į duomenų bazę.
    @field_validator("metai")
    @classmethod
    def validate_metai(cls, v: int) -> int:
        if not (1900 <= v <= 2030):
            raise ValueError("Metai turi būti tarp 1900 ir 2030")
        return v

    # Neigiama ar nulinė nuomos kaina neturi patekti į kainos skaičiavimą.
    @field_validator("kaina_parai")
    @classmethod
    def validate_kaina(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Kaina parai turi būti teigiamas skaičius")
        return v

    # Neigiama rida negali aprašyti tikro automobilio naudojimo.
    @field_validator("rida")
    @classmethod
    def validate_rida(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Rida negali būti neigiama")
        return v

    # Sėdimų vietų skaičius tikrinamas, kad paieškos filtras remtųsi tinkamais duomenimis.
    @field_validator("sedimos_vietos")
    @classmethod
    def validate_sedimos_vietos(cls, v: int) -> int:
        if not (2 <= v <= 9):
            raise ValueError("Sėdimų vietų skaičius turi būti tarp 2 ir 9")
        return v

    # Automobilio galia turi atitikti leidžiamas skaitines ribas.
    @field_validator("galia_kw")
    @classmethod
    def validate_galia(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Galia (kW) turi būti teigiamas skaičius")
        return v

    # Pavarų dėžės reikšmė turi priklausyti toms pačioms kategorijoms kaip paieškos filtras.
    @field_validator("pavaru_deze")
    @classmethod
    def validate_pavaru_deze(cls, v: str) -> str:
        if v not in VALID_PAVARU_DEZE:
            raise ValueError(f"Negalima pavarų dėžė. Leistinos: {', '.join(VALID_PAVARU_DEZE)}")
        return v

    # Kuro tipas tikrinamas pagal sistemoje naudojamas kategorijas.
    @field_validator("kuro_tipas")
    @classmethod
    def validate_kuro_tipas(cls, v: str) -> str:
        if v not in VALID_KURO_TIPAS:
            raise ValueError(f"Negalimas kuro tipas. Leistini: {', '.join(VALID_KURO_TIPAS)}")
        return v

    # Nežinoma automobilio būsena neturi apeiti prieinamumo taisyklių.
    @field_validator("automobilio_statusas")
    @classmethod
    def validate_statusas(cls, v: str) -> str:
        if v not in VALID_STATUSAS:
            raise ValueError(f"Negalimas statusas. Leistini: {', '.join(VALID_STATUSAS)}")
        return v


class CarCreate(CarBase):
    pass


# CarUpdate laukai pasirenkami daliniam atnaujinimui; CarBase taisyklės taikomos pateiktoms reikšmėms, kad car.py išsaugoti duomenys atitiktų CarOut atsakymo schemą.
class CarUpdate(BaseModel):
    marke: Optional[str] = None
    modelis: Optional[str] = None
    metai: Optional[int] = None
    numeris: Optional[str] = None
    vin_kodas: Optional[str] = None
    spalva: Optional[str] = None
    kebulo_tipas: Optional[str] = None
    pavaru_deze: Optional[str] = None
    variklio_turis: Optional[float] = None
    galia_kw: Optional[int] = None
    kuro_tipas: Optional[str] = None
    rida: Optional[int] = None
    sedimos_vietos: Optional[int] = None
    klimato_kontrole: Optional[bool] = None
    navigacija: Optional[bool] = None
    kaina_parai: Optional[float] = None
    automobilio_statusas: Optional[str] = None
    technikines_galiojimas: Optional[date] = None
    dabartine_vieta_id: Optional[int] = None
    pastabos: Optional[str] = None

    # Netinkami automobilio metai atmetami prieš įrašymą į duomenų bazę.
    @field_validator("metai")
    @classmethod
    def validate_metai(cls, v: int) -> int:
        if v is not None and not (1900 <= v <= 2030):
            raise ValueError("Metai turi būti tarp 1900 ir 2030")
        return v

    # Neigiama ar nulinė nuomos kaina neturi patekti į kainos skaičiavimą.
    @field_validator("kaina_parai")
    @classmethod
    def validate_kaina(cls, v: float) -> float:
        if v is not None and v <= 0:
            raise ValueError("Kaina parai turi būti teigiamas skaičius")
        return v

    # Neigiama rida negali aprašyti tikro automobilio naudojimo.
    @field_validator("rida")
    @classmethod
    def validate_rida(cls, v: int) -> int:
        if v is not None and v < 0:
            raise ValueError("Rida negali būti neigiama")
        return v

    # Sėdimų vietų skaičius tikrinamas, kad paieškos filtras remtųsi tinkamais duomenimis.
    @field_validator("sedimos_vietos")
    @classmethod
    def validate_sedimos_vietos(cls, v: int) -> int:
        if v is not None and not (2 <= v <= 9):
            raise ValueError("Sėdimų vietų skaičius turi būti tarp 2 ir 9")
        return v

    # Automobilio galia turi atitikti leidžiamas skaitines ribas.
    @field_validator("galia_kw")
    @classmethod
    def validate_galia(cls, v: int) -> int:
        if v is not None and v <= 0:
            raise ValueError("Galia (kW) turi būti teigiamas skaičius")
        return v

    # Pavarų dėžės reikšmė turi priklausyti toms pačioms kategorijoms kaip paieškos filtras.
    @field_validator("pavaru_deze")
    @classmethod
    def validate_pavaru_deze(cls, v: str) -> str:
        if v is not None and v not in VALID_PAVARU_DEZE:
            raise ValueError(f"Negalima pavarų dėžė. Leistinos: {', '.join(VALID_PAVARU_DEZE)}")
        return v

    # Kuro tipas tikrinamas pagal sistemoje naudojamas kategorijas.
    @field_validator("kuro_tipas")
    @classmethod
    def validate_kuro_tipas(cls, v: str) -> str:
        if v is not None and v not in VALID_KURO_TIPAS:
            raise ValueError(f"Negalimas kuro tipas. Leistini: {', '.join(VALID_KURO_TIPAS)}")
        return v

    # Nežinoma automobilio būsena neturi apeiti prieinamumo taisyklių.
    @field_validator("automobilio_statusas")
    @classmethod
    def validate_statusas(cls, v: str) -> str:
        if v is not None and v not in VALID_STATUSAS:
            raise ValueError(f"Negalimas statusas. Leistini: {', '.join(VALID_STATUSAS)}")
        return v


class CarOut(CarBase):
    automobilio_id: int
    lokacija: Optional[LocationOut]
    links: List[Dict]

    class Config:
        from_attributes = True


