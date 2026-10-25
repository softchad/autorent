# Užsakymų "formos" - OrderCreate/OrderUpdate apibrėžia, kokius laukus PRIIMAME, OrderOut - kokius GRĄŽINAME.
from pydantic import BaseModel, field_validator, model_validator
from datetime import date
from typing import List, Dict, Optional

# Turi atitikti database/schema.sql ENUM reikšmes TIKSLIAI.
VALID_BUSENA = {"laukiama", "patvirtinta", "vykdoma", "užbaigta", "atšaukta"}


class OrderBase(BaseModel):
    kliento_id: int
    automobilio_id: int
    darbuotojo_id: int
    nuomos_data: date
    grazinimo_data: date
    paemimo_vietos_id: int
    grazinimo_vietos_id: int
    bendra_kaina: float
    uzsakymo_busena: str
    turi_papildomas_paslaugas: bool

    # Leidžiamos tik tos būsenos, pagal kurias sistema sprendžia apie aktyvią nuomą ar rezervaciją.
    @field_validator("uzsakymo_busena")
    @classmethod
    def validate_busena(cls, v: str) -> str:
        if v not in VALID_BUSENA:
            raise ValueError(f"Negalima būsena. Leistinos: {', '.join(VALID_BUSENA)}")
        return v

    # Neigiama ar nulinė nuomos kaina neturi patekti į kainos skaičiavimą.
    @field_validator("bendra_kaina")
    @classmethod
    def validate_kaina(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Bendra kaina negali būti neigiama")
        return v

    # "model_validator" (ne field_validator) - nes čia reikia PALYGINTI DU laukus tarpusavyje (grazinimo_data su nuomos_data), ne patikrinti vieną atskirai.
    @model_validator(mode="after")
    def validate_dates(self) -> "OrderBase":
        if self.grazinimo_data and self.nuomos_data:
            if self.grazinimo_data < self.nuomos_data:
                raise ValueError("Grąžinimo data negali būti ankstesnė nei nuomos data")
        return self


# "nuolaidos_kodas" NEgali būti OrderBase dalis - jis NIEKADA nesaugomas Uzsakymai lentelėje (žr. order.py endpoint'ą), tik VIENKARTINIS nurodymas, kiek atimti iš bendra_kaina kūrimo metu. "rezervacijos_id" TAIP PAT NĖRA Uzsakymai lentelės stulpelis - jis nurodo, KURIĄ rezervaciją šis užsakymas PAVERČIA realia nuoma (žr. order.py create_order), kad TOS PAČIOS rezervacijos nebeliktų blokuojamos kaip "kito" booking'o.
class OrderCreate(OrderBase):
    nuolaidos_kodas: Optional[str] = None
    rezervacijos_id: Optional[int] = None


# NEgali paveldėti OrderBase - leidžia keisti TIK 3 laukus (žr. order.py endpoint'o komentarą, kodėl klientas/automobilis/kaina nekeičiami per PUT). validate_dates iš OrderBase ČIA NEPASIEKIAMA (nuomos_data nėra šios schemos lauko dalis) - tad TA PATI patikra atliekama RANKA endpoint'e (order.py), prieš priskiriant naują grazinimo_data.
class OrderUpdate(BaseModel):
    uzsakymo_busena: Optional[str] = None
    grazinimo_data: Optional[date] = None
    turi_papildomas_paslaugas: Optional[bool] = None

    # Leidžiamos tik tos būsenos, pagal kurias sistema sprendžia apie aktyvią nuomą ar rezervaciją.
    @field_validator("uzsakymo_busena")
    @classmethod
    def validate_busena(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_BUSENA:
            raise ValueError(f"Negalima būsena. Leistinos: {', '.join(VALID_BUSENA)}")
        return v


class OrderOut(OrderBase):
    uzsakymo_id: int
    kliento_id: int
    automobilio_id: int
    links: List[Dict]
