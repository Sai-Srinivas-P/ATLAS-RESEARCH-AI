from atlas_research.models import ResearchPlan, ResearchTask


def test_plan_model():
    plan = ResearchPlan(
        objective="test",
        tasks=[ResearchTask(id="t1", question="What?", rationale="scope")],
    )
    assert plan.tasks[0].id == "t1"
