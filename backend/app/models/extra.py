from sqlalchemy import Boolean, CheckConstraint, Column, ForeignKey, Integer, Numeric, String

from app.db.base import Base


# Paslaugų katalogas (lentelė Papildomos_Paslaugos). CHECK vardai sutampa su database/schema.sql.
class Extra(Base):
    __tablename__ = "Papildomos_Paslaugos"
    __table_args__ = (CheckConstraint("kaina_parai >= 0", name="chk_paslaugos_kaina"),)

    paslaugos_id = Column(Integer, primary_key=True, index=True)
    kodas = Column(String(40), unique=True, nullable=False)
    pavadinimas = Column(String(100), nullable=False)
    aprasymas = Column(String(255), nullable=False)
    kaina_parai = Column(Numeric(10, 2), nullable=False)
    aktyvi = Column(Boolean, nullable=False, default=True)


# Rezervacijai pasirinkta paslauga su užfiksuota kaina (lentelė Rezervacijos_Paslaugos).
class ReservationExtra(Base):
    __tablename__ = "Rezervacijos_Paslaugos"
    __table_args__ = (CheckConstraint("kaina_parai >= 0", name="chk_rez_paslaugos_kaina"),)

    rezervacijos_id = Column(
        Integer, ForeignKey("Rezervavimas.rezervacijos_id", ondelete="CASCADE"), primary_key=True
    )
    paslaugos_id = Column(Integer, ForeignKey("Papildomos_Paslaugos.paslaugos_id"), primary_key=True)
    kaina_parai = Column(Numeric(10, 2), nullable=False)
