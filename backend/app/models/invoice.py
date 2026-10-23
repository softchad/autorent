# SQLAlchemy modelis - Python klasė, kuri atitinka "Saskaitos" DB lentelę (žr. database/schema.sql).
from sqlalchemy import Column, Integer, Numeric, Date, ForeignKey, String
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.order import Order

class Invoice(Base):
    __tablename__ = "Saskaitos"

    saskaitos_id = Column(Integer, primary_key=True, index=True)
    # "nullable=False, unique=True" - schema.sql reikalauja ABIEJŲ (sąskaita VISADA susieta su VIENU užsakymu, IR tas ryšys 1:1, ne 1:N), tad modelis turi atkartoti TĄ PAČIĄ taisyklę, kitaip SQLite testai tyliai leistų tai, kas tikroje MySQL DB lūžtų .
    uzsakymo_id = Column(Integer, ForeignKey("Uzsakymai.uzsakymo_id"), nullable=False, unique=True)
    # Numeric (tiksli dešimtainė aritmetika), ne Float (apytikslis) - pinigų sumoms Float gali netiksliai apvalinti (pvz. 0.1 + 0.2 != 0.3), o pinigams tai nepriimtina.
    suma = Column(Numeric(10, 2), nullable=False)
    saskaitos_data = Column(Date, nullable=False)
    # Gavėjo vardas ir pavardė priklauso išrašytam dokumentui, todėl vėlesni profilio pakeitimai jų nekeičia.
    gavejo_vardas = Column(String(255), nullable=True)
    gavejo_pavarde = Column(String(255), nullable=True)

    # Leidžia Python kode rašyti "invoice.uzsakymas" (susietas užsakymas), vietoj atskiros užklausos pagal uzsakymo_id.
    uzsakymas = relationship(Order, back_populates="saskaita")
