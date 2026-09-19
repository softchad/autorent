from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# DATABASE_URL BŪTINAS - jei .env'o trūksta, serveris turi IŠKART atsisakyti startuoti (fail-fast), o ne tyliai bandyti jungtis su atsitiktiniu atsarginiu adresu ir vėliau lūžti neaiškia klaida kiekviename DB kreipinyje.
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("Trūksta env kintamojo: DATABASE_URL. Patikrink backend/.env failą.")

engine = create_engine(DATABASE_URL)

# autocommit=False/autoflush=False - standartinė SQLAlchemy nuostata: pakeitimai DB keliauja TIK kai kodas PATS aiškiai paprašo (db.commit()), ne automatiškai už nugaros be perspėjimo.
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)
