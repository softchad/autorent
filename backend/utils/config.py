from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl

# parents[1] - du katalogai aukštyn nuo ŠIO failo (utils/config.py), tad backend/ šaknis, kur guli .env.
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
# "override=True" - priverčia .env reikšmes PERRAŠYTI jau esančius OS aplinkos kintamuosius (pvz. iš senesnės terminalo sesijos), nes Pydantic žemiau PAGAL NUTYLĖJIMĄ duotų OS kintamiesiems PIRMENYBĘ prieš šį .env failą.
load_dotenv(dotenv_path=ENV_PATH, override=True, encoding="utf-8")

class Settings(BaseSettings):
    # extra="ignore" - leidžia .env faile būti IR kitiems raktams (pvz. DATABASE_URL), kurių šis modelis visai nenaudoja, kad jų nereikėtų visų išvardinti laukais žemiau.
    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    FRONTEND_URL: AnyHttpUrl = "http://localhost:3000"

    # JWT tokenų pasirašymui - be jo auth_service.py anksčiau tyliai pasirašytų tokenus su None, apeinant visų kitų paslapčių fail-fast patikrą.
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

    # Neprivalomas - geokodavimas (vietų paieška žemėlapyje) tiesiog tyliai neveiktų, jei nenustatytas.
    OPENCAGE_API_KEY: str | None = None

settings = Settings()

# Pydantic aukščiau jau atmestų VISIŠKAI trūkstamą kintamąjį (laukas be numatytosios reikšmės), bet NE tuščią eilutę (.env faile raktas = tuščia reikšmė yra VALIDI "str" reikšmė) - šis ciklas pagauna IR tą atvejį, su aiškesne klaidos žinute nei standartinė Pydantic klaida.
for k in ("SECRET_KEY", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET_KEY"):
    if not getattr(settings, k):
        raise RuntimeError(f"Trūksta env kintamojo: {k}. Patikrink {ENV_PATH}")
