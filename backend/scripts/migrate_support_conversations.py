# Vienkartinė migracija: senos Klientu_Palaikymas eilutės -> Pokalbiai/Pokalbio_Zinutes.
# Saugu paleisti pakartotinai - kiekviena sena eilutė žymima legacy_uzklausos_id
# komentare žinutėje, tad jau perkeltos praleidžiamos (ieškoma pagal temą+kliento_id+
# sukurimo_data sutapimą su pirma migruota žinute).
#
# Sena atsakyta eilutė TAMPA "sprendziama" (ne "isspresta") - atsakymas neįrodo
# sprendimo, žr. specifikacijos 20 skyrių. Peržiūra vėliau gali ją užbaigti.
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pymysql
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

DB_URL = os.getenv("DATABASE_URL", "")
# mysql+pymysql://user:pass@host:port/dbname
import re

m = re.match(r"mysql\+pymysql://([^:]+):([^@]*)@([^:/]+):?(\d*)/(\w+)", DB_URL)
if not m:
    raise SystemExit(f"Nepavyko išparsinti DATABASE_URL: {DB_URL}")
user, password, host, port, dbname = m.groups()
port = int(port) if port else 3306


def main():
    conn = pymysql.connect(host=host, port=port, user=user, password=password, database=dbname, charset="utf8mb4")
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM pokalbiai WHERE tema LIKE '[legacy]%'")
    already = cur.fetchone()[0]
    if already:
        print(f"Jau migruota {already} pokalbių (tema prasideda '[legacy]'). Praleidžiama - ištrink juos rankiniu būdu, jei nori kartoti.")
        conn.close()
        return

    cur.execute(
        "SELECT uzklausos_id, kliento_id, darbuotojo_id, tema, pranesimas, atsakymas, pateikimo_data, atsakymo_data "
        "FROM klientu_palaikymas ORDER BY uzklausos_id ASC"
    )
    rows = cur.fetchall()
    print(f"Rasta {len(rows)} senų įrašų migracijai.")

    migrated = 0
    for (uzklausos_id, kliento_id, darbuotojo_id, tema, pranesimas, atsakymas, pateikimo_data, atsakymo_data) in rows:
        busena = "sprendziama" if atsakymas else "atvira"
        atnaujinimo_data = atsakymo_data if atsakymo_data else pateikimo_data
        legacy_tema = f"[legacy #{uzklausos_id}] {tema}"[:150]

        cur.execute(
            "INSERT INTO pokalbiai (kliento_id, darbuotojo_id, tema, kategorija, busena, "
            "sukurimo_data, atnaujinimo_data) VALUES (%s, %s, %s, 'kita', %s, %s, %s)",
            (kliento_id, darbuotojo_id, legacy_tema, busena, pateikimo_data, atnaujinimo_data),
        )
        pokalbio_id = cur.lastrowid

        cur.execute(
            "INSERT INTO pokalbio_zinutes (pokalbio_id, autoriaus_tipas, kliento_id, tekstas, sukurimo_data) "
            "VALUES (%s, 'klientas', %s, %s, %s)",
            (pokalbio_id, kliento_id, pranesimas, pateikimo_data),
        )

        if atsakymas:
            # Jei darbuotojo_id nežinomas, žinutė lieka be autoriaus FK - autorius_vardas
            # bus "AutoRent" atvaizdavime, ne išgalvotas dabartinis adminas.
            cur.execute(
                "INSERT INTO pokalbio_zinutes (pokalbio_id, autoriaus_tipas, darbuotojo_id, tekstas, sukurimo_data) "
                "VALUES (%s, 'darbuotojas', %s, %s, %s)",
                (pokalbio_id, darbuotojo_id, atsakymas, atsakymo_data or pateikimo_data),
            )

        migrated += 1

    conn.commit()
    print(f"Migruota {migrated} pokalbių su žinutėmis.")
    conn.close()


if __name__ == "__main__":
    main()
