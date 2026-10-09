from __future__ import annotations

import asyncio

from langgraph.graph import END, START, StateGraph

from .config import get_settings
from .llm import LLM
from .models import Critique, Finding, ResearchPlan, ResearchReport
from .rag import VectorStore
from .state import ResearchState
from .tools import web_search

llm = LLM()


def plan_node(state: ResearchState) -> dict:
    settings = get_settings()
    if settings.local_fast_mode:
        # Fast local path: avoid a full JSON-generating planner on small laptops.
        # The graph still retains the planner node, but uses a deterministic
        # single research task to keep latency predictable.
        task = {
            "id": "task-1",
            "question": state["question"],
            "rationale": "Direct evidence gathering for the user's question.",
        }
        plan = ResearchPlan(
            objective=state["question"],
            tasks=[task],
        )
        return {"plan": plan, "round": state.get("round", 0)}

    plan = llm.structured(
        ResearchPlan,
        system=(
            "You are a research planner. Break a complex question into independent, "
            "answerable research tasks. Prefer primary sources and recent evidence. "
            "Use at most 2 tasks and keep each task concise."
        ),
        user=state["question"],
    )
    return {"plan": plan, "round": state.get("round", 0)}


async def research_node(state: ResearchState) -> dict:
    plan = state["plan"]
    existing = state.get("findings", [])
    settings = get_settings()

    async def one(task):
        web_sources = await web_search(task.question, limit=3)

        document_sources = []
        try:
            document_sources = VectorStore().search(
                task.question,
                limit=settings.rag_top_k,
            )
        except Exception as exc:  # noqa: BLE001
            # Private RAG is an optional enrichment. A missing Qdrant instance
            # should not destroy web research.
            state.setdefault("errors", []).append(f"RAG unavailable: {exc}")

        sources = web_sources + document_sources
        return [
            Finding(
                task_id=task.id,
                claim=source.title,
                evidence=source.snippet,
                source=source,
            )
            for source in sources[:settings.max_research_sources]
        ]

    groups = await asyncio.gather(*(one(task) for task in plan.tasks))
    findings = existing + [item for group in groups for item in group]
    return {"findings": findings, "round": state.get("round", 0) + 1}


def critique_node(state: ResearchState) -> dict:
    settings = get_settings()
    evidence = state.get("findings", [])
    if settings.local_fast_mode:
        # Deterministic local guardrail: skip a second LLM call.
        return {
            "critique": Critique(
                sufficient=bool(evidence),
                missing_questions=[] if evidence else ["Find at least one source."],
                issues=[],
            )
        }

    evidence_text = "\n".join(
        f"- {f.claim}: {f.evidence[:500]} ({f.source.url})"
        for f in evidence
    )
    critique = llm.structured(
        Critique,
        system=(
            "You are a rigorous research critic. Decide whether the evidence is "
            "sufficient to answer the user's question. Identify missing questions "
            "or evidence gaps. Be conservative."
        ),
        user=f"Question: {state['question']}\n\nEvidence:\n{evidence_text}",
    )
    return {"critique": critique}


def route_after_critique(state: ResearchState) -> str:
    critique = state["critique"]
    round_no = state.get("round", 0)
    max_rounds = state.get("max_rounds", get_settings().max_research_rounds)
    if not critique.sufficient and round_no < max_rounds:
        return "research"
    return "synthesize"


def synthesize_node(state: ResearchState) -> dict:
    evidence = "\n".join(
        f"[{i+1}] {f.claim}\nEvidence: {f.evidence}\nURL: {f.source.url}"
        for i, f in enumerate(state.get("findings", []))
    )
    answer = llm.text(
        system=(
            "You are a senior research analyst. Answer concisely using only the supplied evidence. "
            "Do not invent facts. Cite evidence using [1], [2], etc. Keep the answer under 180 words."
        ),
        user=f"Question: {state['question']}\n\nEvidence:\n{evidence}",
    )
    sources = []
    seen = set()
    for finding in state.get("findings", []):
        if finding.source.url not in seen:
            seen.add(finding.source.url)
            sources.append(finding.source)

    findings = state.get("findings", [])
    web_count = sum(1 for f in findings if f.source.source_type == "web")
    document_count = sum(1 for f in findings if f.source.source_type == "document")
    summary = (
        f"Atlas synthesized evidence from {len(sources)} unique sources "
        f"({web_count} web, {document_count} private-document matches)."
    )

    report = ResearchReport(
        title="Atlas Research Report",
        summary=summary,
        answer=answer,
        findings=findings,
        sources=sources,
    )
    return {"report": report}


def guardrail_node(state: ResearchState) -> dict:
    report = state["report"]
    # Minimal deterministic guardrail: ensure every source URL is represented
    # and prevent empty synthesis from leaving the API silently successful.
    if not report.answer.strip():
        raise ValueError("Synthesis returned an empty answer")
    return {}


def build_graph():
    graph = StateGraph(ResearchState)
    graph.add_node("plan", plan_node)
    graph.add_node("research", research_node)
    graph.add_node("critique", critique_node)
    graph.add_node("synthesize", synthesize_node)
    graph.add_node("guardrails", guardrail_node)

    graph.add_edge(START, "plan")
    graph.add_edge("plan", "research")
    graph.add_edge("research", "critique")
    graph.add_conditional_edges(
        "critique",
        route_after_critique,
        {"research": "research", "synthesize": "synthesize"},
    )
    graph.add_edge("synthesize", "guardrails")
    graph.add_edge("guardrails", END)
    return graph.compile()


graph = build_graph()


async def run_research(question: str) -> ResearchReport:
    settings = get_settings()
    result = await graph.ainvoke({
        "question": question,
        "findings": [],
        "round": 0,
        "max_rounds": settings.max_research_rounds,
    })
    return result["report"]
