# SQLAlchemy modelis - Python klasė, kuri atitinka "Darbuotojai" DB lentelę (žr. database/schema.sql).
from sqlalchemy import Column, Integer, String, Date, DECIMAL
from app.db.base import Base

class Employee(Base):
    __tablename__ = "Darbuotojai"

    darbuotojo_id = Column(Integer, primary_key=True, index=True)
    # "nullable=False" ir "DECIMAL(10,2)" žemiau - schema.sql reikalauja ŠIŲ TIKSLIŲ taisyklių, tad modelis turi jas atkartoti, kitaip SQLite testai tyliai leistų tai, kas tikroje MySQL DB lūžtų arba apsikarpytų.
    vardas = Column(String(50), nullable=False)
    pavarde = Column(String(50), nullable=False)
    el_pastas = Column(String(100), unique=True, index=True, nullable=False)
    telefono_nr = Column(String(20), nullable=False)
    pareigos = Column(String(50), nullable=False)
    atlyginimas = Column(DECIMAL(10, 2), nullable=False)
    isidarbinimo_data = Column(Date, nullable=False)
    # slaptazodis GALI būti NULL - teoriškai leidžia darbuotoją sukurti be slaptažodžio, bet realiai create_employee endpoint'as (employee.py) visada jį reikalauja ir užšifruoja prieš įrašymą.
    slaptazodis = Column(String(255))
    # Darbuotojo token_version susieja DB paskyrą su auth_service.py išduoto JWT ver lauku; deps.py atmeta bilietą, kai ši versija nebeatitinka bazės.
    token_version = Column(Integer, nullable=False, default=0)
