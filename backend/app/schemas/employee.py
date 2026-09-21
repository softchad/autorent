# Darbuotojų "formos" - EmployeeCreate/EmployeeUpdate apibrėžia, kokius laukus PRIIMAME, EmployeeOut - kokius GRĄŽINAME. slaptazodis NIEKUR šiame bazinaime sąraše nėra, tad niekada automatiškai NEpatenka į atsakymą.
from pydantic import BaseModel, EmailStr, field_validator
from datetime import date
from typing import Optional, List, Dict


# database/schema.sql reikalauja telefono_nr kaip NOT NULL - turi būti privalomas IR čia, kitaip API priimtų darbuotoją be jo, o įrašymas į tikrą MySQL DB lūžtų su neaiškia klaida.
class EmployeeBase(BaseModel):
    vardas: str
    pavarde: str
    el_pastas: EmailStr  # Pydantic įmontuotas tipas - PATS patikrina el. pašto formatą, papildomo field_validator nereikia.
    telefono_nr: str
    pareigos: str
    # float, ne int - atlyginimas gali turėti centus (pvz. 1500.50); DB stulpelis DECIMAL(10,2), žr. models/employee.py.
    atlyginimas: float
    # Darbo sutarties pradžios data - be validatoriaus (skirtingai nei klientų gimimo_data), nes HR duomenys dažnai įvedami su istorine data ir papildoma "negali būti ateityje" taisyklė čia nereikalinga.
    isidarbinimo_data: date

    @field_validator("vardas", "pavarde")
    @classmethod
    def validate_names(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Vardas ir pavardė turi būti bent 2 simbolių ilgio")
        return v.strip()

    # "<= 0", ne vien "< 0" - atlyginimas 0 EUR yra tiek pat nerealus, kiek neigiamas (žr. tą pačią logiką car.py kaina_parai validatoriuje).
    @field_validator("atlyginimas")
    @classmethod
    def validate_atlyginimas(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Atlyginimas turi būti teigiamas skaičius")
        return v

    @field_validator("pareigos")
    @classmethod
    def validate_pareigos(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Pareigos turi būti bent 2 simbolių ilgio")
        return v.strip()


# slaptazodis TIK čia (ne EmployeeBase) - EmployeeOut žemiau paveldi EmployeeBase, NE šią klasę, tad slaptažodis niekada nepatenka į atsakymą.
class EmployeeCreate(EmployeeBase):
    slaptazodis: str

    # Tikrina RAW (neužšifruoto) slaptažodžio ilgį - užšifravimas (hash) vyksta VĖLIAU, endpoint'e (employee.py), prieš įrašant į DB.
    @field_validator("slaptazodis")
    @classmethod
    def validate_slaptazodis(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Slaptažodis turi būti bent 8 simbolių ilgio")
        return v


# NEgali paveldėti EmployeeBase - joje laukai PRIVALOMI, o čia VISI turi būti pasirenkami (dalinis atnaujinimas); VISI EmployeeBase validatoriai todėl PAKARTOJAMI žemiau su "None" tolerancija, kitaip bloga reikšmė PRAEITŲ čia, bet sulaužytų EmployeeOut atsakymo validaciją (realus bug'as, rastas ir pataisytas - žr. testus).
class EmployeeUpdate(BaseModel):
    vardas: Optional[str] = None
    pavarde: Optional[str] = None
    el_pastas: Optional[EmailStr] = None
    telefono_nr: Optional[str] = None
    pareigos: Optional[str] = None
    atlyginimas: Optional[float] = None
    isidarbinimo_data: Optional[date] = None
    # Leidžia ADMINISTRATORIUI pakeisti KITO darbuotojo slaptažodį per šį endpoint'ą (ne tik pats darbuotojas per /change-password) - žr. employee.py ADMIN_ONLY_FIELDS patikrą.
    slaptazodis: Optional[str] = None

    @field_validator("vardas", "pavarde")
    @classmethod
    def validate_names(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v.strip()) < 2:
            raise ValueError("Vardas ir pavardė turi būti bent 2 simbolių ilgio")
        return v.strip() if v else v

    @field_validator("pareigos")
    @classmethod
    def validate_pareigos(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v.strip()) < 2:
            raise ValueError("Pareigos turi būti bent 2 simbolių ilgio")
        return v.strip() if v else v

    @field_validator("atlyginimas")
    @classmethod
    def validate_atlyginimas(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError("Atlyginimas turi būti teigiamas skaičius")
        return v

    @field_validator("slaptazodis")
    @classmethod
    def validate_slaptazodis(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) < 8:
            raise ValueError("Slaptažodis turi būti bent 8 simbolių ilgio")
        return v


# Tai, kas GRĄŽINAMA apie darbuotoją - paveldi EmployeeBase (NE EmployeeCreate), tad slaptazodis lauko čia NĖRA iš principo, ne tik "nerodomas".
class EmployeeOut(EmployeeBase):
    darbuotojo_id: int
    links: List[Dict]
