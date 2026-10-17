# SQLAlchemy modelis - Python klasė, kuri atitinka "Lojalumo_Atlygiai" DB lentelę; vienas įrašas = VIENAS uždirbtas atlygis už kas 5-ą užbaigtą nuomą (žr. customer_loyalty.py REWARD_MILESTONE_SIZE).
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, UniqueConstraint
from app.db.base import Base


class LoyaltyReward(Base):
    __tablename__ = "Lojalumo_Atlygiai"

    atlygio_id = Column(Integer, primary_key=True, index=True)
    kliento_id = Column(Integer, ForeignKey("Klientai.kliento_id"), nullable=False)
    # Kelintas 5-nuomų etapas (1, 2, 3...) - UNIQUE kartu su kliento_id žemiau, kad TAS PATS klientas negalėtų uždirbti DVIEJŲ atlygių už TĄ PATĮ etapą, net jei skaičiavimas būtų pakartotas.
    etapo_numeris = Column(Integer, nullable=False)
    # Python pusės default, ne server_default - taip nuosekliai su Client.registracijos_data.
    sukurimo_data = Column(TIMESTAMP, default=lambda: datetime.now(timezone.utc))
    busena = Column(String(20), nullable=False, default="neisnaudotas")
    panaudojimo_data = Column(TIMESTAMP, nullable=True)

    # Žr. etapo_numeris komentarą aukščiau - šis apribojimas DB lygmeniu yra paskutinė gynybos linija prieš dubliavimą, net jei Python kodo patikra (žr. _ensure_rewards_up_to_date) kažkodėl nesuveiktų.
    __table_args__ = (UniqueConstraint("kliento_id", "etapo_numeris"),)
