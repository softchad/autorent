from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
import app.models  # noqa: F401 - registruoja visus modelius prieš create_all
from app.models.hold import HOLD_ACTIVE, HOLD_CANCELLED, HOLD_EXPIRED, Hold
from app.models.reservation import Reservation
from app.services import hold_service
from app.services.hold_service import HoldError
from tests.helpers import db_car, db_client, freeze_time

NOW = datetime(2026, 11, 24, 10, 0, tzinfo=timezone.utc)
FROM, TO = date(2026, 12, 1), date(2026, 12, 5)


# Kiekvienam testui nauja atminties bazė su įjungtais išoriniais raktais. Bendra modulio sesija netinka,
# nes create_hold po klaidos daro rollback, kuris atšauktų bendrą modulio transakciją.
@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", poolclass=StaticPool, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _foreign_keys(dbapi_connection, _):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    session = Session(engine)
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture(autouse=True)
def fixed_now(monkeypatch):
    freeze_time(monkeypatch, NOW)


def _later(monkeypatch, minutes):
    freeze_time(monkeypatch, NOW + timedelta(minutes=minutes))


def test_hold_is_created_for_ten_minutes(db_session):
    customer, car = db_client(db_session), db_car(db_session)

    hold = hold_service.create_hold(db_session, customer, car.automobilio_id, FROM, TO)

    assert hold.busena == HOLD_ACTIVE
    assert hold.galioja_iki - hold.sukurta == timedelta(minutes=hold_service.HOLD_MINUTES)
    assert hold.kliento_id == customer.kliento_id


def test_other_customer_cannot_hold_same_car_for_overlapping_dates(db_session):
    first, second, car = db_client(db_session), db_client(db_session), db_car(db_session)
    hold_service.create_hold(db_session, first, car.automobilio_id, FROM, TO)

    with pytest.raises(HoldError) as error:
        hold_service.create_hold(db_session, second, car.automobilio_id, date(2026, 12, 4), date(2026, 12, 8))

    assert (error.value.status, error.value.code) == (409, "laikoma")


def test_adjacent_period_is_not_a_conflict(db_session):
    first, second, car = db_client(db_session), db_client(db_session), db_car(db_session)
    hold_service.create_hold(db_session, first, car.automobilio_id, FROM, TO)

    hold = hold_service.create_hold(db_session, second, car.automobilio_id, TO, date(2026, 12, 8))

    assert hold.busena == HOLD_ACTIVE


def test_expired_hold_no_longer_blocks(db_session, monkeypatch):
    first, second, car = db_client(db_session), db_client(db_session), db_car(db_session)
    old = hold_service.create_hold(db_session, first, car.automobilio_id, FROM, TO)

    _later(monkeypatch, hold_service.HOLD_MINUTES + 1)
    new = hold_service.create_hold(db_session, second, car.automobilio_id, FROM, TO)

    db_session.refresh(old)
    assert old.busena == HOLD_EXPIRED
    assert new.kliento_id == second.kliento_id


def test_hold_still_blocks_one_second_before_expiry(db_session, monkeypatch):
    first, second, car = db_client(db_session), db_client(db_session), db_car(db_session)
    hold_service.create_hold(db_session, first, car.automobilio_id, FROM, TO)

    freeze_time(monkeypatch, NOW + timedelta(minutes=hold_service.HOLD_MINUTES, seconds=-1))
    with pytest.raises(HoldError):
        hold_service.create_hold(db_session, second, car.automobilio_id, FROM, TO)


def test_repeated_request_returns_same_hold_without_extending(db_session, monkeypatch):
    customer, car = db_client(db_session), db_car(db_session)
    first = hold_service.create_hold(db_session, customer, car.automobilio_id, FROM, TO)

    _later(monkeypatch, 5)
    second = hold_service.create_hold(db_session, customer, car.automobilio_id, FROM, TO)

    assert second.laikymo_id == first.laikymo_id
    assert second.galioja_iki == (NOW + timedelta(minutes=hold_service.HOLD_MINUTES)).replace(tzinfo=None)


def test_new_dates_for_same_car_replace_previous_hold(db_session):
    customer, car = db_client(db_session), db_car(db_session)
    old = hold_service.create_hold(db_session, customer, car.automobilio_id, FROM, TO)

    new = hold_service.create_hold(db_session, customer, car.automobilio_id, date(2026, 12, 10), date(2026, 12, 12))

    db_session.refresh(old)
    assert old.busena == HOLD_CANCELLED
    assert new.busena == HOLD_ACTIVE


def test_failed_replacement_keeps_previous_hold(db_session):
    customer, other, car = db_client(db_session), db_client(db_session), db_car(db_session)
    previous_id = hold_service.create_hold(db_session, customer, car.automobilio_id, FROM, TO).laikymo_id
    new_from, new_to = date(2026, 12, 10), date(2026, 12, 12)
    hold_service.create_hold(db_session, other, car.automobilio_id, new_from, new_to)

    with pytest.raises(HoldError) as error:
        hold_service.create_hold(db_session, customer, car.automobilio_id, new_from, new_to)
    assert error.value.code == "laikoma"

    # Vėlesnis kvietėjo commit negali įrašyti nepavykusio pakeitimo dalies.
    db_session.commit()
    with Session(db_session.get_bind()) as fresh:
        assert fresh.get(Hold, previous_id).busena == HOLD_ACTIVE
        assert fresh.query(Hold).filter_by(kliento_id=customer.kliento_id).count() == 1


