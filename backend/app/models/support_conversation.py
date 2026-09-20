# SQLAlchemy modelis - Python klasė, kuri atitinka "Pokalbiai" DB lentelę (žr. database/schema.sql); VIENAS pokalbis = viena klientas-AutoRent pagalbos byla, su žinutėmis (SupportMessage) ir pastabomis (SupportNote) atskirose lentelėse.
from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class SupportConversation(Base):
    __tablename__ = "pokalbiai"

    pokalbio_id = Column(Integer, primary_key=True, index=True)
    kliento_id = Column(Integer, ForeignKey("klientai.kliento_id"), nullable=False)
    # NULL, kol niekas nepriskirtas (žr. claim_conversation support_service.py faile).
    darbuotojo_id = Column(Integer, ForeignKey("darbuotojai.darbuotojo_id"), nullable=True)
    tema = Column(String(150), nullable=False)
    kategorija = Column(String(30), nullable=False, default="kita")
    busena = Column(String(20), nullable=False, default="atvira")
    # NULL, jei pokalbis NESUSIETAS su konkrečia rezervacija (klientas gali rašyti ir apie bendrus klausimus).
    rezervacijos_id = Column(Integer, ForeignKey("rezervavimas.rezervacijos_id"), nullable=True)
    # NULL, kol pokalbis NEIŠSPRĘSTAS (žr. resolve_conversation support_service.py faile).
    sprendimo_santrauka = Column(Text, nullable=True)
    kliento_paskutinis_matytas = Column(Integer, nullable=True)
    darbuotojo_paskutinis_matytas = Column(Integer, nullable=True)
    # "server_default" (ne Python pusės default) - DB PATI užpildo laiko žymą INSERT/UPDATE metu, tad "nullable=False" saugu, nes reikšmė visada bus.
    sukurimo_data = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    atnaujinimo_data = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)
