import re
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
import app.models  # noqa: F401 - registruoja visus modelius prieš create_all
from app.models.car import Car
from app.models.client import Client
from app.models.extra import Extra, ReservationExtra
from app.models.hold import Hold
from app.models.idempotency_key import IdempotencyKey
from app.models.reservation import Reservation
from app.services import hold_service, rental_terms, reservation_service
from tests.helpers import API, ensure_extras, ensure_location, freeze_time, make_car, register_customer

NOW = datetime(2026, 11, 29, 9, 0, tzinfo=timezone.utc)
PERIOD = {"date_from": "2026-12-01", "date_to": "2026-12-05"}


# Atskira šio modulio atminties bazė: create_hold ir confirm_hold daro rollback, kuris bendroje conftest sesijoje
# atšauktų visą modulio transakciją kartu su darbuotojo paskyra. Modulio scope suderintas su client ir auth_headers.
@pytest.fixture(scope="module")
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
def setup(db_session, monkeypatch):
    ensure_location(db_session, 1)
    ensure_extras(db_session)
    freeze_time(monkeypatch, NOW)


def _hold(client, customer, car_id):
    resp = client.post(f"{API}/customer/holds", json={"automobilio_id": car_id, **PERIOD}, headers=customer["headers"])
    assert resp.status_code == 201, resp.text
    return resp.json()["laikymo_id"]


def _body(**overrides):
    body = {
        "paslaugos": ["pilna_apsauga"],
        "paemimo_valanda": 14,
        "salygu_versija": rental_terms.TERMS_VERSION,
        "sutinku_su_salygomis": True,
    }
    body.update(overrides)
    return body


def _confirm(client, customer, hold_id, key=None, **overrides):
    headers = dict(customer["headers"])
    if key is not False:
        headers["Idempotency-Key"] = key or str(uuid4())
    return client.post(f"{API}/customer/holds/{hold_id}/confirm", json=_body(**overrides), headers=headers)


def _count_reservations(db_session, customer):
    return db_session.query(Reservation).filter_by(kliento_id=customer["kliento_id"]).count()


def test_confirm_creates_pending_reservation_with_terms_and_extras(client, db_session, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers, kaina_parai=45.0)
    hold_id = _hold(client, customer, car_id)

    resp = _confirm(client, customer, hold_id)

    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["busena"] == "laukia"
    assert body["dienu_skaicius"] == 4
    assert body["viso_kaina"] == 4 * 45 + 4 * 12
    assert body["paemimo_valanda"] == 14
    assert body["salygu_versija"] == rental_terms.TERMS_VERSION
    assert [line["kodas"] for line in body["paslaugos"]] == ["pilna_apsauga"]

    row = db_session.query(Reservation).filter_by(rezervacijos_id=body["rezervacijos_id"]).first()
    assert row.salygos_priimtos == NOW.replace(tzinfo=None)
    assert db_session.query(ReservationExtra).filter_by(rezervacijos_id=row.rezervacijos_id).count() == 1
    assert db_session.get(Hold, hold_id).busena == "panaudotas"