def test_customer_cannot_exceed_active_hold_limit(db_session):
    customer = db_client(db_session)
    for index in range(hold_service.MAX_ACTIVE_HOLDS_PER_CUSTOMER):
        start = date(2026, 12, 1) + timedelta(days=10 * index)
        hold_service.create_hold(db_session, customer, db_car(db_session).automobilio_id, start, start + timedelta(days=2))

    with pytest.raises(HoldError) as error:
        hold_service.create_hold(db_session, customer, db_car(db_session).automobilio_id, date(2027, 1, 10), date(2027, 1, 12))

    assert (error.value.status, error.value.code) == (429, "limitas")


def test_limit_frees_up_after_expiry(db_session, monkeypatch):
    customer = db_client(db_session)
    for index in range(hold_service.MAX_ACTIVE_HOLDS_PER_CUSTOMER):
        start = date(2026, 12, 1) + timedelta(days=10 * index)
        hold_service.create_hold(db_session, customer, db_car(db_session).automobilio_id, start, start + timedelta(days=2))

    _later(monkeypatch, hold_service.HOLD_MINUTES + 1)
    hold = hold_service.create_hold(db_session, customer, db_car(db_session).automobilio_id, date(2027, 1, 10), date(2027, 1, 12))

    assert hold.busena == HOLD_ACTIVE


def test_same_car_cannot_be_held_endlessly(db_session, monkeypatch):
    customer, car = db_client(db_session), db_car(db_session)
    for attempt in range(hold_service.MAX_HOLDS_PER_CAR_PER_HOUR):
        _later(monkeypatch, attempt * (hold_service.HOLD_MINUTES + 1))
        hold_service.create_hold(db_session, customer, car.automobilio_id, FROM, TO)

    _later(monkeypatch, hold_service.MAX_HOLDS_PER_CAR_PER_HOUR * (hold_service.HOLD_MINUTES + 1))
    with pytest.raises(HoldError) as error:
        hold_service.create_hold(db_session, customer, car.automobilio_id, FROM, TO)

    assert (error.value.status, error.value.code) == (429, "per_daznai")


def test_existing_reservation_blocks_hold(db_session):
    owner, customer, car = db_client(db_session), db_client(db_session), db_car(db_session)
    db_session.add(Reservation(
        kliento_id=owner.kliento_id, automobilio_id=car.automobilio_id,
        rezervacijos_pradzia=FROM, rezervacijos_pabaiga=TO, busena="laukia", kaina_parai=50,
    ))
    db_session.commit()

    with pytest.raises(HoldError) as error:
        hold_service.create_hold(db_session, customer, car.automobilio_id, FROM, TO)

    assert (error.value.status, error.value.code) == (409, "uzimta")


def test_car_in_service_cannot_be_held(db_session):
    customer, car = db_client(db_session), db_car(db_session, automobilio_statusas="servise")
    with pytest.raises(HoldError) as error:
        hold_service.create_hold(db_session, customer, car.automobilio_id, FROM, TO)
    assert error.value.status == 409


@pytest.mark.parametrize(
    "date_from, date_to, code",
    [
        (date(2026, 11, 20), date(2026, 11, 26), "praeitis"),
        (FROM, FROM, "per_trumpa"),
        (FROM, FROM + timedelta(days=31), "per_ilga"),
    ],
)
def test_invalid_period_is_rejected(db_session, date_from, date_to, code):
    customer, car = db_client(db_session), db_car(db_session)
    with pytest.raises(HoldError) as error:
        hold_service.create_hold(db_session, customer, car.automobilio_id, date_from, date_to)
    assert (error.value.status, error.value.code) == (400, code)


def test_unknown_car(db_session):
    with pytest.raises(HoldError) as error:
        hold_service.create_hold(db_session, db_client(db_session), 999999, FROM, TO)
    assert error.value.status == 404


def test_hold_is_visible_only_to_its_owner(db_session):
    owner, stranger, car = db_client(db_session), db_client(db_session), db_car(db_session)
    hold = hold_service.create_hold(db_session, owner, car.automobilio_id, FROM, TO)

    assert hold_service.get_hold_for_customer(db_session, hold.laikymo_id, owner.kliento_id) is not None
    assert hold_service.get_hold_for_customer(db_session, hold.laikymo_id, stranger.kliento_id) is None


def test_released_hold_frees_the_car(db_session):
    first, second, car = db_client(db_session), db_client(db_session), db_car(db_session)
    hold = hold_service.create_hold(db_session, first, car.automobilio_id, FROM, TO)

    hold_service.release_hold(db_session, hold)

    assert db_session.get(Hold, hold.laikymo_id).busena == HOLD_CANCELLED
    assert hold_service.create_hold(db_session, second, car.automobilio_id, FROM, TO).busena == HOLD_ACTIVE
