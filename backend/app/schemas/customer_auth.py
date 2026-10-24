# Kliento (ne darbuotojo) prisijungimo/profilio formos - VISIŠKAI atskiras identitetas nuo app/schemas/auth.py (darbuotojų), su savo JWT "type" reikšme, savo DB lentele (Klientai, ne Darbuotojai).
from datetime import date, datetime, timezone
from pydantic import BaseModel, EmailStr, field_validator
from app.services.auth_service import MAX_PASSWORD_BYTES


# Tiksli amžiaus patikra (metai/mėnuo/diena, ne tik metų skirtumas) - naudojama ABIEJUOSE validatoriuose žemiau, kad nuomoti automobilį galėtų TIK pilnamečiai (žr. nuomos-taisykles puslapį frontend'e, 1 skyrius).
def _is_at_least_18(v: date) -> bool:
    today = datetime.now(timezone.utc).date()
    age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
    return age >= 18


# Nauja kliento REGISTRACIJA - visi laukai privalomi, nes tai PIRMAS kartas, kai klientas atsiranda DB.
class CustomerRegisterRequest(BaseModel):
    vardas: str
    pavarde: str
    el_pastas: EmailStr
    telefono_nr: str
    gimimo_data: date
    slaptazodis: str

    # Vardai tikrinami, kad tuščias ar per trumpas tekstas nepatektų į kliento ar darbuotojo įrašą.
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

    # Slaptažodžio ribos tikrinamos prieš maišymą, kad bcrypt neapkirptų jo nepastebimai.
    @field_validator("slaptazodis")
    @classmethod
    def validate_slaptazodis(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Slaptažodis turi būti bent 8 simbolių ilgio")
        # bcrypt (auth_service.py) tyliai apdoroja TIK pirmus 72 baitus; be šios patikros du SKIRTINGI, bet iki 72 baito sutampantys slaptažodžiai autentifikuotųsi kaip TAS PATS.
        if len(v.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError(f"Slaptažodis negali būti ilgesnis nei {MAX_PASSWORD_BYTES} baitų")
        return v

    # Dvi atskiros sveiko proto patikros - gimimo data NEGALI būti ateityje (akivaizdi spragos naudojimo klaida), IR negali būti NEREALIAI sena (prieš 1900 m., tikriausiai įvesties klaida, ne tikras amžius).
    @field_validator("gimimo_data")
    @classmethod
    def validate_gimimo_data(cls, v: date) -> date:
        if v > datetime.now(timezone.utc).date():
            raise ValueError("Gimimo data negali būti ateityje")
        if v.year < 1900:
            raise ValueError("Neteisinga gimimo data")
        if not _is_at_least_18(v):
            raise ValueError("Registruotis gali tik pilnamečiai (18+ metų) klientai")
        return v


class CustomerLoginRequest(BaseModel):
    el_pastas: EmailStr
    slaptazodis: str


# "Bearer" - standartinis žodis, sakantis, KAIP siųsti tokeną: "Authorization: Bearer <token>" antraštėje; tai ne slaptažodis, tiesiog tokeno TIPO žyma.
class CustomerTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# Grąžinama iš /customer/me - visi Client laukai, IŠSKYRUS slaptazodis (niekada nerodomas, net savo paskyros peržiūroje).
class CustomerInfo(BaseModel):
    kliento_id: int
    vardas: str
    pavarde: str
    el_pastas: str
    telefono_nr: str
    gimimo_data: date
    registracijos_data: datetime | None = None

    # from_attributes=True BŪTINAS čia - customer_auth.py endpoint'ai kviečia "CustomerInfo.model_validate(current_customer)" TIESIAI su ORM objektu (Client eilute), ne žodynu.
    class Config:
        from_attributes = True


# Dalinis profilio atnaujinimas - visi laukai pasirenkami (NIEKADA nekeičia slaptazodis - tam yra atskiras endpoint'as), validatoriai PAKARTOJAMI iš CustomerRegisterRequest su "None" tolerancija.
class CustomerProfileUpdate(BaseModel):
    vardas: str | None = None
    pavarde: str | None = None
    el_pastas: EmailStr | None = None
    telefono_nr: str | None = None
    gimimo_data: date | None = None
    # PRIVALOMAS TIK kai keičiamas el_pastas (žr. customer_auth.py update_profile) - el. pašto nuosavybė NIEKUR nepatikrinama (nėra laiško patvirtinimo), tad be šio patikrinimo bet kas, radęs/pavogęs ATVIRĄ SESIJĄ (JWT), galėtų NEŽINODAMAS slaptažodžio "persiregistruoti" paskyrą ant kito el. pašto.
    dabartinis_slaptazodis: str | None = None

    # Vardai tikrinami, kad tuščias ar per trumpas tekstas nepatektų į kliento ar darbuotojo įrašą.
    @field_validator("vardas", "pavarde")
    @classmethod
    def validate_names(cls, v: str | None) -> str | None:
        if v is not None and len(v.strip()) < 2:
            raise ValueError("Vardas ir pavardė turi būti bent 2 simbolių ilgio")
        return v.strip() if v else v

    # CustomerProfileUpdate tikrina kiekvieną pateiktą telefono reikšmę, įskaitant tuščią eilutę; nepateiktus laukus customer_auth.py praleidžia per exclude_unset=True.
    @field_validator("telefono_nr")
    @classmethod
    def validate_telefono(cls, v: str | None) -> str | None:
        if v is not None and len(v.strip()) < 6:
            raise ValueError("Telefono numeris per trumpas")
        return v

    # Gimimo data negali būti ateityje, nes ji naudojama kliento tinkamumui tikrinti.
    @field_validator("gimimo_data")
    @classmethod
    def validate_gimimo_data(cls, v: date | None) -> date | None:
        if v is None:
            return v
        if v > datetime.now(timezone.utc).date():
            raise ValueError("Gimimo data negali būti ateityje")
        if v.year < 1900:
            raise ValueError("Neteisinga gimimo data")
        if not _is_at_least_18(v):
            raise ValueError("Klientas turi būti pilnametis (18+ metų)")
        return v


# Tas pats, kas CustomerInfo, PLIUS access_token - žr. customer_auth.py update_profile, kodėl naujas tokenas kartais reikalingas.
class CustomerProfileUpdateOut(CustomerInfo):
    # Pakeitus el. paštą customer_auth.py padidina token_version ir grąžina naują bilietą; CustomerAuthProvider jį išsaugo, kad dabartinė kliento sesija liktų galiojanti.
    access_token: str | None = None
