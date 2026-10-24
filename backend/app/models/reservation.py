# SQLAlchemy modelis - Python klasė, kuri atitinka "Rezervavimas" DB lentelę (žr. database/schema.sql); IŠANKSTINĖ rezervacija prieš patvirtinant realų užsakymą (tai yra order.py).
from sqlalchemy import Column, Integer, Date, String, ForeignKey, Numeric
from app.db.base import Base

class Reservation(Base):
    __tablename__ = "Rezervavimas"

    rezervacijos_id = Column(Integer, primary_key=True, index=True)
    # "nullable=False" VISUR žemiau - schema.sql reikalauja KIEKVIENO šio lauko (NOT NULL), tad modelis turi atkartoti TĄ PAČIĄ taisyklę, kitaip SQLite testai tyliai leistų tai, kas tikroje MySQL DB lūžtų.
    kliento_id = Column(Integer, ForeignKey("Klientai.kliento_id"), nullable=False)
    automobilio_id = Column(Integer, ForeignKey("Automobiliai.automobilio_id"), nullable=False)
    rezervacijos_pradzia = Column(Date, nullable=False)
    # schema.sql TAIP PAT turi CHECK (rezervacijos_pabaiga > rezervacijos_pradzia) DB lygmeniu - čia nekartojama (SQLAlchemy modeliai šio projekto konvencijoje CHECK apribojimų nemirroruoja), bet LYGIAI ta pati taisyklė patikrinta IR endpoint'e (reservation.py), PRIEŠ bandant įrašyti.
    rezervacijos_pabaiga = Column(Date, nullable=False)
    busena = Column(String(100), nullable=False)
    # UŽFIKSUOTA automobilio parų kaina REZERVACIJOS SUKŪRIMO metu, kad VĖLESNIS flotilės kainos pakeitimas NEpaveiktų jau rodytos/patvirtintos kainos (žr. customer.py _to_out). "nullable=True" - SENOS (prieš šį pakeitimą sukurtos) rezervacijos šio stulpelio neturės; _to_out tokiu atveju atkrenta prie DABARTINĖS automobilio kainos (senas elgesys), ne lūžta.
    kaina_parai = Column(Numeric(10, 2), nullable=True)
