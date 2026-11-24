# Atšaukimo laukų apribojimai testinėje schemoje tokie patys kaip database/schema.sql
# (chk_atsaukimo_tipas, chk_atsaukimo_mokestis, chk_atsaukimo_tipas_busena).
from datetime import date, datetime
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import Base
import app.models  # noqa: F401 - registruoja visus modelius prieš create_all
from app.models import Car, Client, Location, Reservation

CANCELLED_AT = datetime(2026, 11, 28, 9, 0)


# Kiekvienam testui nauja atminties bazė su įjungtais išoriniais raktais ir visais susietais įrašais,
# todėl neigiamas atvejis gali kristi tik dėl tikrinamo CHECK, ne dėl FK ar trūkstamų duomenų.
@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def _foreign_keys(dbapi_connection, _):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Location(vietos_id=1, pavadinimas="Test", adresas="Test 1", miestas="Vilnius"))
        session.add(Client(kliento_id=1, vardas="Test", pavarde="Client", el_pastas="cancel@example.com", telefono_nr="+37060000000", gimimo_data=date(1990, 1, 1)))
        session.flush()
        session.add(Car(automobilio_id=1, marke="Test", modelis="Test", metai=2025, numeris="CANC001", vin_kodas="CANC0000000000001", spalva="Test", kebulo_tipas="Test", pavaru_deze="Test", variklio_turis=1, galia_kw=100, kuro_tipas="Test", rida=0, sedimos_vietos=5, kaina_parai=40, automobilio_statusas="laisvas", technikines_galiojimas=date(2030, 1, 1), dabartine_vieta_id=1))
        session.commit()
        yield session
    engine.dispose()


def _reservation(**overrides) -> Reservation:
    values = dict(
        rezervacijos_id=1, kliento_id=1, automobilio_id=1, rezervacijos_pradzia=date(2027, 2, 1),
        rezervacijos_pabaiga=date(2027, 2, 3), busena="laukia",
    )
    values.update(overrides)
    return Reservation(**values)


def test_cancellation_fields_empty_are_saved(db):
    db.add(_reservation())
    db.commit()
    saved = db.get(Reservation, 1)
    assert (saved.atsaukimo_tipas, saved.atsaukta, saved.atsaukimo_mokestis) == (None, None, None)


@pytest.mark.parametrize(
    "kind, fee",
    [("klientas", Decimal("0.00")), ("darbuotojas", Decimal("0.00")), ("isnuomota", Decimal("0.00")), ("klientas", Decimal("25.50"))],
    ids=["klientas_nemokamai", "darbuotojas", "isnuomota", "klientas_su_mokesciu"],
)
def test_cancellation_of_cancelled_reservation_is_saved(db, kind, fee):
    db.add(_reservation(busena="atšaukta", atsaukimo_tipas=kind, atsaukta=CANCELLED_AT, atsaukimo_mokestis=fee))
    db.commit()
    saved = db.get(Reservation, 1)
    assert (saved.atsaukimo_tipas, saved.atsaukta, saved.atsaukimo_mokestis) == (kind, CANCELLED_AT, fee)


@pytest.mark.parametrize(
    "overrides, constraint",
    [
        (dict(busena="atšaukta", atsaukimo_tipas="nezinomas"), "chk_atsaukimo_tipas"),
        (dict(busena="atšaukta", atsaukimo_tipas="klientas", atsaukimo_mokestis=Decimal("-0.01")), "chk_atsaukimo_mokestis"),
        (dict(busena="laukia", atsaukimo_tipas="klientas"), "chk_atsaukimo_tipas_busena"),
    ],
    ids=["nezinomas_tipas", "neigiamas_mokestis", "tipas_neatsauktai"],
)
def test_invalid_cancellation_is_rejected(db, overrides, constraint):
    db.add(_reservation(**overrides))
    with pytest.raises(IntegrityError, match=rf"CHECK constraint failed: {constraint}\b"):
        db.commit()
    db.rollback()
    assert db.get(Reservation, 1) is None
