# SQLAlchemy modelis - Python klasė, kuri atitinka "Automobiliai" DB lentelę (žr. database/schema.sql); kiekvienas Column() žemiau yra VIENAS lentelės stulpelis.
from sqlalchemy import Column, ForeignKey, Integer, String, Boolean, DECIMAL, Date
from app.db.base import Base
from sqlalchemy.orm import relationship
from app.models.location import Location

class Car(Base):
    __tablename__ = "Automobiliai"

    automobilio_id = Column(Integer, primary_key=True, index=True)
    marke = Column(String(50), nullable=False)
    modelis = Column(String(50), nullable=False)
    metai = Column(Integer, nullable=False)
    numeris = Column(String(20), unique=True, nullable=False)
    vin_kodas = Column(String(17), unique=True, nullable=False)
    spalva = Column(String(50), nullable=False)
    kebulo_tipas = Column(String(50), nullable=False)
    pavaru_deze = Column(String(50), nullable=False)
    variklio_turis = Column(DECIMAL(3,1), nullable=False)
    galia_kw = Column(Integer, nullable=False)
    kuro_tipas = Column(String(20), nullable=False)
    rida = Column(Integer, nullable=False)
    sedimos_vietos = Column(Integer, nullable=False)
    klimato_kontrole = Column(Boolean, nullable=False, default=False)
    navigacija = Column(Boolean, nullable=False, default=False)
    kaina_parai = Column(DECIMAL(10,2), nullable=False)
    automobilio_statusas = Column(String(50), nullable=False)
    technikines_galiojimas = Column(Date, nullable=False)
    # "nullable=False" - schema.sql reikalauja šio lauko (automobilis VISADA turi turėti priskirtą esamą lokaciją), tad modelis turi atkartoti TĄ PAČIĄ taisyklę, kitaip SQLite testai tyliai leistų tai, kas tikroje MySQL DB lūžtų.
    dabartine_vieta_id = Column(Integer, ForeignKey("Pristatymo_Vietos.vietos_id"), nullable=False)
    pastabos = Column(String(255))

    # "lokacija" - leidžia Python kode rašyti "car.lokacija.pavadinimas" (SQLAlchemy pati padaro JOIN), vietoj to, kad reikėtų atskirai užklausti Location pagal dabartine_vieta_id.
    lokacija = relationship(Location, backref="automobiliai")
