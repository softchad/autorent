import re

from app.services import booking_rules, rental_terms
from tests.helpers import API


def _terms(client):
    resp = client.get(f"{API}/public/terms")
    assert resp.status_code == 200
    return resp.json()


def _text(body, code):
    section = next(section for section in body["skyriai"] if section["kodas"] == code)
    return " ".join(section["punktai"])


def test_terms_are_public_and_versioned(client):
    body = _terms(client)
    assert body["versija"] == rental_terms.TERMS_VERSION
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", body["versija"])


def test_terms_cover_everything_customer_must_see_before_confirming(client):
    codes = [section["kodas"] for section in _terms(client)["skyriai"]]
    assert codes == ["kaina", "atsaukimas", "paemimas", "draudimas", "uzsienis"]


def test_cancellation_text_matches_policy_numbers(client):
    text = _text(_terms(client), "atsaukimas")
    assert f"{rental_terms.FREE_CANCELLATION_HOURS} val." in text
    assert f"{rental_terms.LATE_CANCELLATION_FEE_DAYS} paros" in text


def test_pickup_text_matches_booking_rules(client):
    text = _text(_terms(client), "paemimas")
    assert f"nuo {booking_rules.PICKUP_FROM_HOUR}:00 iki {booking_rules.PICKUP_TO_HOUR}:00" in text
    assert f"iki {booking_rules.RETURN_BY_HOUR}:00" in text


def test_price_section_states_country_neutrality(client):
    assert "nepriklauso nuo pilietybės ar gyvenamosios šalies" in _text(_terms(client), "kaina")
