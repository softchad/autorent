import asyncio

import httpx
import pytest

from app.services import geocode_service as service


@pytest.fixture(autouse=True)
def reset_service(monkeypatch):
    monkeypatch.setattr(service, "_cache", {})
    monkeypatch.setattr(service, "_lock", asyncio.Lock())
    monkeypatch.setattr(service, "_last_request", 0.0)


def test_coordinates_and_cache(monkeypatch):
    requests = []

    def handler(request):
        requests.append(request)
        assert request.url.params["countrycodes"] == "lt"
        assert request.url.params["q"] == "Vilnius & centras"
        return httpx.Response(200, json=[{"lat": "54.6872", "lon": "25.2797"}])

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            monkeypatch.setattr(service, "_client", client)
            results = await asyncio.gather(*(service.geocode_address("Vilnius & centras") for _ in range(3)))
            assert results == [(54.6872, 25.2797)] * 3
        assert len(requests) == 1

    asyncio.run(run())


@pytest.mark.parametrize("payload", [{}, [{}], [{"lat": "abc", "lon": "1"}], [{"lat": "NaN", "lon": "1"}], [{"lat": "91", "lon": "1"}]])
def test_invalid_response_is_retryable(monkeypatch, payload):
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=payload))) as client:
            monkeypatch.setattr(service, "_client", client)
            assert await service.geocode_address("Vilnius") is None
            assert not service._cache
    asyncio.run(run())


@pytest.mark.parametrize("status", [403, 429, 500])
def test_provider_failure_is_retryable(monkeypatch, status):
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(status))) as client:
            monkeypatch.setattr(service, "_client", client)
            assert await service.geocode_address("Vilnius") is None
            assert not service._cache
    asyncio.run(run())


def test_no_match_is_cached(monkeypatch):
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=[]))) as client:
            monkeypatch.setattr(service, "_client", client)
            assert await service.geocode_address("Nežinoma") is None
            assert "Nežinoma" in service._cache
    asyncio.run(run())


def test_network_failure_is_retryable(monkeypatch):
    def handler(request):
        raise httpx.ReadTimeout("timeout", request=request)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            monkeypatch.setattr(service, "_client", client)
            assert await service.geocode_address("Vilnius") is None
            assert not service._cache
    asyncio.run(run())


def test_parallel_searches_are_spaced(monkeypatch):
    moments = []
    now = [100.0]

    async def sleep(delay):
        now[0] += delay

    def handler(request):
        moments.append(now[0])
        return httpx.Response(200, json=[])

    monkeypatch.setattr(service.time, "monotonic", lambda: now[0])
    monkeypatch.setattr(service.asyncio, "sleep", sleep)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            monkeypatch.setattr(service, "_client", client)
            await asyncio.gather(service.geocode_address("Vilnius"), service.geocode_address("Kaunas"))
        assert len(moments) == 2
        assert moments[1] - moments[0] >= 1
    asyncio.run(run())


def test_identifying_user_agent():
    async def run():
        client = service._get_client()
        assert client.headers["User-Agent"].startswith("AutoRent/")
        await client.aclose()
    original = service._client
    service._client = None
    try:
        asyncio.run(run())
    finally:
        service._client = original
