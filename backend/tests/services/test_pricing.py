from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.models.extra import Extra
from app.services import pricing_service
from app.services.pricing_service import ExtraPrice, PricingError
from tests.helpers import API, ensure_extras, ensure_location, freeze_time, make_car, register_customer

FULL = ExtraPrice("pilna_apsauga", "Pilna apsauga", Decimal("12.00"))
SEAT = ExtraPrice("vaikiska_kedute", "Vaikiška kėdutė", Decimal("4.00"))


def test_price_without_extras_is_days_times_rate():
    quote = pricing_service.calculate(Decimal("45.00"), 4, [])
    assert quote.nuomos_suma == Decimal("180.00")
    assert quote.paslaugu_suma == Decimal("0.00")
    assert quote.viso == Decimal("180.00")


def test_extras_are_charged_per_day():
    quote = pricing_service.calculate(Decimal("45.00"), 4, [FULL, SEAT])
    assert [(line.kodas, line.suma) for line in quote.paslaugos] == [
        ("pilna_apsauga", Decimal("48.00")),
        ("vaikiska_kedute", Decimal("16.00")),
    ]
    assert quote.paslaugu_suma == Decimal("64.00")
    assert quote.viso == Decimal("244.00")


def test_total_equals_sum_of_shown_lines():
    quote = pricing_service.calculate(Decimal("33.33"), 7, [FULL, SEAT])
    assert quote.viso == quote.nuomos_suma + sum(line.suma for line in quote.paslaugos)


def test_money_is_rounded_to_cents_half_up():
    quote = pricing_service.calculate("19.995", 1, [])
    assert quote.kaina_parai == Decimal("20.00")
    assert pricing_service.calculate(49.99, 3, []).viso == Decimal("149.97")


def test_float_input_does_not_produce_float_errors():
    assert pricing_service.calculate(0.1, 3, []).viso == Decimal("0.30")


def test_zero_days_is_rejected():
    with pytest.raises(ValueError):
        pricing_service.calculate(Decimal("45.00"), 0, [])


def test_load_extras_rejects_unknown_duplicate_and_inactive(db_session):
    ensure_extras(db_session)
    db_session.add(Extra(kodas="isjungta", pavadinimas="Išjungta", aprasymas="-", kaina_parai=1, aktyvi=False))
    db_session.commit()

    assert [e.kodas for e in pricing_service.load_extras(db_session, ["vaikiska_kedute", "pilna_apsauga"])] == [
        "vaikiska_kedute", "pilna_apsauga",
    ]
    for codes in (["nera_tokios"], ["pilna_apsauga", "pilna_apsauga"], ["isjungta"]):
        with pytest.raises(PricingError):
            pricing_service.load_extras(db_session, codes)


# ---- endpointai ----

@pytest.fixture
def api_setup(db_session, monkeypatch):
    ensure_location(db_session, 1)
    ensure_extras(db_session)
    freeze_time(monkeypatch, datetime(2026, 11, 27, 9, 0, tzinfo=timezone.utc))


def _quote(client, car_id, **overrides):
    body = {"automobilio_id": car_id, "date_from": "2026-12-01", "date_to": "2026-12-05", "paslaugos": []}
    body.update(overrides)
    return client.post(f"{API}/public/quote", json=body)


def test_quote_endpoint_returns_breakdown(client, auth_headers, api_setup):
    car_id = make_car(client, auth_headers, kaina_parai=45.0)

    resp = _quote(client, car_id, paslaugos=["pilna_apsauga"])

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["paru_skaicius"] == 4
    assert body["nuomos_suma"] == 180.0
    assert body["paslaugos"] == [{"kodas": "pilna_apsauga", "pavadinimas": "Pilna apsauga", "kaina_parai": 12.0, "suma": 48.0}]
    assert body["viso"] == 228.0
    assert body["laisvas"] is True


def test_quote_marks_booked_car_as_not_free_but_still_prices_it(client, auth_headers, api_setup):
    car_id, customer = make_car(client, auth_headers), register_customer(client)
    resp = client.post(
        f"{API}/customer/reservations",
        json={"automobilio_id": car_id, "date_from": "2026-12-02", "date_to": "2026-12-04"},
        headers=customer["headers"],
    )
    assert resp.status_code == 200, resp.text

    body = _quote(client, car_id).json()

    assert body["laisvas"] is False
    assert body["viso"] == 200.0


@pytest.mark.parametrize(
    "overrides, status",
    [
        ({"date_from": "2026-11-20"}, 400),
        ({"date_to": "2026-12-01"}, 400),
        ({"date_to": "2027-02-01"}, 400),
        ({"paslaugos": ["nera_tokios"]}, 400),
        ({"paslaugos": ["pilna_apsauga", "pilna_apsauga"]}, 400),
        ({"paslaugos": ["x"] * 11}, 422),
        ({"date_from": "ne-data"}, 422),
    ],
)
def test_quote_rejects_bad_input(client, auth_headers, api_setup, overrides, status):
    car_id = make_car(client, auth_headers)
    assert _quote(client, car_id, **overrides).status_code == status


def test_quote_for_unknown_car(client, api_setup):
    assert _quote(client, 999999).status_code == 404


def test_extras_catalogue_lists_only_active(client, db_session, api_setup):
    db_session.add(Extra(kodas="sena_paslauga", pavadinimas="Sena", aprasymas="-", kaina_parai=1, aktyvi=False))
    db_session.commit()

    codes = [row["kodas"] for row in client.get(f"{API}/public/extras").json()]

    assert "pilna_apsauga" in codes and "sena_paslauga" not in codes
