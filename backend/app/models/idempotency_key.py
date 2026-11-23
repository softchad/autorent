from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint

from app.db.base import Base


# Atitinka lentelę Idempotencijos_Raktai (database/migrations/003_salygos_ir_idempotencija.sql).
class IdempotencyKey(Base):
    __tablename__ = "Idempotencijos_Raktai"

    rakto_id = Column(Integer, primary_key=True)
    kliento_id = Column(Integer, ForeignKey("Klientai.kliento_id"), nullable=False)
    raktas = Column(String(64), nullable=False)
    uzklausos_maisa = Column(String(64), nullable=False)
    rezervacijos_id = Column(
        Integer, ForeignKey("Rezervavimas.rezervacijos_id", ondelete="CASCADE"), nullable=False
    )
    sukurta = Column(DateTime, nullable=False, index=True)

    __table_args__ = (UniqueConstraint("kliento_id", "raktas", name="uq_idempotencijos_raktas"),)
