# Laikymų lentelės apribojimai testinėje schemoje turi sutapti su database/schema.sql.
from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import Base
import app.models  # noqa: F401 - registruoja visus modelius prieš create_all
from app.models import Car, Client, Hold, Location
from app.models.hold import HOLD_ACTIVE

CREATED = datetime(2027, 1, 1, 12, 0)


# Kiekvienam testui nauja atminties bazė su įjungtais išoriniais raktais, todėl vieno atvejo klaida kito nepaveikia.
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
        session.add(Client(kliento_id=1, vardas="Test", pavarde="Client", el_pastas="hold@example.com", telefono_nr="+37060000000", gimimo_data=date(1990, 1, 1)))
        session.flush()
        session.add(Car(automobilio_id=1, marke="Test", modelis="Test", metai=2025, numeris="HOLD001", vin_kodas="HOLD0000000000001", spalva="Test", kebulo_tipas="Test", pavaru_deze="Test", variklio_turis=1, galia_kw=100, kuro_tipas="Test", rida=0, sedimos_vietos=5, kaina_parai=40, automobilio_statusas="laisvas", technikines_galiojimas=date(2030, 1, 1), dabartine_vieta_id=1))
        session.commit()
        yield session
    engine.dispose()


def _hold(**overrides) -> Hold:
    values = dict(
        kliento_id=1, automobilio_id=1, pradzia=date(2027, 2, 1), pabaiga=date(2027, 2, 3),
        sukurta=CREATED, galioja_iki=CREATED + timedelta(minutes=15), busena=HOLD_ACTIVE,
    )
    values.update(overrides)
    return Hold(**values)


def test_valid_hold_is_saved(db):
    db.add(_hold())
    db.commit()
    saved = db.query(Hold).one()
    assert (saved.busena, saved.pradzia, saved.galioja_iki) == (HOLD_ACTIVE, date(2027, 2, 1), CREATED + timedelta(minutes=15))


@pytest.mark.parametrize("busena", ["panaudotas", "atsauktas", "pasibaiges"])
def test_other_allowed_states_are_saved(db, busena):
    db.add(_hold(busena=busena))
    db.commit()
    assert db.query(Hold).one().busena == busena


@pytest.mark.parametrize("overrides", [
    pytest.param({"busena": "bet_kas"}, id="netinkama_busena"),
    pytest.param({"pabaiga": date(2027, 2, 1)}, id="vienodos_datos"),
    pytest.param({"galioja_iki": CREATED}, id="vienodi_laikai"),
])
def test_invalid_hold_is_rejected(db, overrides):
    db.add(_hold(**overrides))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    assert db.query(Hold).count() == 0
