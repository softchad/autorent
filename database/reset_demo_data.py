"""Rankiniu būdu paleidžiamas demo duomenų atstatymas iki seed.sql lygio.

NIEKADA nepaleidžiama automatiškai (ne serverio starto metu, ne restart'o metu) -
tik kai PATS paleidi šį failą. Sąmoningai NE API endpoint'as sistemoje: "išvalyti
visus duomenis" mygtukas realios aplikacijos viduje atrodytų rizikingai gynime,
net apsaugotas ADMIN teise. Naudojimas:

    cd database
    ../backend/.venv/Scripts/python reset_demo_data.py

Skaito DB prisijungimo duomenis iš backend/.env (DATABASE_URL) - juose esantis
slaptažodis NIEKUR čia neužrašomas iš naujo, tik perskaitomas.
"""
import re
import sys
from pathlib import Path

import pymysql

if sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / "backend" / ".env"
# TIK seed.sql - jis pats pradeda nuo TRUNCATE TABLE visoms 11 lentelėms, tad
# veikia pakartotinai prieš JAU EGZISTUOJANČIĄ DB. schema.sql/triggers.sql NEI
# turi DROP/IF NOT EXISTS apsaugos - jie skirti TIK pirmam, tuščios DB sukūrimui
# (žr. README.md), antrą kartą paleisti sukeltų "table/trigger already exists".
SQL_FILES = ["seed.sql"]


def read_database_url() -> str:
    if not ENV_PATH.exists():
        sys.exit(f"Nerastas {ENV_PATH} - nukopijuok iš backend/.env.example ir užpildyk.")
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("DATABASE_URL"):
            return line.split("=", 1)[1].strip()
    sys.exit("backend/.env neturi DATABASE_URL eilutės.")


def parse_database_url(url: str):
    m = re.match(r"mysql\+pymysql://([^:]+):([^@]*)@([^:/]+):?(\d+)?/(\w+)", url)
    if not m:
        sys.exit("Nepavyko perskaityti DATABASE_URL formato.")
    user, password, host, port, db = m.groups()
    return user, password, host, int(port or 3306), db


def run_sql_file(cursor, path: Path, as_trigger_blocks: bool):
    content = path.read_text(encoding="utf-8")
    if as_trigger_blocks:
        blocks = re.findall(r"^CREATE TRIGGER.*?^END", content, re.DOTALL | re.MULTILINE)
        for block in blocks:
            cursor.execute(block)
        print(f"  {path.name}: {len(blocks)} trigeriai")
    else:
        count = 0
        for stmt in content.split(";"):
            stmt = stmt.strip()
            if stmt:
                cursor.execute(stmt)
                count += 1
        print(f"  {path.name}: {count} SQL sakiniai")


def main():
    user, password, host, port, db = parse_database_url(read_database_url())

    print(f"Tai IŠTRINS visus esamus duomenis DB '{db}' ir vėl įrašys seed.sql turinį.")
    print("Prisijungimai su slaptažodžiais (Admin/Jonas/Aistė ir t.t.) bus atstatyti į pradinius.")
    confirm = input("Rašyk 'taip' jei tikrai norite tęsti: ").strip().lower()
    if confirm != "taip":
        print("Atšaukta - nieko nepakeista.")
        return

    conn = pymysql.connect(host=host, port=port, user=user, password=password, database=db)
    try:
        with conn.cursor() as cur:
            for name in SQL_FILES:
                path = Path(__file__).resolve().parent / name
                run_sql_file(cur, path, as_trigger_blocks=(name == "triggers.sql"))
        conn.commit()
    finally:
        conn.close()

    print("Atstatyta sėkmingai.")


if __name__ == "__main__":
    main()
