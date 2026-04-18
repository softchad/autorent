from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class ClientSupport(Base):
    __tablename__ = "klientu_palaikymas"

    uzklausos_id = Column(Integer, primary_key=True, index=True)
    kliento_id = Column(Integer, ForeignKey("klientai.kliento_id"))
    darbuotojo_id = Column(Integer, ForeignKey("darbuotojai.darbuotojo_id"))
    tema = Column(String(100), nullable=False)
    pranesimas = Column(String(255), nullable=False)
    atsakymas = Column(String(255), nullable=True)
    pateikimo_data = Column(DateTime)
    atsakymo_data = Column(DateTime, nullable=True)

    kliento = relationship("Client", back_populates="uzklausos")
    darbuotojas = relationship("Employee", back_populates="uzklausos")
