from atlas_research.graph import route_after_critique
from atlas_research.models import Critique


def test_critique_routes_to_synthesis_when_sufficient():
    state = {
        "critique": Critique(sufficient=True),
        "round": 0,
        "max_rounds": 2,
    }
    assert route_after_critique(state) == "synthesize"


def test_critique_routes_to_research_when_gap_exists():
    state = {
        "critique": Critique(sufficient=False, missing_questions=["more"]),
        "round": 0,
        "max_rounds": 2,
    }
    assert route_after_critique(state) == "research"
