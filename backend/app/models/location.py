from sqlalchemy import Column, Integer, String
from app.db.base import Base

class Location(Base):
    __tablename__ = "pristatymo_vietos"

    vietos_id = Column(Integer, primary_key=True, index=True)
    pavadinimas = Column(String(100), nullable=False)
    adresas = Column(String(255), nullable=False)
    miestas = Column(String(100), nullable=False)
