from tests.helpers import API, ensure_location, make_car


def test_locations_are_public_and_list_only_branches_with_cars(client, db_session, auth_headers):
    ensure_location(db_session, 1, "Vilnius")
    ensure_location(db_session, 2, "Kaunas")
    ensure_location(db_session, 3, "Klaipėda")  # be automobilių
    make_car(client, auth_headers, dabartine_vieta_id=1)
    make_car(client, auth_headers, dabartine_vieta_id=1)
    make_car(client, auth_headers, dabartine_vieta_id=2)

    resp = client.get(f"{API}/public/locations")

    assert resp.status_code == 200
    ids = [row["vietos_id"] for row in resp.json()]
    assert 1 in ids and 2 in ids
    assert 3 not in ids
    assert len(ids) == len(set(ids)), "padalinys neturi kartotis, kai jame keli automobiliai"


def test_locations_return_only_public_fields(client, db_session, auth_headers):
    ensure_location(db_session, 1, "Vilnius")
    make_car(client, auth_headers, dabartine_vieta_id=1)

    row = client.get(f"{API}/public/locations").json()[0]

    assert set(row.keys()) == {"vietos_id", "pavadinimas", "adresas", "miestas"}


def test_locations_are_sorted_by_city(client, db_session, auth_headers):
    ensure_location(db_session, 1, "Vilnius")
    ensure_location(db_session, 2, "Kaunas")
    make_car(client, auth_headers, dabartine_vieta_id=1)
    make_car(client, auth_headers, dabartine_vieta_id=2)

    cities = [row["miestas"] for row in client.get(f"{API}/public/locations").json()]

    assert cities == sorted(cities)
