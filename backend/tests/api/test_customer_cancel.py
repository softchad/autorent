from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Query

from app.models.car import Car
from app.models.client import Client
from app.models.reservation import Reservation
from app.services import cancellation_policy, rental_terms
from tests.helpers import API, ensure_extras, ensure_location, freeze_time, make_car, register_customer

NOW = datetime(2026, 11, 25, 9, 0, tzinfo=timezone.utc)
# Paėmimas 2026-12-03 12:00 Vilniuje = 10:00 UTC.
PICKUP_UTC = datetime(2026, 12, 3, 10, 0, tzinfo=timezone.utc)
PERIOD = {"date_from": "2026-12-03", "date_to": "2026-12-07"}
# Testinė sąlygų versija, kuriai monkeypatch leidžia vėlyvo atšaukimo mokestį.
FEE_VERSION = "test-mokestis"
AT_BRANCH = "Dėl rezervacijos atšaukimo kreipkitės į padalinį."


@pytest.fixture(autouse=True)
def setup(db_session, monkeypatch):
    ensure_location(db_session, 1)
    ensure_extras(db_session)
    freeze_time(monkeypatch, NOW)


@pytest.fixture
def fee_version(monkeypatch):
    monkeypatch.setattr(cancellation_policy, "FEE_TERMS_VERSIONS", frozenset({FEE_VERSION}))


def _reserve(client, customer, car_id):
    resp = client.post(f"{API}/customer/reservations", json={"automobilio_id": car_id, **PERIOD}, headers=customer["headers"])
    assert resp.status_code == 200, resp.text
    return resp.json()["rezervacijos_id"]


def _get(client, customer, reservation_id):
    return client.get(f"{API}/customer/reservations/{reservation_id}", headers=customer["headers"])


def _get_ok(client, customer, reservation_id):
    resp = _get(client, customer, reservation_id)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _cancel(client, customer, reservation_id, fee=0.0):
    return client.post(
        f"{API}/customer/reservations/{reservation_id}/cancel", json={"tiketinas_mokestis": fee}, headers=customer["headers"]
    )


def _staff_set_status(client, auth_headers, reservation_id, status):
    resp = client.put(f"{API}/reservations/{reservation_id}", json={"busena": status}, headers=auth_headers)
    assert resp.status_code == 200, resp.text


def _set_terms_version(db_session, reservation_id, version):
    row = db_session.get(Reservation, reservation_id)
    row.salygu_versija = version
    row.salygos_priimtos = None if version is None else NOW.replace(tzinfo=None)
    db_session.commit()


# Skaitoma iš DB (refresh), ne iš sesijos objekto, kad būtų matyti tikrai įrašyta būsena.
def _cancellation_row(db_session, reservation_id):
    row = db_session.get(Reservation, reservation_id)
    db_session.refresh(row)
    return row.busena, row.atsaukimo_tipas, row.atsaukta, row.atsaukimo_mokestis


def _assert_not_cancelled(db_session, reservation_id, busena="laukia"):
    assert _cancellation_row(db_session, reservation_id) == (busena, None, None, None)


def test_detail_shows_stage_actions_and_free_cancellation(client, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers, kaina_parai=45.0)
    reservation_id = _reserve(client, customer, car_id)

    body = _get_ok(client, customer, reservation_id)

    assert body["etapas"] == "laukia_patvirtinimo"
    assert body["veiksmai"] == ["atsaukti", "perziureti", "rasyti_pagalbai"]
    assert body["atsaukimas"] == {"nemokamai": True, "mokestis": 0.0, "nemokamai_iki": "2026-12-01T10:00:00Z"}


