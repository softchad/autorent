from datetime import date

import pytest

from app.services import reservation_lifecycle as lifecycle

FROM, TO = date(2026, 12, 1), date(2026, 12, 5)


@pytest.mark.parametrize(
    "busena, tipas, today, expected",
    [
        ("laukia", None, date(2026, 11, 30), lifecycle.STAGE_PENDING),
        ("laukia", None, date(2026, 12, 1), lifecycle.STAGE_NOT_CONFIRMED),
        ("patvirtinta", None, date(2026, 11, 30), lifecycle.STAGE_CONFIRMED),
        ("patvirtinta", None, date(2026, 12, 1), lifecycle.STAGE_ONGOING),
        ("patvirtinta", None, date(2026, 12, 4), lifecycle.STAGE_ONGOING),
        ("patvirtinta", None, date(2026, 12, 5), lifecycle.STAGE_FINISHED),
        ("atšaukta", "klientas", date(2026, 11, 30), lifecycle.STAGE_CANCELLED),
        ("atšaukta", "darbuotojas", date(2026, 11, 30), lifecycle.STAGE_CANCELLED),
        ("atšaukta", None, date(2026, 11, 30), lifecycle.STAGE_CANCELLED),
        ("atšaukta", "isnuomota", date(2026, 12, 2), lifecycle.STAGE_RENTED),
    ],
)
def test_stage_of(busena, tipas, today, expected):
    assert lifecycle.stage_of(busena, FROM, TO, tipas, today) == expected


def test_every_stage_has_a_rule_and_allows_viewing():
    stages = [value for name, value in vars(lifecycle).items() if name.startswith("STAGE_")]
    assert set(stages) == set(lifecycle.ALLOWED_ACTIONS)
    assert all(lifecycle.can(stage, lifecycle.ACTION_VIEW) for stage in stages)


@pytest.mark.parametrize(
    "stage, cancellable",
    [
        (lifecycle.STAGE_PENDING, True),
        (lifecycle.STAGE_CONFIRMED, True),
        (lifecycle.STAGE_ONGOING, False),
        (lifecycle.STAGE_FINISHED, False),
        (lifecycle.STAGE_NOT_CONFIRMED, False),
        (lifecycle.STAGE_RENTED, False),
        (lifecycle.STAGE_CANCELLED, False),
    ],
)
def test_cancel_is_allowed_only_before_start_date(stage, cancellable):
    assert lifecycle.can(stage, lifecycle.ACTION_CANCEL) is cancellable


def test_unknown_stage_allows_nothing():
    assert lifecycle.allowed_actions("nezinomas") == []
    assert lifecycle.can("nezinomas", lifecycle.ACTION_VIEW) is False


def test_allowed_actions_are_sorted_and_stable():
    assert lifecycle.allowed_actions(lifecycle.STAGE_PENDING) == ["atsaukti", "perziureti", "rasyti_pagalbai"]
    assert lifecycle.allowed_actions(lifecycle.STAGE_FINISHED) == ["perziureti"]
