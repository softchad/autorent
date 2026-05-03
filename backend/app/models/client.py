from sqlalchemy import Column, Integer, String, Date, DateTime
from app.db.base import Base
from sqlalchemy.orm import relationship
from datetime import datetime

class Client(Base):
    __tablename__ = "klientai"

    kliento_id = Column(Integer, primary_key=True, index=True)
    vardas = Column(String(50))
    pavarde = Column(String(50))
    el_pastas = Column(String(100), unique=True, index=True, nullable=False)
    telefono_nr = Column(String(20))
    gimimo_data = Column(Date)
    registracijos_data = Column(DateTime, default=datetime.utcnow)
    bonus_taskai = Column(Integer, default=0, nullable=False)

    uzsakymai = relationship("Order", back_populates="klientas")
    uzklausos = relationship("ClientSupport", back_populates="kliento")