def test_list_contains_same_lifecycle_fields(client, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    reservation_id = _reserve(client, customer, car_id)

    resp = client.get(f"{API}/customer/reservations", headers=customer["headers"])
    assert resp.status_code == 200, resp.text
    listed = resp.json()

    assert listed[0]["rezervacijos_id"] == reservation_id
    assert listed[0]["etapas"] == "laukia_patvirtinimo"
    assert "atsaukti" in listed[0]["veiksmai"]


def test_free_cancellation(client, db_session, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    reservation_id = _reserve(client, customer, car_id)

    resp = _cancel(client, customer, reservation_id, fee=0)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert (body["busena"], body["etapas"], body["atsaukimo_tipas"], body["atsaukimo_mokestis"]) == (
        "atšaukta", "atsaukta", "klientas", 0.0,
    )
    assert body["veiksmai"] == ["perziureti"] and body["atsaukimas"] is None
    row = db_session.get(Reservation, reservation_id)
    assert row.atsaukta == NOW.replace(tzinfo=None)


@pytest.mark.parametrize("version", [None, "2026-11-24"], ids=["be_versijos", "priimta_2026_11_24"])
def test_late_cancellation_without_fee_terms_is_refused(client, db_session, auth_headers, monkeypatch, version):
    customer, car_id = register_customer(client), make_car(client, auth_headers, kaina_parai=45.0)
    reservation_id = _reserve(client, customer, car_id)
    _set_terms_version(db_session, reservation_id, version)

    freeze_time(monkeypatch, PICKUP_UTC - timedelta(hours=20))
    body = _get_ok(client, customer, reservation_id)
    refused = [_cancel(client, customer, reservation_id, fee=fee) for fee in (0, 45.0)]

    assert "atsaukti" not in body["veiksmai"] and body["atsaukimas"] is None
    assert [(resp.status_code, resp.json()["detail"]) for resp in refused] == [(409, AT_BRANCH)] * 2
    _assert_not_cancelled(db_session, reservation_id)
    assert db_session.get(Reservation, reservation_id).salygu_versija == version


def test_exactly_48_hours_is_free_with_fee_terms(client, db_session, auth_headers, monkeypatch, fee_version):
    customer, car_id = register_customer(client), make_car(client, auth_headers, kaina_parai=45.0)
    reservation_id = _reserve(client, customer, car_id)
    _set_terms_version(db_session, reservation_id, FEE_VERSION)

    freeze_time(monkeypatch, PICKUP_UTC - timedelta(hours=48))
    preview = _get_ok(client, customer, reservation_id)["atsaukimas"]
    resp = _cancel(client, customer, reservation_id, fee=0)

    assert (preview["nemokamai"], preview["mokestis"]) == (True, 0.0)
    assert resp.status_code == 200, resp.text
    assert resp.json()["atsaukimo_mokestis"] == 0.0


def test_late_cancellation_with_fee_terms_shows_and_applies_one_day_fee(
    client, db_session, auth_headers, monkeypatch, fee_version
):
    customer, car_id = register_customer(client), make_car(client, auth_headers, kaina_parai=45.0)
    reservation_id = _reserve(client, customer, car_id)
    _set_terms_version(db_session, reservation_id, FEE_VERSION)

    freeze_time(monkeypatch, PICKUP_UTC - timedelta(hours=47, minutes=59))
    preview = _get_ok(client, customer, reservation_id)["atsaukimas"]
    resp = _cancel(client, customer, reservation_id, fee=preview["mokestis"])

    assert preview == {"nemokamai": False, "mokestis": 45.0, "nemokamai_iki": "2026-12-01T10:00:00Z"}
    assert resp.status_code == 200, resp.text
    assert resp.json()["atsaukimo_mokestis"] == 45.0
    assert _cancellation_row(db_session, reservation_id)[1:] == ("klientas", (PICKUP_UTC - timedelta(hours=47, minutes=59)).replace(tzinfo=None), 45)


def test_late_fee_is_capped_by_reservation_total(client, db_session, auth_headers, monkeypatch, fee_version):
    customer, car_id = register_customer(client), make_car(client, auth_headers, kaina_parai=45.0)
    reservation_id = _reserve(client, customer, car_id)
    _set_terms_version(db_session, reservation_id, FEE_VERSION)
    # 10 parų mokestis viršytų 4 parų rezervacijos sumą (180 €).
    monkeypatch.setattr(rental_terms, "LATE_CANCELLATION_FEE_DAYS", 10)

    freeze_time(monkeypatch, PICKUP_UTC - timedelta(hours=20))
    body = _get_ok(client, customer, reservation_id)
    resp = _cancel(client, customer, reservation_id, fee=180.0)

    assert (body["viso_kaina"], body["atsaukimas"]["mokestis"]) == (180.0, 180.0)
    assert resp.status_code == 200, resp.text
    assert resp.json()["atsaukimo_mokestis"] == 180.0


def test_cancel_is_refused_if_shown_fee_is_outdated(client, db_session, auth_headers, monkeypatch, fee_version):
    customer, car_id = register_customer(client), make_car(client, auth_headers, kaina_parai=45.0)
    reservation_id = _reserve(client, customer, car_id)
    _set_terms_version(db_session, reservation_id, FEE_VERSION)

    # Klientas matė „nemokamai“, bet patvirtino jau po 48 val. ribos.
    freeze_time(monkeypatch, PICKUP_UTC - timedelta(hours=20))
    resp = _cancel(client, customer, reservation_id, fee=0)

    assert resp.status_code == 409
    _assert_not_cancelled(db_session, reservation_id)


def test_cannot_cancel_after_pickup_time(client, db_session, auth_headers, monkeypatch):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    reservation_id = _reserve(client, customer, car_id)
    _staff_set_status(client, auth_headers, reservation_id, "patvirtinta")

    freeze_time(monkeypatch, PICKUP_UTC + timedelta(minutes=1))
    body = _get_ok(client, customer, reservation_id)
    resp = _cancel(client, customer, reservation_id)

    assert body["etapas"] == "nuomos_laikas"
    assert "atsaukti" not in body["veiksmai"] and body["atsaukimas"] is None
    assert resp.status_code == 409
    _assert_not_cancelled(db_session, reservation_id, busena="patvirtinta")


def test_confirmed_reservation_cannot_be_cancelled_on_pickup_day(client, db_session, auth_headers, monkeypatch):
    customer, car_id = register_customer(client), make_car(client, auth_headers, kaina_parai=45.0)
    reservation_id = _reserve(client, customer, car_id)
    _staff_set_status(client, auth_headers, reservation_id, "patvirtinta")

    freeze_time(monkeypatch, PICKUP_UTC - timedelta(hours=1))
    body = _get_ok(client, customer, reservation_id)

    # Paėmimo dieną rezervacija jau laikoma prasidėjusia nuoma – atšaukimas tik per padalinį.
    assert body["etapas"] == "nuomos_laikas"
    assert body["atsaukimas"] is None
    assert _cancel(client, customer, reservation_id, fee=45.0).status_code == 409
    _assert_not_cancelled(db_session, reservation_id, busena="patvirtinta")


def test_pending_reservation_not_confirmed_by_pickup_day_can_no_longer_be_cancelled(client, auth_headers, monkeypatch):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    reservation_id = _reserve(client, customer, car_id)

    freeze_time(monkeypatch, PICKUP_UTC - timedelta(hours=1))
    body = _get_ok(client, customer, reservation_id)

    assert body["etapas"] == "nepatvirtinta_laiku"
    assert body["veiksmai"] == ["perziureti"] and body["atsaukimas"] is None


def test_repeated_cancel_is_idempotent(client, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    reservation_id = _reserve(client, customer, car_id)

    first = _cancel(client, customer, reservation_id)
    second = _cancel(client, customer, reservation_id)

    assert (first.status_code, second.status_code) == (200, 200)
    assert first.json() == second.json()


def test_cancelled_reservation_frees_the_car(client, auth_headers):
    first, second, car_id = register_customer(client), register_customer(client), make_car(client, auth_headers)
    reservation_id = _reserve(client, first, car_id)
    cancelled = _cancel(client, first, reservation_id)
    assert cancelled.status_code == 200, cancelled.text

    resp = client.post(f"{API}/customer/reservations", json={"automobilio_id": car_id, **PERIOD}, headers=second["headers"])

    assert resp.status_code == 200


def test_other_customer_cannot_view_or_cancel(client, db_session, auth_headers):
    owner, attacker, car_id = register_customer(client), register_customer(client), make_car(client, auth_headers)
    reservation_id = _reserve(client, owner, car_id)

    assert _get(client, attacker, reservation_id).status_code == 404
    assert _cancel(client, attacker, reservation_id).status_code == 404
    _assert_not_cancelled(db_session, reservation_id)


def test_unknown_reservation_and_missing_token(client):
    customer = register_customer(client)
    assert _get(client, customer, 999999).status_code == 404
    assert _cancel(client, customer, 999999).status_code == 404
    assert client.get(f"{API}/customer/reservations/1").status_code == 401
    assert client.post(f"{API}/customer/reservations/1/cancel", json={"tiketinas_mokestis": 0}).status_code == 401


@pytest.mark.parametrize("fee", [-1, "daug", 10**9])
def test_cancel_rejects_malformed_fee(client, db_session, auth_headers, fee):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    reservation_id = _reserve(client, customer, car_id)
    assert _cancel(client, customer, reservation_id, fee=fee).status_code == 422
    _assert_not_cancelled(db_session, reservation_id)


def test_staff_cancellation_is_marked_and_shown_as_cancelled(client, db_session, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    reservation_id = _reserve(client, customer, car_id)

    _staff_set_status(client, auth_headers, reservation_id, "atšaukta")

    body = _get_ok(client, customer, reservation_id)
    assert (body["etapas"], body["atsaukimo_tipas"]) == ("atsaukta", "darbuotojas")


def test_staff_can_reactivate_customer_cancelled_reservation(client, db_session, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    reservation_id = _reserve(client, customer, car_id)
    cancelled = _cancel(client, customer, reservation_id)
    assert cancelled.status_code == 200, cancelled.text

    _staff_set_status(client, auth_headers, reservation_id, "patvirtinta")

    row = db_session.get(Reservation, reservation_id)
    assert (row.busena, row.atsaukimo_tipas, row.atsaukta, row.atsaukimo_mokestis) == ("patvirtinta", None, None, None)
    assert _get_ok(client, customer, reservation_id)["etapas"] == "patvirtinta"


# Nuoseklus SQLite testas: tikrina užraktų prašymo tvarką ir ORM objekto atnaujinimą, ne tikrą MySQL lygiagretumą.
def test_cancel_locks_car_client_reservation_in_order(client, auth_headers, monkeypatch):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    reservation_id = _reserve(client, customer, car_id)
    locked = []
    original = Query.with_for_update

    def record(self, *args, **kwargs):
        locked.append(tuple(column["entity"] for column in self.column_descriptions))
        return original(self, *args, **kwargs)

    monkeypatch.setattr(Query, "with_for_update", record)
    resp = _cancel(client, customer, reservation_id)

    assert resp.status_code == 200, resp.text
    assert locked == [(Car,), (Client,), (Reservation,)]


def test_cancel_decides_on_fresh_row_not_stale_session_object(client, db_session, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    reservation_id = _reserve(client, customer, car_id)
    stale = db_session.get(Reservation, reservation_id)
    assert stale.busena == "laukia"
    # Darbuotojo atšaukimas įrašomas aplenkiant ORM: sesijos objektas lieka pasenęs („laukia“).
    db_session.execute(
        text("UPDATE Rezervavimas SET busena = 'atšaukta', atsaukimo_tipas = 'darbuotojas' WHERE rezervacijos_id = :id"),
        {"id": reservation_id},
    )
    assert stale.busena == "laukia"

    resp = _cancel(client, customer, reservation_id)

    assert resp.status_code == 409
    assert _cancellation_row(db_session, reservation_id)[:2] == ("atšaukta", "darbuotojas")
