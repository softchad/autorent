"""Nuomos sąlygų tekstai, kuriuos per /public/rental-info rodo mobilioji programėlė."""

from app.services import booking_rules

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



# Versija apima visą get_terms() turinį, įskaitant draudimo ir užsienio skyrius bei booking_rules valandas.
TERMS_VERSION = "2026-11-01"

# Atšaukimo taisyklės skaičiai sąlygų tekstui.
FREE_CANCELLATION_HOURS = 48
LATE_CANCELLATION_FEE_DAYS = 1


def _section_price() -> dict:
    return {
        "kodas": "kaina",
        "pavadinimas": "Kaina",
        "punktai": [
            "Nuomos kaina skaičiuojama taip: nuomos parų skaičius × paros kaina, pridėjus pasirinktas papildomas paslaugas.",
            "Kaina užfiksuojama rezervacijos patvirtinimo metu ir vėliau nesikeičia.",
            "Kaina nepriklauso nuo pilietybės ar gyvenamosios šalies.",
        ],
    }


def _section_pickup() -> dict:
    return {
        "kodas": "paemimas",
        "pavadinimas": "Paėmimas ir grąžinimas",
        "punktai": [
            f"Automobilis paimamas pirmą nuomos dieną nuo {booking_rules.PICKUP_FROM_HOUR}:00 iki {booking_rules.PICKUP_TO_HOUR}:00 jūsų pasirinktu laiku.",
            f"Automobilis grąžinamas paskutinę nuomos dieną iki {booking_rules.RETURN_BY_HOUR}:00 tame pačiame padalinyje.",
            "Atsiimant reikia galiojančio vairuotojo pažymėjimo ir asmens dokumento.",
        ],
    }


def _section_cancellation() -> dict:
    return {
        "kodas": "atsaukimas",
        "pavadinimas": "Atšaukimas",
        "punktai": [
            f"Rezervaciją galite atšaukti nemokamai, jei iki paėmimo laiko liko ne mažiau kaip {FREE_CANCELLATION_HOURS} val.",
            f"Atšaukiant vėliau taikomas {LATE_CANCELLATION_FEE_DAYS} paros nuomos kainos mokestis.",
            "Prasidėjus nuomos laikui rezervacijos atšaukti programėlėje nebegalima – kreipkitės į padalinį.",
        ],
    }


# Visos sąlygos, kurias klientas peržiūri ir priima prieš patvirtindamas rezervaciją.
def get_terms() -> dict:
    return {
        "versija": TERMS_VERSION,
        "skyriai": [
            _section_price(),
            _section_cancellation(),
            _section_pickup(),
            SECTION_INSURANCE,
            SECTION_CROSS_BORDER,
        ],
    }
