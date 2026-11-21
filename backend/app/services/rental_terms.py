"""Nuomos sąlygų tekstai, kuriuos per /public/rental-info rodo mobilioji programėlė."""

# Bazinio draudimo išskaita (suma, kurią žalos atveju dengia klientas), eurais.
INSURANCE_EXCESS_EUR = 500

# Šalys, į kurias galima vykti gavus išankstinį AutoRent sutikimą.
CROSS_BORDER_COUNTRIES = ["Latvija", "Estija", "Lenkija"]

SECTION_INSURANCE = {
    "kodas": "draudimas",
    "pavadinimas": "Draudimas",
    "punktai": [
        "Į nuomos kainą įskaičiuotas privalomasis civilinės atsakomybės draudimas ir KASKO draudimas.",
        f"KASKO išskaita – {INSURANCE_EXCESS_EUR} €: tiek daugiausia mokate žalos atveju, jei laikėtės nuomos taisyklių.",
        "Draudimas negalioja vairuojant neblaiviam, be galiojančio vairuotojo pažymėjimo arba perdavus automobilį sutartyje nenurodytam asmeniui.",
    ],
}

SECTION_CROSS_BORDER = {
    "kodas": "uzsienis",
    "pavadinimas": "Kelionės į užsienį",
    "punktai": [
        "Išvykti su automobiliu iš Lietuvos galima tik iš anksto gavus raštišką AutoRent sutikimą.",
        "Sutikimas gali būti išduotas kelionėms į šias šalis: " + ", ".join(CROSS_BORDER_COUNTRIES) + ".",
        "Apie planuojamą kelionę praneškite ne vėliau kaip prieš 2 darbo dienas iki paėmimo (per pagalbos pokalbį arba padalinyje).",
        "Išvykus be sutikimo draudimas negalioja ir visa žala tenka nuomininkui.",
    ],
}


# Informacija, kurią klientas turi matyti dar prieš rinkdamasis datas.
def get_rental_info() -> dict:
    return {
        "draudimo_isskaita_eur": INSURANCE_EXCESS_EUR,
        "skyriai": [SECTION_INSURANCE, SECTION_CROSS_BORDER],
    }
