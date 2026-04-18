import pytest
from utils.hateoas import generate_links


def _get_self_link(links):
    return next((l for l in links if l.get("rel") == "self"), None)


def test_generate_basic_links():
    links = generate_links("car", 42, ["view", "update", "delete"])
    rels = {l["rel"] for l in links}

    assert "self" in rels
    assert "update" in rels
    assert "delete" in rels

    self_link = _get_self_link(links)
    assert self_link is not None
    assert "href" in self_link
    assert "car" in self_link["href"]
    assert "42" in self_link["href"]


def test_generate_custom_action_link():
    links = generate_links("car", 77, ["update_status"])
    assert any(link["rel"] == "update_status" for link in links)

    status_links = [l for l in links if l["rel"] == "update_status"]
    assert any("/status" in l["href"] for l in status_links)


def test_generate_links_empty_actions():
    links = generate_links("car", 1, [])
    assert isinstance(links, list)
    assert len(links) == 1
    self_link = links[0]
    assert self_link["rel"] == "self"
    assert "href" in self_link
    assert "car" in self_link["href"]
    assert "1" in self_link["href"]


def test_generate_links_invalid_resource():
    links = generate_links("???", 99, ["view"])
    self_link = _get_self_link(links)
    assert self_link is not None
    assert "href" in self_link
    assert "???" in self_link["href"]
    assert "99" in self_link["href"]


def test_generate_links_no_id():
    links = generate_links("car", None, ["view"])
    self_link = _get_self_link(links)
    assert self_link is not None
    assert "href" in self_link
    assert "car" in self_link["href"]
    assert self_link["href"].startswith("/api/")


def test_generate_links_duplicate_actions():
    links = generate_links("car", 5, ["update", "update", "view"])
    rels = [l["rel"] for l in links]
    assert rels.count("update") >= 2
    self_link = _get_self_link(links)
    assert self_link is not None
    assert "car" in self_link["href"]
    assert "5" in self_link["href"]
