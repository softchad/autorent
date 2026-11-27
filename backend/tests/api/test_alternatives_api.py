from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.db.base import Base
from app.main import app
from app.models.employee import Employee
from app.models.hold import Hold
from app.models.order import Order
from app.models.reservation import Reservation
from tests.helpers import API, db_car, db_client, ensure_location, freeze_time

NOW = datetime(2026, 12, 1, 9, tzinfo=timezone.utc)
START, END = date(2026, 12, 10), date(2026, 12, 13)


@pytest.fixture
def db_session(monkeypatch):
    freeze_time(monkeypatch, NOW)
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


@pytest.fixture
def client(db_session):
    def override_db():
        yield db_session

    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app) as http:
            yield http
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


def get_alternatives(client, car_id, start=START, end=END, status=200):
    response = client.get(
        f"{API}/public/cars/{car_id}/alternatives",
        params={"date_from": str(start), "date_to": str(end)},
    )
    assert response.status_code == status, response.text
    return response.json()


def reserve(db, car_id, start=START, end=END, status="patvirtinta"):
    customer = db_client(db)
    db.add(Reservation(
        kliento_id=customer.kliento_id, automobilio_id=car_id,
        rezervacijos_pradzia=start, rezervacijos_pabaiga=end, busena=status,
    ))
    db.commit()


def test_public_response_uses_safe_car_fields_and_reasons(client, db_session):
    reference = db_car(db_session)
    candidate = db_car(db_session)
    body = get_alternatives(client, reference.automobilio_id)
    assert body["laisvas"] is True
    assert body["artimiausias_laikotarpis"] == {"date_from": str(START), "date_to": str(END)}
    assert len(body["panasus_automobiliai"]) == 1
    match = body["panasus_automobiliai"][0]
    assert match["balas"] == 6
    assert match["priezastys"] == ["kebulo_tipas", "pavaru_deze", "sedimos_vietos"]
    assert match["automobilis"]["automobilio_id"] == candidate.automobilio_id
    assert match["automobilis"]["laisvas_pasirinktu_laikotarpiu"] is True
    assert match["automobilis"]["lokacija"]["vietos_id"] == 1
    assert {"numeris", "vin_kodas", "pastabos", "kliento_id"}.isdisjoint(match["automobilis"])


def test_busy_reference_has_nearest_period_and_available_candidate(client, db_session):
    reference = db_car(db_session)
    candidate = db_car(db_session)
    reserve(db_session, reference.automobilio_id)
    body = get_alternatives(client, reference.automobilio_id)
    assert body["laisvas"] is False
    assert body["artimiausias_laikotarpis"] == {"date_from": "2026-12-13", "date_to": "2026-12-16"}
    assert [item["automobilis"]["automobilio_id"] for item in body["panasus_automobiliai"]] == [candidate.automobilio_id]


def test_filters_before_ranking_and_returns_at_most_three(client, db_session):
    reference = db_car(db_session)
    blocked = db_car(db_session)
    reserve(db_session, blocked.automobilio_id)
    db_car(db_session, automobilio_statusas="servise")
    db_car(db_session, automobilio_statusas="remonte")
    ensure_location(db_session, 2)
    db_car(db_session, dabartine_vieta_id=2)
    low_score = db_car(db_session, pavaru_deze="mechaninė", sedimos_vietos=4)
    best = [db_car(db_session) for _ in range(4)]
    body = get_alternatives(client, reference.automobilio_id)
    ids = [item["automobilis"]["automobilio_id"] for item in body["panasus_automobiliai"]]
    assert ids == [item.automobilio_id for item in best[:3]]
    assert low_score.automobilio_id not in ids


@pytest.mark.parametrize("status", ["servise", "remonte"])
def test_unbookable_reference_has_no_alternative_period(client, db_session, status):
    reference = db_car(db_session, automobilio_statusas=status)
    candidate = db_car(db_session)
    body = get_alternatives(client, reference.automobilio_id)
    assert body["laisvas"] is False
    assert body["artimiausias_laikotarpis"] is None
    assert body["panasus_automobiliai"][0]["automobilis"]["automobilio_id"] == candidate.automobilio_id


