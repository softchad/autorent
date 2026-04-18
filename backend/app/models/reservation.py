from sqlalchemy import Column, Integer, Date, String, ForeignKey
from app.db.base import Base

class Reservation(Base):
    __tablename__ = "rezervavimas"

    rezervacijos_id = Column(Integer, primary_key=True, index=True)
    kliento_id = Column(Integer, ForeignKey("klientai.kliento_id"))
    automobilio_id = Column(Integer, ForeignKey("Automobiliai.automobilio_id"))
    rezervacijos_pradzia = Column(Date)
    rezervacijos_pabaiga = Column(Date)
    busena = Column(String(100))
