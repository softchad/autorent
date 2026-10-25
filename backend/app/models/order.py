# SQLAlchemy modelis - Python klasė, kuri atitinka "Uzsakymai" DB lentelę (žr. database/schema.sql); REALUS, patvirtintas automobilio nuomojimas (ne išankstinė rezervacija, tai yra reservation.py).
from sqlalchemy import Column, Integer, Date, String, Boolean, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from app.db.base import Base

class Order(Base):
    __tablename__ = "Uzsakymai"

    uzsakymo_id = Column(Integer, primary_key=True, index=True)
    # "nullable=False" VISUR žemiau - schema.sql reikalauja KIEKVIENO šio lauko (NOT NULL), tad modelis turi atkartoti TĄ PAČIĄ taisyklę, kitaip SQLite testai tyliai leistų tai, kas tikroje MySQL DB lūžtų.
    kliento_id = Column(Integer, ForeignKey("Klientai.kliento_id"), nullable=False)
    automobilio_id = Column(Integer, ForeignKey("Automobiliai.automobilio_id"), nullable=False)
    darbuotojo_id = Column(Integer, ForeignKey("Darbuotojai.darbuotojo_id"), nullable=False)
    nuomos_data = Column(Date, nullable=False)
    grazinimo_data = Column(Date, nullable=False)
    paemimo_vietos_id = Column(Integer, nullable=False)
    grazinimo_vietos_id = Column(Integer, nullable=False)
    # Numeric, ne Float - pinigų sumoms dvejetainis slankusis kablelis rizikuoja apvalinimo nuokrypiu bet kokiame Python pusės sumavime/palyginime, nors DB kolona (DECIMAL(10,2)) pati yra tiksli.
    bendra_kaina = Column(Numeric(10, 2), nullable=False)
    uzsakymo_busena = Column(String(50), nullable=False)
    turi_papildomas_paslaugas = Column(Boolean, nullable=False, default=False)
    # FIKSUOTA (ne procentinė) nuolaidos kodo sumą, PRITAIKYTĄ sukūrimo metu - NEKINTA per visą užsakymo gyvavimą, net kai trukmė VĖLIAU pratęsiama/sutrumpinama (žr. update_order), kad pratęsimas NEpaverstų fiksuoto €X kodo PROCENTINE nuolaida (žr.  pavyzdį). "nullable=False, default=0" - užsakymas BE kodo tiesiog turi 0, ne NULL, kad aritmetika (bendra_kaina + taikyta_nuolaida_eur) žemiau visada veiktų be papildomo None patikrinimo.
    taikyta_nuolaida_eur = Column(Numeric(10, 2), nullable=False, default=0)
    # Užsakymo bazinis paros įkainis išsaugomas prieš nuolaidą, kad net nulinės galutinės sumos nuomą būtų galima teisingai pratęsti.
    bazine_kaina_parai = Column(Numeric(18, 8), nullable=True)

    # Santykiai - leidžia Python kode rašyti "order.saskaita"/"order.klientas", vietoj atskirų užklausų pagal ID.
    saskaita = relationship("Invoice", back_populates="uzsakymas", uselist=False)
    klientas = relationship("Client", back_populates="uzsakymai")
