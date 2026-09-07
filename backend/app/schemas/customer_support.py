# Kliento pagalbos žinutės - tas pats Klientu_Palaikymas duomenų modelis, kurį
# naudoja darbuotojų /support puslapis (žr. app/schemas/client_support.py), bet
# šis endpointas (customer_support.py) leidžia klientui patį sukurti įrašą su
# savo kliento_id (iš tokeno, ne iš užklausos), be darbuotojo_id - užklausa lieka
# "nepriskirta", kol darbuotojas atsakys. Taip klientų aptarnavimas tampa realia,
# uždara sistema: nėra jokio viešo AutoRent el. pašto, tik žinutė sistemoje.
from datetime import datetime
from pydantic import BaseModel


class CustomerSupportCreate(BaseModel):
    tema: str
    pranesimas: str


class CustomerSupportOut(BaseModel):
    uzklausos_id: int
    tema: str
    pranesimas: str
    atsakymas: str | None = None
    pateikimo_data: datetime | None = None
    atsakymo_data: datetime | None = None

    class Config:
        from_attributes = True
