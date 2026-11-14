from datetime import datetime, timezone

from app.services import clock


def test_server_time_is_public_and_utc(client):
    resp = client.get("/api/v1/public/server-time")

    assert resp.status_code == 200

    value = resp.json()["server_time"]
    assert value.endswith("Z")

    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))

    assert abs(
        (datetime.now(timezone.utc) - parsed).total_seconds()
    ) < 5


def test_server_time_uses_clock_module(client, monkeypatch):
    fixed = datetime(
        2026, 11, 28, 10, 30, 0,
        tzinfo=timezone.utc,
    )

    monkeypatch.setattr(clock, "utc_now", lambda: fixed)

    resp = client.get("/api/v1/public/server-time")

    assert resp.json() == {
        "server_time": "2026-11-28T10:30:00Z"
    }