@pytest.mark.parametrize("active", [True, False])
def test_holds_affect_reference_and_candidates_only_until_expiry(client, db_session, active):
    reference, candidate = db_car(db_session), db_car(db_session)
    customer = db_client(db_session)
    for car in (reference, candidate):
        db_session.add(Hold(
            kliento_id=customer.kliento_id, automobilio_id=car.automobilio_id,
            pradzia=START, pabaiga=END, sukurta=NOW.replace(tzinfo=None) - timedelta(minutes=20),
            galioja_iki=NOW.replace(tzinfo=None) + timedelta(minutes=1 if active else 0),
            busena="aktyvus",
        ))
    db_session.commit()
    body = get_alternatives(client, reference.automobilio_id)
    assert body["laisvas"] is not active
    assert bool(body["panasus_automobiliai"]) is not active
    expected_start = "2026-12-13" if active else str(START)
    assert body["artimiausias_laikotarpis"]["date_from"] == expected_start


def test_adjacent_and_cancelled_reservations_do_not_block(client, db_session):
    reference, candidate = db_car(db_session), db_car(db_session)
    for car in (reference, candidate):
        reserve(db_session, car.automobilio_id, START - timedelta(days=2), START)
        reserve(db_session, car.automobilio_id, END, END + timedelta(days=2))
        reserve(db_session, car.automobilio_id, status="atšaukta")
    body = get_alternatives(client, reference.automobilio_id)
    assert body["laisvas"] is True
    assert body["artimiausias_laikotarpis"]["date_from"] == str(START)
    assert len(body["panasus_automobiliai"]) == 1


@pytest.mark.parametrize("status,blocked", [
    ("laukiama", True), ("patvirtinta", True), ("vykdoma", True),
    ("užbaigta", False), ("atšaukta", False),
])
def test_single_day_orders_use_shared_busy_rules(client, db_session, status, blocked):
    reference, candidate = db_car(db_session), db_car(db_session)
    customer = db_client(db_session)
    employee = Employee(
        vardas="Test", pavarde="Test", el_pastas="staff@example.com", telefono_nr="+37060000000",
        pareigos="Vadybininkas", atlyginimas=1000, isidarbinimo_data=date(2020, 1, 1),
    )
    db_session.add(employee)
    db_session.flush()
    for car in (reference, candidate):
        db_session.add(Order(
            kliento_id=customer.kliento_id, automobilio_id=car.automobilio_id,
            darbuotojo_id=employee.darbuotojo_id, nuomos_data=START, grazinimo_data=START,
            paemimo_vietos_id=1, grazinimo_vietos_id=1, bendra_kaina=50, uzsakymo_busena=status,
        ))
    db_session.commit()
    body = get_alternatives(client, reference.automobilio_id)
    assert body["laisvas"] is not blocked
    assert bool(body["panasus_automobiliai"]) is not blocked
    assert body["artimiausias_laikotarpis"]["date_from"] == ("2026-12-11" if blocked else str(START))


def test_no_alternatives_returns_null_period_and_empty_list(client, db_session):
    reference = db_car(db_session)
    reserve(db_session, reference.automobilio_id, date(2026, 12, 1), date(2027, 1, 1))
    body = get_alternatives(client, reference.automobilio_id)
    assert body["artimiausias_laikotarpis"] is None
    assert body["panasus_automobiliai"] == []


@pytest.mark.parametrize("start,end,status", [
    ("2026-11-30", "2026-12-03", 400),
    ("2026-12-10", "2026-12-10", 400),
    ("2026-12-11", "2026-12-10", 400),
    ("2026-12-01", "2027-01-01", 400),
    ("invalid", "2026-12-13", 422),
])
def test_rejects_invalid_dates_before_car_lookup(client, start, end, status):
    get_alternatives(client, 999999, start, end, status)


def test_missing_car_returns_404(client):
    get_alternatives(client, 999999, status=404)


def test_requires_both_dates(client):
    response = client.get(f"{API}/public/cars/1/alternatives", params={"date_from": str(START)})
    assert response.status_code == 422, response.text


def test_dates_at_python_upper_boundary_do_not_overflow(client, db_session):
    reference = db_car(db_session)
    start, end = date(9999, 12, 30), date(9999, 12, 31)
    reserve(db_session, reference.automobilio_id, date(9999, 12, 1), end)
    body = get_alternatives(client, reference.automobilio_id, start, end)
    assert body["artimiausias_laikotarpis"] is None
