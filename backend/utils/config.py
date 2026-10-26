from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl

# parents[1] - du katalogai aukštyn nuo ŠIO failo (utils/config.py), tad backend/ šaknis, kur guli .env.
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
# Aplinkos kintamieji turi pirmenybę prieš backend/.env: override=False iš failo užpildo tik nenustatytas reikšmes, todėl diegimo metu perduoti DB ir saugumo nustatymai išlieka.
load_dotenv(dotenv_path=ENV_PATH, override=False, encoding="utf-8")

class Settings(BaseSettings):
    # extra="ignore" - leidžia .env faile būti IR kitiems raktams (pvz. DATABASE_URL), kurių šis modelis visai nenaudoja, kad jų nereikėtų visų išvardinti laukais žemiau.
    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    FRONTEND_URL: AnyHttpUrl = "http://localhost:3000"
    # Geokodavimo tiekėjo adresą galima pakeisti nekeičiant portalų kodo; API rakto nereikia.
    NOMINATIM_URL: AnyHttpUrl = "https://nominatim.openstreetmap.org/search"

    # Privalomas JWT pasirašymo raktas naudojamas auth_service.py bilietams kurti ir deps.py jų parašams tikrinti.
    SECRET_KEY: str

    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URL: AnyHttpUrl = "http://localhost:8000/api/v1/google/callback"

    # GitHub OAuth yra PAPILDOMAS prisijungimo būdas (ne pagrindinis kaip Google aukščiau) - visi trys laukai neprivalomi, projektas pilnai veikia IR be GitHub konfigūracijos (žr. auth.py, kur /github endpoint'ai registruojami TIK jei šie raktai įrašyti).
    GITHUB_CLIENT_ID: str | None = None
    GITHUB_CLIENT_SECRET: str | None = None
    GITHUB_REDIRECT_URL: str | None = None

    # Be numatytosios reikšmės - trūkstamas SESSION_SECRET_KEY pasirašytų OAuth sesijas viešai žinomu raktu.
    SESSION_SECRET_KEY: str


settings = Settings()

# Pydantic aukščiau jau atmestų VISIŠKAI trūkstamą kintamąjį (laukas be numatytosios reikšmės), bet NE tuščią eilutę (.env faile raktas = tuščia reikšmė yra VALIDI "str" reikšmė) - šis ciklas pagauna IR tą atvejį, su aiškesne klaidos žinute nei standartinė Pydantic klaida.
for k in ("SECRET_KEY", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET_KEY"):
    if not getattr(settings, k):
        raise RuntimeError(f"Trūksta env kintamojo: {k}. Patikrink {ENV_PATH}")

# patikra aukščiau atmeta TIK visiškai tuščią/trūkstamą reikšmę, bet ne trivialiai TRUMPĄ (pvz. "x" - techniškai "netuščia", bet spėjama per sekundę). .env.example PATS dokumentuoja "min. 32 simboliai" ŠITIEMS DVIEM raktams - ši patikra PRIVERČIA tą reikalavimą, ne tik rekomenduoja jį komentare. Ilgis yra VIENINTELIS automatiškai patikrinamas apsaugos lygis (ne atsitiktinumo/entropijos įrodymas) - sąmoningai NEBANDOMA spėti, ar reikšmė "atrodo" atsitiktinė.
MIN_SECRET_KEY_LENGTH = 32
for k in ("SECRET_KEY", "SESSION_SECRET_KEY"):
    if len(getattr(settings, k)) < MIN_SECRET_KEY_LENGTH:
        raise RuntimeError(
            f"{k} per trumpas (turi būti bent {MIN_SECRET_KEY_LENGTH} simbolių). "
            f"Sugeneruok naują, pvz. per Python: secrets.token_urlsafe(48)"
        )
