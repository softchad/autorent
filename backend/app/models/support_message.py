from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


# Vieša žinutė - matoma IR klientui, IR darbuotojui; niekada neperrašoma, klaida taisoma NAUJA žinute, ne UPDATE (žr. database/schema.sql komentarą).
class SupportMessage(Base):
    __tablename__ = "pokalbio_zinutes"

    zinutes_id = Column(Integer, primary_key=True, index=True)
    pokalbio_id = Column(Integer, ForeignKey("pokalbiai.pokalbio_id"), nullable=False)
    autoriaus_tipas = Column(String(20), nullable=False)  # "klientas" | "darbuotojas"
    # TIK VIENAS iš šių dviejų bus užpildytas, priklausomai nuo autoriaus_tipas (kliento žinutė -> kliento_id, darbuotojo žinutė -> darbuotojo_id); antras liks NULL.
    kliento_id = Column(Integer, ForeignKey("klientai.kliento_id"), nullable=True)
    darbuotojo_id = Column(Integer, ForeignKey("darbuotojai.darbuotojo_id"), nullable=True)
    tekstas = Column(Text, nullable=False)
    # "server_default" (ne Python pusės default) - DB PATI užpildo laiko žymą INSERT metu, tad "nullable=False" saugu, nes reikšmė visada bus.
    sukurimo_data = Column(TIMESTAMP, server_default=func.now(), nullable=False)


# VIDINĖ pastaba - sąmoningai ATSKIRA lentelė (ne paslėpta žymė SupportMessage viduje), kad klientui skirtas endpoint'as jos FIZIŠKAI negalėtų atsitiktinai grąžinti.
class SupportNote(Base):
    __tablename__ = "pokalbio_pastabos"

    pastabos_id = Column(Integer, primary_key=True, index=True)
    pokalbio_id = Column(Integer, ForeignKey("pokalbiai.pokalbio_id"), nullable=False)
    darbuotojo_id = Column(Integer, ForeignKey("darbuotojai.darbuotojo_id"), nullable=False)
    tekstas = Column(Text, nullable=False)
    sukurimo_data = Column(TIMESTAMP, server_default=func.now(), nullable=False)
