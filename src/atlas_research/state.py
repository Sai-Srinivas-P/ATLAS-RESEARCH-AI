from typing import TypedDict

from .models import Critique, Finding, ResearchPlan, ResearchReport


class ResearchState(TypedDict, total=False):
    question: str
    plan: ResearchPlan
    findings: list[Finding]
    critique: Critique
    report: ResearchReport
    round: int
    max_rounds: int
    errors: list[str]
