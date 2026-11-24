"""Rezervacijos gyvavimo etapai ir kiekviename etape klientui leidžiami veiksmai. Gryna logika be DB."""
from datetime import date

# Etapai, kuriuos mato klientas. DB būsena (laukia / patvirtinta / atšaukta) kartu su datomis
# ir atšaukimo tipu paverčiama vienu iš jų.
STAGE_PENDING = "laukia_patvirtinimo"
STAGE_CONFIRMED = "patvirtinta"
STAGE_ONGOING = "nuomos_laikas"
STAGE_FINISHED = "pasibaigusi"
STAGE_NOT_CONFIRMED = "nepatvirtinta_laiku"
STAGE_RENTED = "isnuomota"
STAGE_CANCELLED = "atsaukta"

ACTION_VIEW = "perziureti"
ACTION_CANCEL = "atsaukti"
ACTION_SUPPORT = "rasyti_pagalbai"

# Rezervacijos etapams leidžiami kliento veiksmai.
ALLOWED_ACTIONS: dict[str, frozenset[str]] = {
    STAGE_PENDING: frozenset({ACTION_VIEW, ACTION_CANCEL, ACTION_SUPPORT}),
    STAGE_CONFIRMED: frozenset({ACTION_VIEW, ACTION_CANCEL, ACTION_SUPPORT}),
    STAGE_ONGOING: frozenset({ACTION_VIEW, ACTION_SUPPORT}),
    STAGE_FINISHED: frozenset({ACTION_VIEW}),
    STAGE_NOT_CONFIRMED: frozenset({ACTION_VIEW}),
    STAGE_RENTED: frozenset({ACTION_VIEW, ACTION_SUPPORT}),
    STAGE_CANCELLED: frozenset({ACTION_VIEW}),
}


def stage_of(busena: str, date_from: date, date_to: date, atsaukimo_tipas: str | None, today: date) -> str:
    if busena == "atšaukta":
        # „Išnuomoti“ darbuotojų portale rezervaciją pažymi atšaukta ir sukuria užsakymą – klientui tai ne atšaukimas.
        return STAGE_RENTED if atsaukimo_tipas == "isnuomota" else STAGE_CANCELLED
    if busena == "laukia":
        return STAGE_PENDING if today < date_from else STAGE_NOT_CONFIRMED
    if today < date_from:
        return STAGE_CONFIRMED
    if today < date_to:
        return STAGE_ONGOING
    return STAGE_FINISHED


def allowed_actions(stage: str) -> list[str]:
    # Nežinomam etapui neleidžiama nieko (saugus numatytasis elgesys).
    return sorted(ALLOWED_ACTIONS.get(stage, frozenset()))


def can(stage: str, action: str) -> bool:
    return action in ALLOWED_ACTIONS.get(stage, frozenset())
