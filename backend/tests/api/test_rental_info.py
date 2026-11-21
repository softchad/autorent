from app.services import rental_terms
from tests.helpers import API


def test_rental_info_is_public(client):
    resp = client.get(f"{API}/public/rental-info")
    assert resp.status_code == 200


def test_rental_info_explains_insurance_and_cross_border_travel(client):
    resp = client.get(f"{API}/public/rental-info")
    assert resp.status_code == 200
    body = resp.json()
    sections = {section["kodas"]: section for section in body["skyriai"]}

    assert set(sections) == {"draudimas", "uzsienis"}
    assert all(section["punktai"] for section in sections.values())
    # Klientas turi suprasti: kas įskaičiuota ir kad kelionę į užsienį reikia suderinti iš anksto.
    assert "įskaičiuotas" in " ".join(sections["draudimas"]["punktai"])
    assert "iš anksto" in " ".join(sections["uzsienis"]["punktai"])


def test_excess_amount_in_text_matches_constant(client):
    resp = client.get(f"{API}/public/rental-info")
    assert resp.status_code == 200
    body = resp.json()
    insurance = next(section for section in body["skyriai"] if section["kodas"] == "draudimas")
    insurance_text = " ".join(insurance["punktai"])

    assert body["draudimo_isskaita_eur"] == rental_terms.INSURANCE_EXCESS_EUR
    assert f"{rental_terms.INSURANCE_EXCESS_EUR} €" in insurance_text
