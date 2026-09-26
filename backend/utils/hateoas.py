# HATEOAS nuorodos (REST principas - atsakymas pats pasako, KOKIUS veiksmus su šiuo įrašu galima atlikti toliau, ne tik duomenis) - "resource" visada perduodamas kaip fiksuotas tekstas iš kviečiančio endpoint'o (pvz. "cars"), funkcija pati JO nevalidavo, tik sudėlioja URL.
def generate_links(resource: str, resource_id: int, actions: list[str] | None = None) -> list[dict]:
    base_url = f"/api/v1/{resource}/{resource_id}"
    # "self" - paties įrašo nuoroda, pridedama VISADA, net jei "actions" tuščias arba nenurodytas.
    links = [{"rel": "self", "href": base_url}]
    if actions:
        for action in actions:
            # Pažįstamos TIK šios dvi reikšmės - kiekvienas kviečiantis endpoint'as naudoja vienodą URL IR update'ui, IR delete'ui (skirtumą daro HTTP metodas, ne skirtingas kelias), tad abiem užtenka to pačio "base_url". Bet koks kitas tekstas tyliai ignoruojamas, nauja nuoroda nesukuriama.
            if action == "update":
                links.append({"rel": "update", "href": base_url})
            elif action == "delete":
                links.append({"rel": "delete", "href": base_url})
    return links
