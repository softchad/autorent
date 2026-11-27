import pytest

from app.models.car import Car
from app.services.alternatives_service import rank_similar_cars


def car(car_id, body="Sedanas", transmission="automatinė", seats=5):
    return Car(
        automobilio_id=car_id,
        kebulo_tipas=body,
        pavaru_deze=transmission,
        sedimos_vietos=seats,
    )


@pytest.mark.parametrize("body,transmission,seats,score,reasons", [
    ("Sedanas", "automatinė", 5, 6, ("kebulo_tipas", "pavaru_deze", "sedimos_vietos")),
    ("Sedanas", "mechaninė", 4, 3, ("kebulo_tipas",)),
    ("Visureigis", "automatinė", 4, 2, ("pavaru_deze",)),
    ("Visureigis", "mechaninė", 5, 1, ("sedimos_vietos",)),
    ("Sedanas", "automatinė", 4, 5, ("kebulo_tipas", "pavaru_deze")),
    ("Sedanas", "mechaninė", 5, 4, ("kebulo_tipas", "sedimos_vietos")),
    ("Visureigis", "automatinė", 5, 3, ("pavaru_deze", "sedimos_vietos")),
])
def test_scores_matching_attributes_and_returns_reasons(body, transmission, seats, score, reasons):
    candidate = car(2, body, transmission, seats)
    matches = rank_similar_cars(car(1), [candidate])
    assert len(matches) == 1
    assert matches[0].car is candidate
    assert matches[0].score == score
    assert matches[0].reasons == reasons


def test_excludes_reference_by_id_even_when_it_is_another_object():
    assert rank_similar_cars(car(1), [car(1)]) == []


def test_excludes_candidates_without_matching_attributes():
    assert rank_similar_cars(car(1), [car(2, "Visureigis", "mechaninė", 4)]) == []


def test_orders_by_score_then_ascending_id_and_returns_three():
    candidates = [car(8), car(4, transmission="mechaninė"), car(2), car(3)]
    matches = rank_similar_cars(car(1), candidates)
    assert [match.car.automobilio_id for match in matches] == [2, 3, 8]
    assert [match.score for match in matches] == [6, 6, 6]


def test_closest_match_wins_over_lower_id():
    matches = rank_similar_cars(car(1), [car(2, seats=4), car(9)])
    assert [match.car.automobilio_id for match in matches] == [9, 2]


def test_empty_candidates_return_empty_list():
    assert rank_similar_cars(car(1), []) == []


def test_accepts_generator():
    matches = rank_similar_cars(car(1), (car(car_id) for car_id in [8, 2]))
    assert [match.car.automobilio_id for match in matches] == [2, 8]


def test_keeps_input_order_and_car_attributes_unchanged():
    reference = car(1)
    candidates = [car(8, seats=4), car(2)]
    original = candidates.copy()
    attributes = [
        (item.automobilio_id, item.kebulo_tipas, item.pavaru_deze, item.sedimos_vietos)
        for item in [reference, *candidates]
    ]
    rank_similar_cars(reference, candidates)
    assert all(item is original[index] for index, item in enumerate(candidates))
    assert [
        (item.automobilio_id, item.kebulo_tipas, item.pavaru_deze, item.sedimos_vietos)
        for item in [reference, *candidates]
    ] == attributes
