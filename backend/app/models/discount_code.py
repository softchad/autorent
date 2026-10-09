# SQLAlchemy modelis - atitinka "Nuolaidos_Kodai" DB lentelę; vienas įrašas = VIENAS nuolaidos kodas, išduotas konkrečiam klientui - arba automatiškai per lojalumo programą ("lojalumas"), arba darbuotojo ranka, sprendžiant aptarnavimo problemą ("aptarnavimas").
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Numeric, TIMESTAMP, ForeignKey
from app.db.base import Base


class DiscountCode(Base):
    __tablename__ = "nuolaidos_kodai"

    kodo_id = Column(Integer, primary_key=True, index=True)
    # "AUTORENT" + 6 skaitmenys (žr. generate_unique_code servisų faile) - unique, kad DU kodai niekada negalėtų sutapti.
    kodas = Column(String(20), unique=True, nullable=False, index=True)
    kliento_id = Column(Integer, ForeignKey("klientai.kliento_id"), nullable=False)
    verte_eur = Column(Numeric(10, 2), nullable=False)
    # "lojalumas" (automatiškai per /customer/loyalty/rewards/{id}/redeem) arba "aptarnavimas" (darbuotojo ranka sukurtas, žr. staff_support.py).
    kilme = Column(String(20), nullable=False)
    # Laisvas tekstas - KODĖL kodas išduotas (pvz. "5 nuomų lojalumo atlygis" arba darbuotojo įvesta aptarnavimo problemos priežastis).
    pastaba = Column(String(255), nullable=True)
    sukurimo_data = Column(TIMESTAMP, default=lambda: datetime.now(timezone.utc))
    panaudojimo_data = Column(TIMESTAMP, nullable=True)
