from utils.hateoas import generate_links


# generate_links VISADA prideda "self" nuorodą PIRMA, prieš tikrinant "actions" (žr. hateoas.py) - tad links[0] garantuotai yra "self", neverta ieškoti per visą sąrašą.
def _get_self_link(links):
    return links[0]


# "view" NĖRA palaikomas veiksmas (hateoas.py žino tik "update"/"delete") - šis testas patikrina, kad JIS tyliai IGNORUOJAMAS (nei klaidos, nei savo nuorodos), ne tik kad update/delete sugeneruojami.
def test_generate_basic_links():
    links = generate_links("car", 42, ["view", "update", "delete"])
    rels = {l["rel"] for l in links}

    assert rels == {"self", "update", "delete"}
    assert len(links) == 3

    self_link = _get_self_link(links)
    assert "href" in self_link
    assert "car" in self_link["href"]
    assert "42" in self_link["href"]


# Be jokių veiksmų (tuščias sąrašas) - turi gautis TIK "self" nuoroda, ne klaida ir ne tuščias sąrašas.
def test_generate_links_empty_actions():
    links = generate_links("car", 1, [])
    assert isinstance(links, list)
    assert len(links) == 1
    self_link = links[0]
    assert self_link["rel"] == "self"
    assert "href" in self_link
    assert "car" in self_link["href"]
    assert "1" in self_link["href"]


# generate_links NETURI žinomų resursų sąrašo (žr. hateoas.py) - bet koks tekstas priimamas ir tiesiog įterpiamas į URL, net jei jis "???" - šis bendros paskirties įrankis pasitiki kviečiančiu kodu, ne pats validuoja.
def test_generate_links_invalid_resource():
    links = generate_links("???", 99, ["view"])
    self_link = _get_self_link(links)
    assert "href" in self_link
    assert "???" in self_link["href"]
    assert "99" in self_link["href"]


# resource_id=None - f-string paverčia jį į tekstinį "None" (žr. hateoas.py "f-string"), tad href turi TIKSLIAI tokią eilutę, ne tik "atrodo panašiai".
def test_generate_links_no_id():
    links = generate_links("car", None, ["view"])
    self_link = _get_self_link(links)
    assert self_link["href"] == "/api/v1/car/None"


# Du kartus pakartotas "update" - generate_links NEDAUGINA (žr. hateoas.py "for action in actions" ciklą be deduplikacijos), tad "update" nuoroda turi atsikartoti TIKSLIAI 2 kartus, ne tik "bent 2".
def test_generate_links_duplicate_actions():
    links = generate_links("car", 5, ["update", "update", "view"])
    rels = [l["rel"] for l in links]
    assert rels.count("update") == 2
    self_link = _get_self_link(links)
    assert "car" in self_link["href"]
    assert "5" in self_link["href"]
