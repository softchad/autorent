# SQLAlchemy modelis - Python klasė, kuri atitinka "Klientai" DB lentelę (žr. database/schema.sql).
from sqlalchemy import Column, Integer, String, Date, DateTime
from app.db.base import Base
from sqlalchemy.orm import relationship
from datetime import datetime

class Client(Base):
    __tablename__ = "Klientai"

    kliento_id = Column(Integer, primary_key=True, index=True)
    # "nullable=False" - schema.sql reikalauja šių 4 laukų (NOT NULL), tad modelis turi atkartoti TĄ PAČIĄ taisyklę, kitaip SQLite testai tyliai leistų tai, kas tikroje MySQL DB lūžtų.
    vardas = Column(String(50), nullable=False)
    pavarde = Column(String(50), nullable=False)
    el_pastas = Column(String(100), unique=True, index=True, nullable=False)
    telefono_nr = Column(String(20), nullable=False)
    gimimo_data = Column(Date, nullable=False)
    registracijos_data = Column(DateTime, default=datetime.utcnow)
    # slaptazodis GALI būti NULL - klientas, kurį sukūrė darbuotojas arba kuris jungiasi tik per Google, savo slaptažodžio neturi (žr. customer_auth.py).
    slaptazodis = Column(String(255), nullable=True)
    # Kliento token_version įtraukiama į auth_service.py išduodamo JWT ver lauką; padidinus versiją, deps.py get_current_customer atmeta turimus senesnės versijos bilietus.
    token_version = Column(Integer, nullable=False, default=0)

    # Leidžia Python kode rašyti "client.uzsakymai" (visi šio kliento užsakymai), vietoj atskiros užklausos per order_repo.get_by_client_id.
    uzsakymai = relationship("Order", back_populates="klientas")
