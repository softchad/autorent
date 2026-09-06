from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class SupportMessage(Base):
    """Vieša žinutė - matoma ir klientui, ir darbuotojui. Niekada neperrašoma."""

    __tablename__ = "pokalbio_zinutes"

    zinutes_id = Column(Integer, primary_key=True, index=True)
    pokalbio_id = Column(Integer, ForeignKey("pokalbiai.pokalbio_id"), nullable=False)
    autoriaus_tipas = Column(String(20), nullable=False)  # "klientas" | "darbuotojas"
    kliento_id = Column(Integer, ForeignKey("klientai.kliento_id"), nullable=True)
    darbuotojo_id = Column(Integer, ForeignKey("darbuotojai.darbuotojo_id"), nullable=True)
    tekstas = Column(Text, nullable=False)
    sukurimo_data = Column(TIMESTAMP, server_default=func.now())


class SupportNote(Base):
    """VIDINĖ pastaba - atskira lentelė, kad kliento endpointas jos fiziškai negalėtų grąžinti."""

    __tablename__ = "pokalbio_pastabos"

    pastabos_id = Column(Integer, primary_key=True, index=True)
    pokalbio_id = Column(Integer, ForeignKey("pokalbiai.pokalbio_id"), nullable=False)
    darbuotojo_id = Column(Integer, ForeignKey("darbuotojai.darbuotojo_id"), nullable=False)
    tekstas = Column(Text, nullable=False)
    sukurimo_data = Column(TIMESTAMP, server_default=func.now())
