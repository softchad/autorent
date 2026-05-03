from sqlalchemy import Column, Integer, Date, String, Boolean, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.db.base import Base

class Order(Base):
    __tablename__ = "uzsakymai"

    uzsakymo_id = Column(Integer, primary_key=True, index=True)
    kliento_id = Column(Integer, ForeignKey("klientai.kliento_id"))
    automobilio_id = Column(Integer, ForeignKey("Automobiliai.automobilio_id"))
    darbuotojo_id = Column(Integer, ForeignKey("darbuotojai.darbuotojo_id"))
    nuomos_data = Column(Date)
    grazinimo_data = Column(Date)
    paemimo_vietos_id = Column(Integer)
    grazinimo_vietos_id = Column(Integer)
    bendra_kaina = Column(Float)
    uzsakymo_busena = Column(String(50))
    turi_papildomas_paslaugas = Column(Boolean)

    # Santykiai
    saskaita = relationship("Invoice", back_populates="uzsakymas", uselist=False)
    klientas = relationship("Client", back_populates="uzsakymai")
