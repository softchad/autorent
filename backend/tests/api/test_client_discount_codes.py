# Darbuotojo prieiga prie kliento nuolaidos kodų (clients/{id}/discount-codes) - atskiras failas, nes test_client.py pabaigos testai atšaukia bendrą modulio transakciją.
import uuid
from datetime import datetime, timezone

from app.models.discount_code import DiscountCode

CLIENT_SAMPLE = {
    "vardas": "Testas",
    "pavarde": "Kodukas",
    "telefono_nr": "+37060000000",
    "gimimo_data": "1995-01-01",
}


# Darbuotojas mato TIK šio kliento NEPANAUDOTUS kodus - svetimo kliento ir jau panaudotas kodas į sąrašą nepatenka.
def test_staff_sees_only_clients_unused_discount_codes(client, auth_headers, db_session):
    ids = []
    for _ in range(2):
        data = CLIENT_SAMPLE.copy()
        data["el_pastas"] = f"{uuid.uuid4().hex[:8]}@test.lt"
        resp = client.post("/api/v1/clients/", json=data, headers=auth_headers)
        assert resp.status_code == 200, resp.json()
        ids.append(resp.json()["kliento_id"])
    owner, other = ids
    suffix = uuid.uuid4().hex[:6].upper()
    db_session.add_all([
        DiscountCode(kodas=f"AR-OK{suffix}", kliento_id=owner, verte_eur=10, kilme="lojalumas"),
        DiscountCode(kodas=f"AR-US{suffix}", kliento_id=owner, verte_eur=5, kilme="lojalumas",
                     panaudojimo_data=datetime.now(timezone.utc)),
        DiscountCode(kodas=f"AR-OT{suffix}", kliento_id=other, verte_eur=20, kilme="aptarnavimas"),
    ])
    db_session.commit()

    resp = client.get(f"/api/v1/clients/{owner}/discount-codes", headers=auth_headers)
    assert resp.status_code == 200, resp.json()
    assert [c["kodas"] for c in resp.json()] == [f"AR-OK{suffix}"]


def test_client_discount_codes_require_staff_token(client):
    resp = client.get("/api/v1/clients/1/discount-codes")
    assert resp.status_code == 401
