from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, UniqueConstraint
from app.db.base import Base


class LoyaltyReward(Base):
    __tablename__ = "lojalumo_atlygiai"

    atlygio_id = Column(Integer, primary_key=True, index=True)
    kliento_id = Column(Integer, ForeignKey("klientai.kliento_id"), nullable=False)
    etapo_numeris = Column(Integer, nullable=False)
    # Python pusės default, ne server_default - taip nuosekliai su Client.registracijos_data.
    sukurimo_data = Column(TIMESTAMP, default=lambda: datetime.now(timezone.utc))
    busena = Column(String(20), nullable=False, default="neisnaudotas")
    panaudojimo_data = Column(TIMESTAMP, nullable=True)

    __table_args__ = (UniqueConstraint("kliento_id", "etapo_numeris"),)
