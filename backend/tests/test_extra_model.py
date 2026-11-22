# Papildomų paslaugų ir paėmimo valandos apribojimai testinėje schemoje turi sutapti su database/schema.sql.
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import Base
import app.models  # noqa: F401 - registruoja visus modelius prieš create_all
from app.models import Car, Client, Extra, Location, Reservation, ReservationExtra


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
        session.add(Client(kliento_id=1, vardas="Test", pavarde="Client", el_pastas="extra@example.com", telefono_nr="+37060000000", gimimo_data=date(1990, 1, 1)))
        session.flush()
        session.add(Car(automobilio_id=1, marke="Test", modelis="Test", metai=2025, numeris="EXTR001", vin_kodas="EXTR0000000000001", spalva="Test", kebulo_tipas="Test", pavaru_deze="Test", variklio_turis=1, galia_kw=100, kuro_tipas="Test", rida=0, sedimos_vietos=5, kaina_parai=40, automobilio_statusas="laisvas", technikines_galiojimas=date(2030, 1, 1), dabartine_vieta_id=1))
        session.flush()
        session.add(_reservation(rezervacijos_id=1))
        session.add(_extra(paslaugos_id=1, kodas="esama"))
        session.commit()
        yield session
    engine.dispose()


def _reservation(**overrides) -> Reservation:
    values = dict(
        kliento_id=1, automobilio_id=1, rezervacijos_pradzia=date(2027, 2, 1), rezervacijos_pabaiga=date(2027, 2, 3),
        busena="laukia",
    )
    values.update(overrides)
    return Reservation(**values)


def _extra(**overrides) -> Extra:
    values = dict(kodas="nauja", pavadinimas="Test", aprasymas="Test", kaina_parai=Decimal("4.00"), aktyvi=True)
    values.update(overrides)
    return Extra(**values)


def _assert_check_rejects(db, row, constraint: str):
    db.add(row)
    with pytest.raises(IntegrityError, match=constraint):
        db.commit()
    db.rollback()


def test_zero_prices_are_accepted(db):
    db.add(_extra(kaina_parai=Decimal("0.00")))
    db.add(ReservationExtra(rezervacijos_id=1, paslaugos_id=1, kaina_parai=Decimal("0.00")))
    db.commit()
    assert db.query(Extra).filter_by(kodas="nauja").one().kaina_parai == Decimal("0.00")
    assert db.query(ReservationExtra).one().kaina_parai == Decimal("0.00")


def test_negative_catalog_price_is_rejected(db):
    _assert_check_rejects(db, _extra(kaina_parai=Decimal("-0.01")), "chk_paslaugos_kaina")
    assert db.query(Extra).filter_by(kodas="nauja").count() == 0


def test_negative_reservation_extra_price_is_rejected(db):
    _assert_check_rejects(db, ReservationExtra(rezervacijos_id=1, paslaugos_id=1, kaina_parai=Decimal("-0.01")), "chk_rez_paslaugos_kaina")
    assert db.query(ReservationExtra).count() == 0


@pytest.mark.parametrize("hour", [12, 18, None])
def test_allowed_pickup_hours_are_saved(db, hour):
    db.add(_reservation(rezervacijos_id=2, paemimo_valanda=hour))
    db.commit()
    assert db.get(Reservation, 2).paemimo_valanda == hour


@pytest.mark.parametrize("hour", [11, 19])
def test_pickup_hour_outside_range_is_rejected(db, hour):
    _assert_check_rejects(db, _reservation(rezervacijos_id=2, paemimo_valanda=hour), "chk_paemimo_valanda")
    assert db.get(Reservation, 2) is None