def test_same_key_twice_returns_same_reservation(client, db_session, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    hold_id, key = _hold(client, customer, car_id), str(uuid4())

    first = _confirm(client, customer, hold_id, key)
    second = _confirm(client, customer, hold_id, key)

    assert (first.status_code, second.status_code) == (201, 200)
    # Pakartotas atsakymas iš DB perskaito tą pačią rezervaciją kartu su paslaugomis ir suma.
    assert second.json() == first.json()
    assert _count_reservations(db_session, customer) == 1
    assert db_session.query(IdempotencyKey).filter_by(raktas=key).count() == 1


def test_key_letter_case_does_not_create_second_reservation(client, db_session, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    hold_id, key = _hold(client, customer, car_id), str(uuid4())

    first = _confirm(client, customer, hold_id, key.upper())
    second = _confirm(client, customer, hold_id, key.lower())

    assert (first.status_code, second.status_code) == (201, 200), second.text
    assert second.json()["rezervacijos_id"] == first.json()["rezervacijos_id"]
    assert _count_reservations(db_session, customer) == 1
    assert [row.raktas for row in db_session.query(IdempotencyKey).filter_by(kliento_id=customer["kliento_id"])] == [key.lower()]


# MySQL REPEATABLE READ momentinė kopija sukuriama pirmu paprastu skaitymu. Testas tikrina tik eiliškumą:
# skaitymo transakcija užbaigiama, po jos pirmos užklausos yra automobilio ir kliento užraktai, tik tada rakto skaitymas.
# SQLite lygiagretumo MySQL sąlygomis neįrodo.
def test_read_transaction_ends_before_car_and_client_locks(client, db_session, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    hold_id = _hold(client, customer, car_id)
    events = []

    def on_transaction_end(session, transaction):
        if transaction.parent is None:
            events.append("END")

    def on_statement(conn, cursor, statement, parameters, context, executemany):
        table = re.search(r'FROM "?(\w+)"?', statement)
        events.append(table.group(1) if statement.lstrip().upper().startswith("SELECT") and table else statement.split()[0].upper())

    engine = db_session.get_bind()
    event.listen(db_session, "after_transaction_end", on_transaction_end)
    event.listen(engine, "before_cursor_execute", on_statement)
    try:
        resp = _confirm(client, customer, hold_id)
    finally:
        event.remove(engine, "before_cursor_execute", on_statement)
        event.remove(db_session, "after_transaction_end", on_transaction_end)

    assert resp.status_code == 201, resp.text
    key_read = events.index("Idempotencijos_Raktai")
    last_end = key_read - 1 - events[:key_read][::-1].index("END")
    assert events[last_end + 1:key_read] == ["Automobiliai", "Klientai"]


def test_confirm_refuses_session_with_pending_changes(client, db_session, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    hold_id = _hold(client, customer, car_id)
    row = db_session.get(Client, customer["kliento_id"])
    original_name = row.vardas
    row.vardas = "Neįrašytas"
    try:
        with pytest.raises(RuntimeError):
            reservation_service.confirm_hold(
                db_session, row, hold_id, str(uuid4()), [], 14, rental_terms.TERMS_VERSION, True
            )
    finally:
        db_session.rollback()

    assert db_session.get(Client, customer["kliento_id"]).vardas == original_name
    assert db_session.get(Hold, hold_id).busena == "aktyvus"
    assert _count_reservations(db_session, customer) == 0


def test_retry_after_hold_expired_still_returns_original_reservation(client, db_session, auth_headers, monkeypatch):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    hold_id, key = _hold(client, customer, car_id), str(uuid4())
    first = _confirm(client, customer, hold_id, key)
    assert first.status_code == 201, first.text

    freeze_time(monkeypatch, NOW + timedelta(hours=2))
    retry = _confirm(client, customer, hold_id, key)

    assert retry.status_code == 200
    assert retry.json()["rezervacijos_id"] == first.json()["rezervacijos_id"]


def test_same_key_with_different_body_is_rejected(client, db_session, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    hold_id, key = _hold(client, customer, car_id), str(uuid4())
    assert _confirm(client, customer, hold_id, key).status_code == 201

    resp = _confirm(client, customer, hold_id, key, paslaugos=[])

    assert resp.status_code == 422
    assert _count_reservations(db_session, customer) == 1


def test_new_key_for_already_confirmed_hold_does_not_create_second_reservation(client, db_session, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    hold_id = _hold(client, customer, car_id)
    assert _confirm(client, customer, hold_id).status_code == 201

    resp = _confirm(client, customer, hold_id)

    assert resp.status_code == 409
    assert _count_reservations(db_session, customer) == 1


def test_key_of_one_customer_does_not_leak_to_another(client, db_session, auth_headers):
    first, second = register_customer(client), register_customer(client)
    key = str(uuid4())
    first_hold = _hold(client, first, make_car(client, auth_headers))
    second_hold = _hold(client, second, make_car(client, auth_headers))

    a = _confirm(client, first, first_hold, key)
    b = _confirm(client, second, second_hold, key)

    assert (a.status_code, b.status_code) == (201, 201)
    assert a.json()["rezervacijos_id"] != b.json()["rezervacijos_id"]


@pytest.mark.parametrize("key", [False, "trumpas", "x" * 65, "netinkami simboliai!!"])
def test_missing_or_malformed_key_is_rejected(client, db_session, auth_headers, key):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    hold_id = _hold(client, customer, car_id)

    resp = _confirm(client, customer, hold_id, key)

    assert resp.status_code == 400
    assert _count_reservations(db_session, customer) == 0


def test_expired_hold_cannot_be_confirmed(client, db_session, auth_headers, monkeypatch):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    hold_id = _hold(client, customer, car_id)

    freeze_time(monkeypatch, NOW + timedelta(minutes=hold_service.HOLD_MINUTES, seconds=1))
    resp = _confirm(client, customer, hold_id)

    assert resp.status_code == 410
    assert _count_reservations(db_session, customer) == 0


def test_released_hold_cannot_be_confirmed(client, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    hold_id = _hold(client, customer, car_id)
    assert client.delete(f"{API}/customer/holds/{hold_id}", headers=customer["headers"]).status_code == 204

    assert _confirm(client, customer, hold_id).status_code == 410


def test_other_customers_hold_cannot_be_confirmed(client, db_session, auth_headers):
    owner, attacker = register_customer(client), register_customer(client)
    hold_id = _hold(client, owner, make_car(client, auth_headers))

    resp = _confirm(client, attacker, hold_id)

    assert resp.status_code == 404
    assert _count_reservations(db_session, attacker) == 0
    assert db_session.get(Hold, hold_id).busena == "aktyvus"


@pytest.mark.parametrize(
    "overrides, status",
    [
        ({"sutinku_su_salygomis": False}, 400),
        ({"salygu_versija": "2020-01-01"}, 409),
        ({"paemimo_valanda": 9}, 400),
        ({"paslaugos": ["nera_tokios"]}, 400),
        ({"paemimo_valanda": "vidurdienis"}, 422),
    ],
)
def test_invalid_confirmation_is_rejected_and_hold_stays_active(client, db_session, auth_headers, overrides, status):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    hold_id = _hold(client, customer, car_id)

    resp = _confirm(client, customer, hold_id, **overrides)

    assert resp.status_code == status
    assert _count_reservations(db_session, customer) == 0
    assert db_session.get(Hold, hold_id).busena == "aktyvus"


def test_price_is_fixed_at_confirmation(client, db_session, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers, kaina_parai=45.0)
    confirmed = _confirm(client, customer, _hold(client, customer, car_id))
    assert confirmed.status_code == 201, confirmed.text
    reservation_id = confirmed.json()["rezervacijos_id"]

    # Darbuotojas vėliau pakelia automobilio ir paslaugos kainą. Paslaugų katalogas bendras visam moduliui.
    db_session.get(Car, car_id).kaina_parai = 99
    db_session.query(Extra).filter_by(kodas="pilna_apsauga").first().kaina_parai = 50
    db_session.commit()
    try:
        listed = client.get(f"{API}/customer/reservations", headers=customer["headers"])
        assert listed.status_code == 200, listed.text
        mine = next(row for row in listed.json() if row["rezervacijos_id"] == reservation_id)
        assert mine["viso_kaina"] == 4 * 45 + 4 * 12
    finally:
        db_session.rollback()
        db_session.query(Extra).filter_by(kodas="pilna_apsauga").first().kaina_parai = 12
        db_session.commit()


def test_confirmed_reservation_blocks_car_for_others(client, auth_headers):
    first, second, car_id = register_customer(client), register_customer(client), make_car(client, auth_headers)
    confirmed = _confirm(client, first, _hold(client, first, car_id))
    assert confirmed.status_code == 201, confirmed.text

    resp = client.post(f"{API}/customer/holds", json={"automobilio_id": car_id, **PERIOD}, headers=second["headers"])

    assert resp.status_code == 409

def test_changed_price_requires_reconfirmation(client, db_session, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers, kaina_parai=45)
    hold_id, key = _hold(client, customer, car_id), str(uuid4())
    car = db_session.get(Car, car_id)
    car.kaina_parai = 60
    db_session.commit()
    rejected = _confirm(client, customer, hold_id, key, tiketina_kaina=228)
    assert rejected.status_code == 409, rejected.text
    assert _count_reservations(db_session, customer) == 0
    assert db_session.get(Hold, hold_id).busena == "aktyvus"
    accepted = _confirm(client, customer, hold_id, key, tiketina_kaina=288)
    assert accepted.status_code == 201, accepted.text
    assert accepted.json()["viso_kaina"] == 288


def test_replay_preserves_accepted_price_after_rate_changes(client, db_session, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers, kaina_parai=45)
    hold_id, key = _hold(client, customer, car_id), str(uuid4())
    first = _confirm(client, customer, hold_id, key, tiketina_kaina=228)
    assert first.status_code == 201
    db_session.get(Car, car_id).kaina_parai = 60
    db_session.commit()
    replay = _confirm(client, customer, hold_id, key, tiketina_kaina=228)
    assert replay.status_code == 200, replay.text
    assert replay.json()["viso_kaina"] == 228
    assert replay.json()["rezervacijos_id"] == first.json()["rezervacijos_id"]


def test_same_day_past_pickup_hour_is_rejected(client, db_session, auth_headers, monkeypatch):
    freeze_time(monkeypatch, datetime(2026, 11, 29, 12, 0, tzinfo=timezone.utc))
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    response = client.post(f"{API}/customer/holds", json={"automobilio_id": car_id, "date_from": "2026-11-29", "date_to": "2026-11-30"}, headers=customer["headers"])
    assert response.status_code == 201, response.text
    rejected = _confirm(client, customer, response.json()["laikymo_id"], paemimo_valanda=12)
    assert rejected.status_code == 400, rejected.text
    assert _count_reservations(db_session, customer) == 0
