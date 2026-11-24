from datetime import datetime, timezone

import pytest

from app.models.employee import Employee
from app.models.reservation import Reservation
from tests.helpers import API, ensure_location, freeze_time, make_car, register_customer

NOW = datetime(2026, 11, 25, 9, 0, tzinfo=timezone.utc)
PERIOD = {"date_from": "2026-12-03", "date_to": "2026-12-07"}


@pytest.fixture(autouse=True)
def setup(db_session, monkeypatch):
    ensure_location(db_session, 1)
    freeze_time(monkeypatch, NOW)


def _rent_out(client, db_session, auth_headers, customer, car_id, reservation_id):
    staff = db_session.query(Employee).first()
    return client.post(
        f"{API}/orders/",
        json={
            "rezervacijos_id": reservation_id,
            "kliento_id": customer["kliento_id"],
            "automobilio_id": car_id,
            "darbuotojo_id": staff.darbuotojo_id,
            "nuomos_data": PERIOD["date_from"],
            "grazinimo_data": PERIOD["date_to"],
            "paemimo_vietos_id": 1,
            "grazinimo_vietos_id": 1,
            "bendra_kaina": 200,
            "uzsakymo_busena": "patvirtinta",
            "turi_papildomas_paslaugas": False,
        },
        headers=auth_headers,
    )


def test_rented_out_reservation_is_shown_to_customer_as_rented_not_cancelled(client, db_session, auth_headers):
    customer, car_id = register_customer(client), make_car(client, auth_headers)
    booked = client.post(
        f"{API}/customer/reservations", json={"automobilio_id": car_id, **PERIOD}, headers=customer["headers"]
    )
    assert booked.status_code == 200, booked.text
    reservation_id = booked.json()["rezervacijos_id"]
    confirmed = client.put(f"{API}/reservations/{reservation_id}", json={"busena": "patvirtinta"}, headers=auth_headers)
    assert confirmed.status_code == 200, confirmed.text

    resp = _rent_out(client, db_session, auth_headers, customer, car_id, reservation_id)
    assert resp.status_code in (200, 201), resp.text

    row = db_session.get(Reservation, reservation_id)
    # Darbuotojų portalui būsena lieka kaip anksčiau.
    assert row.busena == "atšaukta"
    assert row.atsaukimo_tipas == "isnuomota"
    assert row.atsaukta == NOW.replace(tzinfo=None)

    detail = client.get(f"{API}/customer/reservations/{reservation_id}", headers=customer["headers"])
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["etapas"] == "isnuomota"
    assert "atsaukti" not in body["veiksmai"]
    assert body["atsaukimo_mokestis"] is None
