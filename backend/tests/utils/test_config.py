# utils/config.py testai - PATS modulis atlieka fail-fast patikras IMPORT metu (ENV_PATH apskaičiuojamas IŠ "__file__", tad jo neįmanoma tiesiog "monkeypatch'inti" prieš importą), tad kiekvienas testas NUKOPIJUOJA TIKRĄ config.py šaltinį į LAIKINĄ katalogą (su savo "utils/" palenkiniu, kad "parents[1]" aritmetika sutaptų su realia backend/ struktūra) ir paleidžia VISIŠKAI ATSKIRĄ Python procesą (subprocess) su TEN esančiu sintetiniu .env failu - niekada neliečiant TIKRO backend/.env.
import os
import shutil
import subprocess
import sys
from pathlib import Path

# Šiuos raktus VISADA pašaliname iš subprocess'o aplinkos PRIEŠ paleidimą - testai valdo JUOS per ".env" failą/"extra_os_env", tad ŠIO (testą vykdančio) proceso TIKRI (realaus backend/.env) aplinkos kintamieji, jei kokiu būdu jau nutekėję į procesą, NIEKADA netyliai "nutekėtų" į subprocess'ą ir nepakeistų testo rezultato.
_CONTROLLED_KEYS = (
    "SECRET_KEY", "SESSION_SECRET_KEY", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
    "DATABASE_URL", "FRONTEND_URL", "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET", "GITHUB_REDIRECT_URL",
)

REAL_CONFIG_PY = Path(__file__).resolve().parents[2] / "utils" / "config.py"

VALID_ENV_LINES = {
    "SECRET_KEY": "x" * 40,
    "SESSION_SECRET_KEY": "y" * 40,
    "GOOGLE_CLIENT_ID": "fake-client-id",
    "GOOGLE_CLIENT_SECRET": "fake-client-secret",
}


# Paruošia "<tmp>/utils/config.py" (TIKRO failo kopija) + "<tmp>/.env" - "parents[1]" config.py viduje duoda TIEK ŠIO, kiek realaus backend/utils/config.py (abu atvejais "du katalogai aukštyn nuo config.py"), tad ENV_PATH savaime nusitaiko į ŠĮ laikiną .env, be jokio monkeypatch'o.
def _prepare_isolated_module(tmp_path: Path, env_overrides: dict) -> Path:
    utils_dir = tmp_path / "utils"
    utils_dir.mkdir()
    shutil.copy(REAL_CONFIG_PY, utils_dir / "config.py")

    lines = dict(VALID_ENV_LINES, **env_overrides)
    (tmp_path / ".env").write_text("\n".join(f"{k}={v}" for k, v in lines.items()), encoding="utf-8")
    return tmp_path


# Atskiras procesas patikrina nustatymų užkrovimą nepakeisdamas testų proceso paslapčių.
def _run_isolated_import(tmp_path: Path, extra_os_env: dict | None = None, print_secret: bool = False) -> subprocess.CompletedProcess:
    script = "import utils.config as cfg"
    if print_secret:
        script += ";print('SECRET_KEY=' + cfg.settings.SECRET_KEY)"
    env = {k: v for k, v in os.environ.items() if k not in _CONTROLLED_KEYS}
    if extra_os_env:
        env.update(extra_os_env)
    return subprocess.run(
        [sys.executable, "-c", script],
        cwd=str(tmp_path),
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
    )


# Per trumpas SECRET_KEY turi sustabdyti konfigūracijos įkėlimą, kad auth_service.py negalėtų pasirašyti prisijungimo bilietų lengvai atspėjamu raktu.
def test_rejects_short_secret_key(tmp_path):
    isolated = _prepare_isolated_module(tmp_path, {"SECRET_KEY": "x"})
    result = _run_isolated_import(isolated)
    assert result.returncode != 0
    assert "per trumpas" in result.stderr


# Priešinga pusė - PAKANKAMAI ilgas raktas (VALID_ENV_LINES aukščiau, 40 simbolių) startuoja sėkmingai, tad patikra neatmeta IR teisingų reikšmių.
def test_accepts_sufficiently_long_secret_key(tmp_path):
    isolated = _prepare_isolated_module(tmp_path, {})
    result = _run_isolated_import(isolated)
    assert result.returncode == 0, result.stderr


# OS perduota konfigūracija turi turėti pirmenybę prieš backend/.env reikšmes, kad diegimo aplinkos DB adresas ir saugumo raktai nebūtų perrašyti vietiniu failu.
def test_injected_env_var_not_overridden_by_dotenv_file(tmp_path):
    isolated = _prepare_isolated_module(tmp_path, {"SECRET_KEY": "FROM_DOTENV_FILE_" + "z" * 40})
    injected = {
        "SECRET_KEY": "FROM_INJECTED_OS_ENV_" + "q" * 40,
        "SESSION_SECRET_KEY": VALID_ENV_LINES["SESSION_SECRET_KEY"],
        "GOOGLE_CLIENT_ID": VALID_ENV_LINES["GOOGLE_CLIENT_ID"],
        "GOOGLE_CLIENT_SECRET": VALID_ENV_LINES["GOOGLE_CLIENT_SECRET"],
    }
    result = _run_isolated_import(isolated, extra_os_env=injected, print_secret=True)
    assert result.returncode == 0, result.stderr
    assert "SECRET_KEY=FROM_INJECTED_OS_ENV_" in result.stdout
    assert "FROM_DOTENV_FILE" not in result.stdout
