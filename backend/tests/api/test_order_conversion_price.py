from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
import app.models  # noqa: F401 - registruoja visus modelius prieš create_all
from app.models.car import Car
from app.models.employee import Employee
from app.models.extra import Extra
from app.models.reservation import Reservation
from app.services import rental_terms
from tests.helpers import API, ensure_extras, ensure_location, freeze_time, make_car, register_customer

NOW = datetime(2026, 11, 25, 9, 0, tzinfo=timezone.utc)
PERIOD = {"date_from": "2026-12-03", "date_to": "2026-12-07"}


# Atskira atminties bazė: confirm_hold daro rollback, kuris bendroje conftest sesijoje atšauktų visą modulio transakciją.
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


# Klientas programėlėje patvirtina rezervaciją, darbuotojas ją patvirtina portale.
def _approved_reservation(client, auth_headers, extras: list[str], expected_total: float):
    customer = register_customer(client)
    car_id = make_car(client, auth_headers, kaina_parai=45.0)
    hold = client.post(f"{API}/customer/holds", json={"automobilio_id": car_id, **PERIOD}, headers=customer["headers"])
    assert hold.status_code == 201, hold.text
    confirmed = client.post(
        f"{API}/customer/holds/{hold.json()['laikymo_id']}/confirm",
        json={
            "paslaugos": extras, "paemimo_valanda": 14, "salygu_versija": rental_terms.TERMS_VERSION,
            "sutinku_su_salygomis": True, "tiketina_kaina": expected_total,
        },
        headers={**customer["headers"], "Idempotency-Key": str(uuid4())},
    )
    assert confirmed.status_code == 201, confirmed.text
    reservation_id = confirmed.json()["rezervacijos_id"]
    assert confirmed.json()["viso_kaina"] == expected_total
    approved = client.put(f"{API}/reservations/{reservation_id}", json={"busena": "patvirtinta"}, headers=auth_headers)
    assert approved.status_code == 200, approved.text
    return customer, car_id, reservation_id


# Toks pat užklausos kūnas, kokį siunčia darbuotojų portalas: suma iš dabartinio automobilio tarifo, be paslaugų žymos.
def _convert(client, db_session, auth_headers, customer, car_id, reservation_id):
    staff = db_session.query(Employee).first()
    return client.post(f"{API}/orders/", json={
        "rezervacijos_id": reservation_id, "kliento_id": customer["kliento_id"], "automobilio_id": car_id,
        "darbuotojo_id": staff.darbuotojo_id, "nuomos_data": PERIOD["date_from"], "grazinimo_data": PERIOD["date_to"],
        "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1, "bendra_kaina": 180.0,
        "uzsakymo_busena": "patvirtinta", "turi_papildomas_paslaugas": False,
    }, headers=auth_headers)


def test_conversion_keeps_locked_car_and_extra_rates_after_price_change(client, db_session, auth_headers):
    customer, car_id, reservation_id = _approved_reservation(client, auth_headers, ["pilna_apsauga"], 228.0)
    # Kainos pakeistos po patvirtinimo – užsakymas turi likti su klientui patvirtinta suma.
    db_session.get(Car, car_id).kaina_parai = 60
    db_session.query(Extra).filter_by(kodas="pilna_apsauga").one().kaina_parai = 20
    db_session.commit()

    order = _convert(client, db_session, auth_headers, customer, car_id, reservation_id)
    assert order.status_code == 200, order.text
    assert order.json()["bendra_kaina"] == 228.0
    assert order.json()["turi_papildomas_paslaugas"] is True

    reservation = db_session.get(Reservation, reservation_id)
    db_session.refresh(reservation)
    assert (reservation.busena, reservation.atsaukimo_tipas) == ("atšaukta", "isnuomota")
    assert _convert(client, db_session, auth_headers, customer, car_id, reservation_id).status_code == 409


def test_conversion_without_extras_uses_locked_car_rate(client, db_session, auth_headers):
    customer, car_id, reservation_id = _approved_reservation(client, auth_headers, [], 180.0)
    db_session.get(Car, car_id).kaina_parai = 60
    db_session.commit()

    order = _convert(client, db_session, auth_headers, customer, car_id, reservation_id)
    assert order.status_code == 200, order.text
    assert order.json()["bendra_kaina"] == 180.0
    assert order.json()["turi_papildomas_paslaugas"] is False
