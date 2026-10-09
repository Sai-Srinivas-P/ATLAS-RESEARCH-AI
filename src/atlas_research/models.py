from typing import Literal

from pydantic import BaseModel, Field


class Source(BaseModel):
    title: str
    url: str
    snippet: str = ""
    source_type: Literal["web", "document", "database"] = "web"


class ResearchTask(BaseModel):
    id: str
    question: str
    rationale: str


class ResearchPlan(BaseModel):
    objective: str
    tasks: list[ResearchTask] = Field(default_factory=list)


class Finding(BaseModel):
    task_id: str
    claim: str
    evidence: str
    source: Source


class Critique(BaseModel):
    sufficient: bool
    missing_questions: list[str] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)


class ResearchReport(BaseModel):
    title: str
    summary: str
    answer: str
    findings: list[Finding] = Field(default_factory=list)
    sources: list[Source] = Field(default_factory=list)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=12000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=50)
    use_private_knowledge: bool = True


class ChatResponse(BaseModel):
    answer: str
    private_sources: list[Source] = Field(default_factory=list)


class ResearchRequest(BaseModel):
    question: str = Field(min_length=10, max_length=5000)


class ResearchResponse(BaseModel):
    status: str
    report: ResearchReport
    rounds: int


class DocumentIngestResponse(BaseModel):
    filename: str
    chunks_indexed: int
    status: str


class DocumentInfo(BaseModel):
    filename: str
    chunks: int


class DocumentListResponse(BaseModel):
    documents: list[DocumentInfo] = Field(default_factory=list)
