from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class SupportConversation(Base):
    __tablename__ = "pokalbiai"

    pokalbio_id = Column(Integer, primary_key=True, index=True)
    kliento_id = Column(Integer, ForeignKey("klientai.kliento_id"), nullable=False)
    darbuotojo_id = Column(Integer, ForeignKey("darbuotojai.darbuotojo_id"), nullable=True)
    tema = Column(String(150), nullable=False)
    kategorija = Column(String(30), nullable=False, default="kita")
    busena = Column(String(20), nullable=False, default="atvira")
    rezervacijos_id = Column(Integer, ForeignKey("rezervavimas.rezervacijos_id"), nullable=True)
    sprendimo_santrauka = Column(Text, nullable=True)
    kliento_paskutinis_matytas = Column(Integer, nullable=True)
    darbuotojo_paskutinis_matytas = Column(Integer, nullable=True)
    sukurimo_data = Column(TIMESTAMP, server_default=func.now())
    atnaujinimo_data = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
