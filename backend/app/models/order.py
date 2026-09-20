# SQLAlchemy modelis - Python klasė, kuri atitinka "Uzsakymai" DB lentelę (žr. database/schema.sql); REALUS, patvirtintas automobilio nuomojimas (ne išankstinė rezervacija, tai yra reservation.py).
from sqlalchemy import Column, Integer, Date, String, Boolean, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from app.db.base import Base

class Order(Base):
    __tablename__ = "uzsakymai"

    uzsakymo_id = Column(Integer, primary_key=True, index=True)
    # "nullable=False" VISUR žemiau - schema.sql reikalauja KIEKVIENO šio lauko (NOT NULL), tad modelis turi atkartoti TĄ PAČIĄ taisyklę, kitaip SQLite testai tyliai leistų tai, kas tikroje MySQL DB lūžtų.
    kliento_id = Column(Integer, ForeignKey("klientai.kliento_id"), nullable=False)
    automobilio_id = Column(Integer, ForeignKey("Automobiliai.automobilio_id"), nullable=False)
    darbuotojo_id = Column(Integer, ForeignKey("darbuotojai.darbuotojo_id"), nullable=False)
    nuomos_data = Column(Date, nullable=False)
    grazinimo_data = Column(Date, nullable=False)
    paemimo_vietos_id = Column(Integer, nullable=False)
    grazinimo_vietos_id = Column(Integer, nullable=False)
    # Numeric, ne Float - pinigų sumoms dvejetainis slankusis kablelis rizikuoja apvalinimo nuokrypiu bet kokiame Python pusės sumavime/palyginime, nors DB kolona (DECIMAL(10,2)) pati yra tiksli.
    bendra_kaina = Column(Numeric(10, 2), nullable=False)
    uzsakymo_busena = Column(String(50), nullable=False)
    turi_papildomas_paslaugas = Column(Boolean, nullable=False, default=False)

    # Santykiai - leidžia Python kode rašyti "order.saskaita"/"order.klientas", vietoj atskirų užklausų pagal ID.
    saskaita = relationship("Invoice", back_populates="uzsakymas", uselist=False)
    klientas = relationship("Client", back_populates="uzsakymai")
