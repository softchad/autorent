# EmailStr - Pydantic įmontuotas tipas, kuris PATS patikrina, ar reikšmė atrodo kaip el. paštas (turi "@" ir domeną) - atmeta neteisingą formatą AUTOMATIŠKAI, papildomo field_validator nereikia.
from pydantic import BaseModel, EmailStr, field_validator
from datetime import date, datetime
from typing import Optional, List, Dict


# database/schema.sql reikalauja vardą/pavardę/telefono numerį/gimimo datą kaip NOT NULL - šie 4 laukai TURI būti privalomi ir ČIA, kitaip API priimtų klientą be jų, o įrašymas į tikrą MySQL DB lūžtų su neaiškia klaida (SQLite testuose tai tyliai "praeitų").
class ClientBase(BaseModel):
    vardas: str
    pavarde: str
    el_pastas: EmailStr
    telefono_nr: str
    gimimo_data: date
    # Optional, nors DB stulpelis realiai reikalingas - DB PATI užpildo šią reikšmę (DEFAULT CURRENT_TIMESTAMP), tad klientui siųsti jos nereikia; jei kas siunčia, tiesiog naudojama ta reikšmė.
    registracijos_data: Optional[datetime] = None

    # "@field_validator("vardas", "pavarde")" - VIENA funkcija patikrina ABU laukus (Pydantic leidžia išvardinti kelis laukų vardus vienam validatoriui, kai jiems reikia TOS PAČIOS taisyklės).
    @field_validator("vardas", "pavarde")
    @classmethod
    def validate_names(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Vardas ir pavardė turi būti bent 2 simbolių ilgio")
        return v.strip()

    @field_validator("telefono_nr")
    @classmethod
    def validate_telefono(cls, v: str) -> str:
        if len(v.strip()) < 6:
            raise ValueError("Telefono numeris per trumpas")
        return v


# Šiuo metu NEPRIDEDA nė vieno naujo lauko virš ClientBase - laikoma ATSKIRA klase (ne tiesiog ClientBase pakartotinai naudojama), kad ateityje būtų kur pridėti laukus, kurie reikalingi TIK kuriant, ne atnaujinant/grąžinant.
class ClientCreate(ClientBase):
    pass


# NEgali paveldėti ClientBase - joje laukai PRIVALOMI, o čia VISI turi būti pasirenkami (dalinis atnaujinimas); validatoriai (vardas/pavarde/telefono_nr) todėl PAKARTOJAMI žemiau su "None" tolerancija, kad PUT nepraleistų tų pačių klaidų, kurias POST atmeta.
class ClientUpdate(BaseModel):
    vardas: Optional[str] = None
    pavarde: Optional[str] = None
    el_pastas: Optional[EmailStr] = None
    telefono_nr: Optional[str] = None
    gimimo_data: Optional[date] = None
    registracijos_data: Optional[datetime] = None

    @field_validator("vardas", "pavarde")
    @classmethod
    def validate_names(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v.strip()) < 2:
            raise ValueError("Vardas ir pavardė turi būti bent 2 simbolių ilgio")
        # "v.strip() if v else v" - apkarpo tarpus TIK jei reikšmė realiai atsiųsta; None (lauko visai nebuvo užklausoje) paliekamas None, kad exclude_unset=True (client.py endpoint'e) žinotų, jog šis laukas NEBUVO keičiamas.
        return v.strip() if v else v

    @field_validator("telefono_nr")
    @classmethod
    def validate_telefono(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v.strip()) < 6:
            raise ValueError("Telefono numeris per trumpas")
        return v


# Tai, kas GRĄŽINAMA klientui apie klientą - paveldi VISUS ClientBase laukus (vardas, el. paštas...) ir prideda kliento_id/links; slaptazodis ČIA NĖRA, tad jis niekada nepatenka į API atsakymą.
class ClientOut(ClientBase):
    kliento_id: int
    links: List[Dict]

    # from_attributes=True - leidžia šį modelį sukurti IR iš žodyno (kaip client.py endpoint'ai dabar daro), IR tiesiai iš DB objekto (Client eilutės) ateityje, nereikalaujant pakeisti šios schemos.
    class Config:
        from_attributes = True
