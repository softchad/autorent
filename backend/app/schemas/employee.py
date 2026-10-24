# Darbuotojų "formos" - EmployeeCreate/EmployeeUpdate apibrėžia, kokius laukus PRIIMAME, EmployeeOut - kokius GRĄŽINAME. slaptazodis NIEKUR šiame bazinaime sąraše nėra, tad niekada automatiškai NEpatenka į atsakymą.
from pydantic import BaseModel, EmailStr, field_validator
from datetime import date
from typing import Optional, List, Dict

from app.api.permissions import ROLE_PERMS
from app.services.auth_service import MAX_PASSWORD_BYTES


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

    # Vardai tikrinami, kad tuščias ar per trumpas tekstas nepatektų į kliento ar darbuotojo įrašą.
    @field_validator("vardas", "pavarde")
    @classmethod
    def validate_names(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Vardas ir pavardė turi būti bent 2 simbolių ilgio")
        return v.strip()

    # "<= 0", ne vien "< 0" - atlyginimas 0 EUR yra tiek pat nerealus, kiek neigiamas (žr. tą pačią logiką car.py kaina_parai validatoriuje). "v is None" PRALEIDŽIAMA - EmployeeCreate (vienintelė VARTOJIMO vieta) atlyginimą laiko PRIVALOMU (niekada None), bet EmployeeOut (ŠIS validatorius PAVELDĖTAS IR jam, žr. žemiau) jį PERRAŠO į Optional, kad get_employees galėtų grąžinti None KOLEGOMS, kurie nėra administratorius.
    @field_validator("atlyginimas")
    @classmethod
    def validate_atlyginimas(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("Atlyginimas turi būti teigiamas skaičius")
        return v

    # Be šios patikros bet kokia (net gerai suformatuota) "pareigos" reikšmė praeitų validaciją, bet has_perm (permissions.py) tyliai grąžintų TUŠČIĄ teisių rinkinį kiekvienam tokiam darbuotojui - jokios klaidos, tiesiog visi veiksmai būtų 403, kol kažkas pastebėtų rašybos klaidą.
    @field_validator("pareigos")
    @classmethod
    def validate_pareigos(cls, v: str) -> str:
        v = v.strip()
        if v not in ROLE_PERMS:
            raise ValueError(f"Nežinomos pareigos. Leistinos: {', '.join(ROLE_PERMS)}")
        return v


# slaptazodis TIK čia (ne EmployeeBase) - EmployeeOut žemiau paveldi EmployeeBase, NE šią klasę, tad slaptažodis niekada nepatenka į atsakymą.
class EmployeeCreate(EmployeeBase):
    slaptazodis: str

    # Tikrina RAW (neužšifruoto) slaptažodžio ilgį - užšifravimas (hash) vyksta VĖLIAU, endpoint'e (employee.py), prieš įrašant į DB.
    @field_validator("slaptazodis")
    @classmethod
    def validate_slaptazodis(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Slaptažodis turi būti bent 8 simbolių ilgio")
        # žr. customer_auth.py analogišką patikrą.
        if len(v.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError(f"Slaptažodis negali būti ilgesnis nei {MAX_PASSWORD_BYTES} baitų")
        return v


# EmployeeUpdate leidžia dalinį atnaujinimą: neprivalomi laukai tikrinami pagal EmployeeBase taisykles, kad employee.py išsaugotas darbuotojas atitiktų EmployeeOut atsakymą.
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

    # Vardai tikrinami, kad tuščias ar per trumpas tekstas nepatektų į kliento ar darbuotojo įrašą.
    @field_validator("vardas", "pavarde")
    @classmethod
    def validate_names(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v.strip()) < 2:
            raise ValueError("Vardas ir pavardė turi būti bent 2 simbolių ilgio")
        return v.strip() if v else v

    # Ta pati patikra kaip EmployeeBase aukščiau, su "None" tolerancija (laukas PASIRENKAMAS dalinio atnaujinimo metu).
    @field_validator("pareigos")
    @classmethod
    def validate_pareigos(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if v not in ROLE_PERMS:
            raise ValueError(f"Nežinomos pareigos. Leistinos: {', '.join(ROLE_PERMS)}")
        return v

    # Neigiamas atlyginimas nelaikomas tinkamu darbuotojo duomeniu.
    @field_validator("atlyginimas")
    @classmethod
    def validate_atlyginimas(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError("Atlyginimas turi būti teigiamas skaičius")
        return v

    # Slaptažodžio ribos tikrinamos prieš maišymą, kad bcrypt neapkirptų jo nepastebimai.
    @field_validator("slaptazodis")
    @classmethod
    def validate_slaptazodis(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError("Slaptažodis turi būti bent 8 simbolių ilgio")
        # žr. customer_auth.py analogišką patikrą.
        if len(v.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError(f"Slaptažodis negali būti ilgesnis nei {MAX_PASSWORD_BYTES} baitų")
        return v


# Tai, kas GRĄŽINAMA apie darbuotoją - paveldi EmployeeBase (NE EmployeeCreate), tad slaptazodis lauko čia NĖRA iš principo, ne tik "nerodomas".
class EmployeeOut(EmployeeBase):
    darbuotojo_id: int
    links: List[Dict]

    # Perrašo EmployeeBase.atlyginimas (ten privalomas float) į PASIRENKAMĄ - žr. employee.py get_employees, kur KOLEGŲ (ne savo) atlyginimas NEadministratoriui grąžinamas kaip None, ne tikra suma (GET /employees/ VIEW teisė turi IR Vadybininkas/Mechanikas/Klientų aptarnavimas, ne tik administratorius).
    atlyginimas: Optional[float] = None
