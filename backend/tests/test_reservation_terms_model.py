# Sąlygų versija ir priėmimo laikas testinėje schemoje pildomi tik kartu, kaip database/schema.sql (chk_salygu_priemimas).
from datetime import date, datetime

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import Base
import app.models  # noqa: F401 - registruoja visus modelius prieš create_all
from app.models import Car, Client, Location, Reservation

ACCEPTED_AT = datetime(2026, 11, 28, 9, 0)


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
        session.add(Client(kliento_id=1, vardas="Test", pavarde="Client", el_pastas="terms@example.com", telefono_nr="+37060000000", gimimo_data=date(1990, 1, 1)))
        session.flush()
        session.add(Car(automobilio_id=1, marke="Test", modelis="Test", metai=2025, numeris="TERM001", vin_kodas="TERM0000000000001", spalva="Test", kebulo_tipas="Test", pavaru_deze="Test", variklio_turis=1, galia_kw=100, kuro_tipas="Test", rida=0, sedimos_vietos=5, kaina_parai=40, automobilio_statusas="laisvas", technikines_galiojimas=date(2030, 1, 1), dabartine_vieta_id=1))
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


@pytest.mark.parametrize(
    "version, accepted_at",
    [(None, None), ("2026-11", ACCEPTED_AT)],
    ids=["abu_tusti", "abu_uzpildyti"],
)
def test_terms_fields_together_are_saved(db, version, accepted_at):
    db.add(_reservation(salygu_versija=version, salygos_priimtos=accepted_at))
    db.commit()
    saved = db.get(Reservation, 1)
    assert (saved.salygu_versija, saved.salygos_priimtos) == (version, accepted_at)


@pytest.mark.parametrize(
    "version, accepted_at",
    [("2026-11", None), (None, ACCEPTED_AT)],
    ids=["tik_versija", "tik_laikas"],
)
def test_terms_field_alone_is_rejected(db, version, accepted_at):
    db.add(_reservation(salygu_versija=version, salygos_priimtos=accepted_at))
    with pytest.raises(IntegrityError, match="chk_salygu_priemimas"):
        db.commit()
    db.rollback()
    assert db.get(Reservation, 1) is None
