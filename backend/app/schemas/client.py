# EmailStr - Pydantic įmontuotas tipas, kuris PATS patikrina, ar reikšmė atrodo kaip el. paštas (turi "@" ir domeną) - atmeta neteisingą formatą AUTOMATIŠKAI, papildomo field_validator nereikia.
from pydantic import BaseModel, EmailStr, field_validator
from datetime import date, datetime, timezone
from typing import Optional, List, Dict


# Tiksli amžiaus patikra (metai/mėnuo/diena, ne tik metų skirtumas) - naudojama ABIEJUOSE validatoriuose žemiau, kad klientas (nesvarbu, ar jis save registruoja, ar darbuotojas sukuria ČIA) būtų TIK pilnametis (žr. nuomos-taisykles puslapį frontend'e, 1 skyrius).
def _is_at_least_18(v: date) -> bool:
    today = datetime.now(timezone.utc).date()
    age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
    return age >= 18


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

    # Telefono formatas tikrinamas, kad kontaktas atitiktų formose naudojamas taisykles.
    @field_validator("telefono_nr")
    @classmethod
    def validate_telefono(cls, v: str) -> str:
        if len(v.strip()) < 6:
            raise ValueError("Telefono numeris per trumpas")
        return v

    # Trys taisyklės - nei ateityje, nei prieš 1900 m., nei nepilnametis - suderinta su customer_auth.py (kliento savarankiškos registracijos) riba, kad galiotų TA PATI, nesvarbu, kas klientą sukūrė.
    @field_validator("gimimo_data")
    @classmethod
    def validate_gimimo_data(cls, v: date) -> date:
        if v > datetime.now(timezone.utc).date():
            raise ValueError("Gimimo data negali būti ateityje")
        if v.year < 1900:
            raise ValueError("Neteisinga gimimo data")
        if not _is_at_least_18(v):
            raise ValueError("Klientas turi būti pilnametis (18+ metų)")
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

    # Vardai tikrinami, kad tuščias ar per trumpas tekstas nepatektų į kliento ar darbuotojo įrašą.
    @field_validator("vardas", "pavarde")
    @classmethod
    def validate_names(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v.strip()) < 2:
            raise ValueError("Vardas ir pavardė turi būti bent 2 simbolių ilgio")
        # "v.strip() if v else v" - apkarpo tarpus TIK jei reikšmė realiai atsiųsta; None (lauko visai nebuvo užklausoje) paliekamas None, kad exclude_unset=True (client.py endpoint'e) žinotų, jog šis laukas NEBUVO keičiamas.
        return v.strip() if v else v

    # Telefono tikrinimas taikomas ir tuščiai eilutei: None gali reikšti nepateiktą lauką, o pateikta reikšmė turi atitikti ilgio taisykles, kurias naudoja client.py.
    @field_validator("telefono_nr")
    @classmethod
    def validate_telefono(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v.strip()) < 6:
            raise ValueError("Telefono numeris per trumpas")
        return v

    # Tos pačios trys taisyklės kaip ClientBase aukščiau, su "None" tolerancija (laukas PASIRENKAMAS dalinio atnaujinimo metu).
    @field_validator("gimimo_data")
    @classmethod
    def validate_gimimo_data(cls, v: Optional[date]) -> Optional[date]:
        if v is None:
            return v
        if v > datetime.now(timezone.utc).date():
            raise ValueError("Gimimo data negali būti ateityje")
        if v.year < 1900:
            raise ValueError("Neteisinga gimimo data")
        if not _is_at_least_18(v):
            raise ValueError("Klientas turi būti pilnametis (18+ metų)")
        return v


# Tai, kas GRĄŽINAMA klientui apie klientą - paveldi VISUS ClientBase laukus (vardas, el. paštas...) ir prideda kliento_id/links; slaptazodis ČIA NĖRA, tad jis niekada nepatenka į API atsakymą.
class ClientOut(ClientBase):
    kliento_id: int
    links: List[Dict]

    # PERRAŠO (NE paveldi) ClientBase.validate_telefono - "ClientOut" yra IŠVESTIES, ne ĖJIMO, modelis, tad KŪRIMO/ATNAUJINIMO taisyklė ("bent 6 simboliai") čia neturi prasmės. Google OAuth paskyros (žr. auth.py _get_or_create_customer_token) kuriamos su telefono_nr="" (Google telefono numerio tiesiog neduoda) - be šio perrašymo VIENAS toks klientas sulaužytų VISO GET /clients/ sąrašo atsakymą , nes response_model validacija galioja VISAM sąrašui vienu metu.
    @field_validator("telefono_nr")
    @classmethod
    def validate_telefono(cls, v: str) -> str:
        return v

    # from_attributes=True - leidžia šį modelį sukurti IR iš žodyno (kaip client.py endpoint'ai dabar daro), IR tiesiai iš DB objekto (Client eilutės) ateityje, nereikalaujant pakeisti šios schemos.
    class Config:
        from_attributes = True
