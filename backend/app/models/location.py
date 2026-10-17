# SQLAlchemy modelis - Python klasė, kuri atitinka "Pristatymo_Vietos" DB lentelę (automobilių paėmimo/grąžinimo punktai); sukuriamos tik per seed.sql, API turi TIK skaitymo endpoint'ą (getLocations car.py faile), ne kūrimo.
from sqlalchemy import Column, Integer, String
from app.db.base import Base

class Location(Base):
    __tablename__ = "Pristatymo_Vietos"

    vietos_id = Column(Integer, primary_key=True, index=True)
    pavadinimas = Column(String(100), nullable=False)
    adresas = Column(String(255), nullable=False)
    miestas = Column(String(100), nullable=False)
