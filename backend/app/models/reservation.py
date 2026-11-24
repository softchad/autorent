# SQLAlchemy modelis - Python klasė, kuri atitinka "Rezervavimas" DB lentelę (žr. database/schema.sql); IŠANKSTINĖ rezervacija prieš patvirtinant realų užsakymą (tai yra order.py).
from sqlalchemy import CheckConstraint, Column, Integer, Date, String, ForeignKey, Numeric
from sqlalchemy import DateTime
from app.db.base import Base

class Reservation(Base):
    __tablename__ = "Rezervavimas"
    # Tas pats apribojimas kaip schema.sql, kad testinė schema neleistų valandos, kurią MySQL atmestų.
    __table_args__ = (
        CheckConstraint("paemimo_valanda IS NULL OR paemimo_valanda BETWEEN 12 AND 18", name="chk_paemimo_valanda"),
        CheckConstraint(
            "(salygu_versija IS NULL) = (salygos_priimtos IS NULL)",
            name="chk_salygu_priemimas",
        ),
        CheckConstraint(
            "atsaukimo_tipas IS NULL OR atsaukimo_tipas IN ('klientas', 'darbuotojas', 'isnuomota')",
            name="chk_atsaukimo_tipas",
        ),
        CheckConstraint("atsaukimo_mokestis IS NULL OR atsaukimo_mokestis >= 0", name="chk_atsaukimo_mokestis"),
        CheckConstraint("atsaukimo_tipas IS NULL OR busena = 'atšaukta'", name="chk_atsaukimo_tipas_busena"),
    )

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
    # Kliento pasirinkta paėmimo valanda (12–18); NULL – svetainėje sukurta rezervacija.
    paemimo_valanda = Column(Integer, nullable=True)
    # Kokią sąlygų versiją ir kada (UTC) klientas priėmė; NULL – ne programėlėje sukurta rezervacija.
    salygu_versija = Column(String(20), nullable=True)
    salygos_priimtos = Column(DateTime, nullable=True)
    # 'klientas' | 'darbuotojas' | 'isnuomota' (paversta užsakymu); NULL – neatšaukta arba sena rezervacija.
    atsaukimo_tipas = Column(String(20), nullable=True)
    atsaukta = Column(DateTime, nullable=True)
    atsaukimo_mokestis = Column(Numeric(10, 2), nullable=True)
