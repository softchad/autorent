from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Index, Integer, String

from app.db.base import Base

HOLD_ACTIVE = "aktyvus"
HOLD_USED = "panaudotas"
HOLD_CANCELLED = "atsauktas"
HOLD_EXPIRED = "pasibaiges"


# Atitinka lentelę Rezervaciju_Laikymai (database/migrations/001_rezervaciju_laikymai.sql).
class Hold(Base):
    __tablename__ = "Rezervaciju_Laikymai"

    laikymo_id = Column(Integer, primary_key=True, index=True)
    kliento_id = Column(Integer, ForeignKey("Klientai.kliento_id"), nullable=False)
    automobilio_id = Column(Integer, ForeignKey("Automobiliai.automobilio_id"), nullable=False)
    pradzia = Column(Date, nullable=False)
    pabaiga = Column(Date, nullable=False)
    # UTC be laiko juostos.
    sukurta = Column(DateTime, nullable=False)
    galioja_iki = Column(DateTime, nullable=False)
    busena = Column(String(20), nullable=False, default=HOLD_ACTIVE)
    rezervacijos_id = Column(Integer, ForeignKey("Rezervavimas.rezervacijos_id"), nullable=True)

    # Tos pačios taisyklės kaip SQL schemoje, kad testinė schema neleistų įrašų, kuriuos MySQL atmestų.
    __table_args__ = (
        CheckConstraint("pabaiga > pradzia", name="chk_laikymo_datos"),
        CheckConstraint("galioja_iki > sukurta", name="chk_laikymo_galiojimas"),
        CheckConstraint(
            f"busena IN ('{HOLD_ACTIVE}', '{HOLD_USED}', '{HOLD_CANCELLED}', '{HOLD_EXPIRED}')",
            name="chk_laikymo_busena",
        ),
        Index("idx_laikymai_automobilis", "automobilio_id", "busena", "galioja_iki"),
        Index("idx_laikymai_klientas", "kliento_id", "busena", "galioja_iki"),
    )
