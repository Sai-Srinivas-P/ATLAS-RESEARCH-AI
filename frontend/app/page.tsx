"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Source = {
  title: string;
  url: string;
  snippet: string;
  source_type?: "web" | "document" | "database";
};

type Finding = {
  task_id: string;
  claim: string;
  evidence: string;
  source: Source;
};

type DocumentInfo = { filename: string; chunks: number };

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  privateSources?: Source[];
};

type Report = {
  title: string;
  summary: string;
  answer: string;
  findings: Finding[];
  sources: Source[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const SUPPORTED_UPLOAD_EXTENSIONS = new Set(["pdf", "txt", "md"]);

const demoReport: Report = {
  title: "Demo Research Report",
  summary: "Atlas synthesized evidence from 4 unique sources (3 web, 1 private-document match).",
  answer:
    "Atlas decomposes a difficult question into explicit tasks, retrieves evidence from live web sources and private documents, checks evidence coverage, and produces a citation-grounded synthesis. The workflow is designed so a recruiter can inspect not only the final answer, but also where the answer came from.",
  findings: [
    {
      task_id: "demo-1",
      claim: "Planner-first research reduces blind generation",
      evidence:
        "Breaking a broad question into explicit research tasks creates a visible plan and makes missing evidence easier to detect.",
      source: {
        title: "LangGraph documentation",
        url: "https://langchain-ai.github.io/langgraph/",
        snippet: "Stateful orchestration for long-running agent workflows.",
        source_type: "web",
      },
    },
    {
      task_id: "demo-2",
      claim: "Private retrieval can ground domain-specific answers",
      evidence:
        "Relevant document chunks can be retrieved from a local vector store and supplied alongside live web evidence.",
      source: {
        title: "Private knowledge base",
        url: "document://demo-research-notes.md",
        snippet: "Local document evidence retrieved from Qdrant.",
        source_type: "document",
      },
    },
  ],
  sources: [
    {
      title: "LangGraph",
      url: "https://langchain-ai.github.io/langgraph/",
      snippet: "Agent orchestration and durable execution.",
      source_type: "web",
    },
    {
      title: "Atlas Research AI",
      url: "#architecture",
      snippet: "Original project architecture.",
      source_type: "web",
    },
  ],
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadError, setUploadError] = useState("");
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [apiStatus, setApiStatus] = useState<"checking" | "ready" | "offline">("checking");
  const [researchTime, setResearchTime] = useState<number | null>(null);
  const [mode, setMode] = useState<"chat" | "research">("chat");
  const [chatMessages, setChatMessages] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [usePrivateKnowledge, setUsePrivateKnowledge] = useState(true);

  async function refreshDocuments() {
    setLoadingDocs(true);
    try {
      const response = await fetch(`${API_URL}/documents`, { cache: "no-store" });
      if (!response.ok) throw new Error("Document index unavailable");
      const payload = await response.json();
      setDocuments(payload.documents ?? []);
    } catch {
      setDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  }

  useEffect(() => {
    async function checkHealth() {
      try {
        const [api, lm] = await Promise.all([
          fetch(`${API_URL}/health`, { cache: "no-store" }),
          fetch(`${API_URL}/health/lm-studio`, { cache: "no-store" }),
        ]);
        setApiStatus(api.ok && lm.ok ? "ready" : "offline");
      } catch {
        setApiStatus("offline");
      }
    }
    checkHealth();
    refreshDocuments();
  }, []);

  const sourceStats = useMemo(() => {
    const sources = report?.sources ?? [];
    return {
      total: sources.length,
      web: sources.filter((s) => (s.source_type ?? "web") === "web").length,
      docs: sources.filter((s) => s.source_type === "document").length,
    };
  }, [report]);

  async function runResearch(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError("");
    setReport(null);
    setResearchTime(null);

    const startedAt = performance.now();

    try {
      const response = await fetch(`${API_URL}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Research request failed.");
      setReport(payload.report);
      setResearchTime((performance.now() - startedAt) / 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to the Atlas API.");
    } finally {
      setLoading(false);
    }
  }

  async function sendChat(event?: FormEvent) {
    event?.preventDefault();
    const message = chatInput.trim();
    if (!message || chatLoading) return;

    const nextMessages: ChatTurn[] = [
      ...chatMessages,
      { role: "user", content: message },
    ];

    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          use_private_knowledge: usePrivateKnowledge,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || "Chat request failed.");
      }

      setChatMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: payload.answer,
          privateSources: payload.private_sources ?? [],
        },
      ]);
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : "Could not connect to the Atlas API.";
      setError(messageText);
      setChatMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: `I couldn't complete that request. ${messageText}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function clearChat() {
    setChatMessages([]);
    setChatInput("");
    setError("");
  }

  function researchCurrentChat() {
    const latestUser = [...chatMessages].reverse().find((message) => message.role === "user");
    if (!latestUser) return;
    setQuestion(latestUser.content);
    setMode("research");
    window.setTimeout(() => {
      document.getElementById("research-workspace")?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  }

  async function uploadDocument(file: File) {
    setUploadStatus("");
    setUploadError("");

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!SUPPORTED_UPLOAD_EXTENSIONS.has(extension)) {
      setUploadError("Unsupported file type. Choose a PDF, TXT, or Markdown (.md) file.");
      return;
    }
    if (file.size === 0) {
      setUploadError("This file is empty. Choose a file that contains readable text.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("File is larger than 25 MB. Choose a smaller file and try again.");
      return;
    }

    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    setUploadStatus(`Uploading ${file.name}…`);

    try {
      let response: Response;
      try {
        response = await fetch(`${API_URL}/documents/upload`, {
          method: "POST",
          body: form,
        });
      } catch {
        throw new Error(
          `Could not reach the Atlas API at ${API_URL}. Check that the backend is running and that the frontend API URL and CORS settings are correct.`,
        );
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = typeof payload.detail === "string" ? payload.detail : `Upload failed (HTTP ${response.status}).`;
        throw new Error(detail);
      }

      setUploadStatus(`${payload.filename} indexed · ${payload.chunks_indexed} chunks ready for RAG`);
      await refreshDocuments();
    } catch (err) {
      setUploadStatus("");
      setUploadError(err instanceof Error ? err.message : "Upload failed. Check the API and Qdrant logs.");
    } finally {
      setUploading(false);
    }
  }

  async function deleteDocument(filename: string) {
    if (!window.confirm(`Remove ${filename} from Atlas private knowledge?`)) return;
    try {
      const response = await fetch(`${API_URL}/documents/${encodeURIComponent(filename)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Delete failed.");
      setUploadStatus(`${filename} removed · ${payload.chunks_deleted} chunks deleted`);
      await refreshDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove document.");
    }
  }

  function loadDemo() {
    setQuestion("Compare RAG and fine-tuning for enterprise knowledge systems. Explain when each approach is preferable and cite your sources.");
    setReport(demoReport);
    setMode("research");
    setError("");
    window.setTimeout(() => {
      document.getElementById("research-workspace")?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  }

  return (
    <main>
      <nav className="nav shell">
        <a className="brand" href="#"><span className="brand-mark">A</span><span>ATLAS<span>/RESEARCH</span></span></a>
        <div className="nav-links">
          <a href="#product">Product</a><a href="#architecture">Architecture</a><a href="#stack">Stack</a><a href="#research">Try it</a>
        </div>
        <div className={`system-status ${apiStatus}`}><span />{apiStatus === "ready" ? "LOCAL STACK READY" : apiStatus === "offline" ? "STACK OFFLINE" : "CHECKING STACK"}</div><a className="nav-cta" href="#research">Open Atlas ↗</a>
      </nav>

      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse" />GENAI / CHAT / DEEP RESEARCH / AGENTIC RAG</div>
          <h1>Research that<br /><em>shows its work.</em></h1>
          <p className="hero-text">Atlas combines a fast conversational assistant with structured deep research, private knowledge retrieval, critical review, and citation-grounded reports.</p>
          <div className="hero-actions">
            <a className="button primary" href="#research">Start with Atlas <span>→</span></a>
            <button className="button ghost" onClick={loadDemo}>View a live demo</button>
          </div>
          <div className="hero-metrics">
            <div><strong>05</strong><span>workflow stages</span></div>
            <div><strong>2</strong><span>evidence channels</span></div>
            <div><strong>0</strong><span>paid APIs required</span></div>
          </div>
        </div>

        <div className="hero-terminal">
          <div className="terminal-top"><div className="dots"><i /><i /><i /></div><span>atlas.run</span><span className="live">LOCAL / LIVE</span></div>
          <div className="terminal-body">
            <p><span className="cyan">$</span> atlas research</p>
            <p className="dim"> question: "enterprise RAG vs fine-tuning"</p>
            <div className="trace"><span className="trace-no">01</span><span>planning</span><b>done</b></div>
            <div className="trace"><span className="trace-no">02</span><span>web + private RAG</span><b>retrieved</b></div>
            <div className="trace"><span className="trace-no">03</span><span>evidence critique</span><b>checked</b></div>
            <div className="trace"><span className="trace-no">04</span><span>synthesis</span><b>grounded</b></div>
            <div className="report-preview"><span>REPORT READY</span><strong>Evidence-backed research, not a black box.</strong><small>sources · findings · citations · traceable evidence</small></div>
          </div>
        </div>
      </section>

      <section id="product" className="section shell">
        <div className="section-label">01 / THE PRODUCT</div>
        <div className="two-col">
          <div><h2>A chatbot with a research engine.</h2><p className="lead">Atlas gives you the everyday feel of chat while exposing the engineering underneath: planning, retrieval, evidence quality, failure recovery, and evaluation.</p></div>
          <div className="feature-grid">
            <Feature n="01" title="Plan" text="Decompose ambiguous questions into explicit research tasks." />
            <Feature n="02" title="Research" text="Gather live web evidence and private document matches in one pass." />
            <Feature n="03" title="Critique" text="Check evidence coverage before the final synthesis." />
            <Feature n="04" title="Ground" text="Tie findings back to source evidence and URLs." />
          </div>
        </div>
      </section>

      <section id="architecture" className="architecture section">
        <div className="shell">
          <div className="section-label">02 / SYSTEM DESIGN</div>
          <h2>Five stages. One traceable answer.</h2>
          <div className="pipeline">
            <Pipeline n="01" title="Planner" desc="Question → research tasks" />
            <Pipeline n="02" title="Researchers" desc="Parallel web + private RAG" />
            <Pipeline n="03" title="Critic" desc="Coverage + evidence gaps" />
            <Pipeline n="04" title="Synthesizer" desc="Grounded report generation" />
            <Pipeline n="05" title="Guardrails" desc="Validation before delivery" />
          </div>
        </div>
      </section>

      <section id="research" className="research section shell">
        <div className="section-label">03 / ATLAS WORKSPACE</div>
        <div className="research-head">
          <div>
            <h2>{mode === "chat" ? "Ask Atlas anything." : "Ask a hard question."}</h2>
            <p>
              {mode === "chat"
                ? "Chat naturally with the local model, with optional private-document grounding."
                : "Run the full agent through planning, research, critique, synthesis, and guardrails."}
            </p>
          </div>
          <span className="status"><i /> {apiStatus === "ready" ? "LOCAL STACK READY" : apiStatus === "offline" ? "STACK OFFLINE" : "CHECKING STACK"}</span>
        </div>

        <div className="mode-switch" role="tablist" aria-label="Atlas modes">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "chat"}
            className={`mode-button ${mode === "chat" ? "active" : ""}`}
            onClick={() => setMode("chat")}
          >
            <span>💬</span> Chat
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "research"}
            className={`mode-button ${mode === "research" ? "active" : ""}`}
            onClick={() => setMode("research")}
          >
            <span>🔬</span> Deep Research
          </button>
        </div>

        <div className="upload-box shared-knowledge">
          <div>
            <span className="kicker">PRIVATE KNOWLEDGE</span>
            <strong>Give Atlas your own documents.</strong>
            <p>Upload PDF, TXT or Markdown. Chat can ground answers from these files, while Deep Research combines them with live web evidence.</p>
          </div>
          <div className="upload-controls">
            <button
              type="button"
              className="upload-button"
              onClick={() => uploadInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Indexing…" : "Upload document ↗"}
            </button>
            <input
              ref={uploadInputRef}
              className="upload-file-input"
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              aria-label="Choose a PDF, TXT, or Markdown document"
              disabled={uploading}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void uploadDocument(file);
              }}
            />
            <span className="upload-help">PDF / TXT / MD · MAX 25 MB</span>
          </div>
          {uploadStatus && <span className="upload-status" role="status" aria-live="polite">{uploadStatus}</span>}
          {uploadError && <span className="upload-error" role="alert">{uploadError}</span>}
        </div>

        <div className="knowledge-panel">
          <div className="knowledge-head">
            <div>
              <span className="kicker">INDEXED KNOWLEDGE</span>
              <strong>Your private research corpus</strong>
              <p>Local vector chunks stored in Qdrant. They can be retrieved in Chat and Deep Research.</p>
            </div>
            <span className="knowledge-count">{documents.length} file{documents.length === 1 ? "" : "s"}</span>
          </div>
          {loadingDocs ? (
            <div className="knowledge-empty">Refreshing local index…</div>
          ) : documents.length === 0 ? (
            <div className="knowledge-empty">No private documents indexed yet. Upload a PDF, TXT, or Markdown file above.</div>
          ) : (
            <div className="document-list">
              {documents.map((doc) => (
                <div className="document-row" key={doc.filename}>
                  <div>
                    <strong>{doc.filename}</strong>
                    <span>{doc.chunks} indexed chunks</span>
                  </div>
                  <button className="delete-doc" onClick={() => deleteDocument(doc.filename)}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div id="research-workspace">
          {mode === "chat" ? (
            <section className="chat-panel">
              <div className="chat-toolbar">
                <div>
                  <span className="kicker">ATLAS CHAT</span>
                  <h3>Conversational answers, without leaving your local stack.</h3>
                  <p>Ask follow-ups naturally. Atlas keeps the thread and can optionally ground the latest question in your private Qdrant knowledge base.</p>
                </div>
                <div className="chat-actions">
                  <label className={`private-toggle ${documents.length === 0 ? "disabled" : ""}`}>
                    <input
                      type="checkbox"
                      checked={usePrivateKnowledge && documents.length > 0}
                      disabled={documents.length === 0}
                      onChange={(e) => setUsePrivateKnowledge(e.target.checked)}
                    />
                    <span>Use private knowledge</span>
                  </label>
                  <button type="button" className="button ghost small" onClick={clearChat} disabled={chatLoading || chatMessages.length === 0}>
                    New chat
                  </button>
                  <button type="button" className="button ghost small" onClick={researchCurrentChat} disabled={chatMessages.every((message) => message.role !== "user")}>
                    Deep Research ↗
                  </button>
                </div>
              </div>

              <div className="chat-messages" aria-live="polite">
                {chatMessages.length === 0 ? (
                  <div className="chat-empty">
                    <div className="chat-spark">✦</div>
                    <p>Start a conversation with Atlas.</p>
                    <span>Try “What is RAG?” then ask “Give me a simple example.”</span>
                  </div>
                ) : (
                  chatMessages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
                      <span className="chat-role">{message.role === "user" ? "YOU" : "ATLAS"}</span>
                      <div className="chat-bubble">
                        <div className="chat-text">{message.content}</div>
                        {message.role === "assistant" && (message.privateSources?.length ?? 0) > 0 && (
                          <div className="chat-private-sources">
                            <span className="chat-source-label">PRIVATE CONTEXT</span>
                            <div className="chat-source-list">
                              {message.privateSources?.map((source, sourceIndex) => (
                                <span className="chat-source-pill" key={`${source.url}-${sourceIndex}`}>
                                  {source.title}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {chatLoading && (
                  <div className="chat-message assistant">
                    <span className="chat-role">ATLAS</span>
                    <div className="chat-bubble chat-thinking">
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                      <span>Thinking locally…</span>
                    </div>
                  </div>
                )}
              </div>

              <form className="chat-form" onSubmit={sendChat}>
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendChat();
                    }
                  }}
                  placeholder="Message Atlas..."
                  rows={2}
                  disabled={chatLoading}
                />
                <button className="button primary" type="submit" disabled={chatLoading || !chatInput.trim()}>
                  {chatLoading ? "Thinking..." : "Send →"}
                </button>
              </form>
              <div className="chat-footer-note">
                Chat uses Qwen3 4B through LM Studio. Deep Research remains the multi-stage, evidence-heavy mode.
              </div>
            </section>
          ) : (
            <>
              <form className="research-form" onSubmit={runResearch}>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Compare RAG and fine-tuning for enterprise knowledge systems. Explain when each approach is preferable and cite your sources."
                  rows={4}
                />
                <div className="form-bottom">
                  <span>LangGraph + LM Studio + Qdrant + free web search</span>
                  <div>
                    <button type="button" className="button ghost small" onClick={loadDemo}>Demo result</button>
                    <button className="button primary small" disabled={loading}>
                      {loading ? "Researching..." : "Run research →"}
                    </button>
                  </div>
                </div>
              </form>

              {error && <div className="error-box">{error}</div>}

              {report && (
                <article className="report">
                  <div className="report-header">
                    <div><span className="kicker">RESEARCH OUTPUT</span><h3>{report.title}</h3></div>
                    <div className="report-stats"><span>{sourceStats.total} sources</span><span>{report.findings.length} findings</span></div>
                  </div>

                  <div className="report-overview">
                    <div>
                      <span className="overview-label">EVIDENCE MAP</span>
                      <strong>{sourceStats.web} web</strong>
                      <small>live sources</small>
                    </div>
                    <div>
                      <span className="overview-label">PRIVATE RAG</span>
                      <strong>{sourceStats.docs}</strong>
                      <small>document matches</small>
                    </div>
                    <div>
                      <span className="overview-label">TRACE</span>
                      <strong>5 stages</strong>
                      <small>{researchTime !== null ? `${researchTime.toFixed(1)}s run` : "plan → guardrails"}</small>
                    </div>
                  </div>

                  <div className="research-trace">
                    <div className="trace-header">
                      <div>
                        <span className="overview-label">RESEARCH TRACE</span>
                        <h4>How Atlas reached the answer</h4>
                      </div>
                      {researchTime !== null && <span className="trace-runtime">{researchTime.toFixed(1)}s total</span>}
                    </div>
                    <div className="trace-grid">
                      <TraceStage number="01" title="Planner" description="Question decomposed into research tasks" />
                      <TraceStage number="02" title="Researchers" description={`${sourceStats.web} web · ${sourceStats.docs} private`} />
                      <TraceStage number="03" title="Critic" description="Evidence coverage checked" />
                      <TraceStage number="04" title="Synthesizer" description="Evidence-grounded answer generated" />
                      <TraceStage number="05" title="Guardrails" description="Final response validated" />
                    </div>
                  </div>

                  <div className="report-summary">
                    Atlas synthesized {sourceStats.total} unique sources from {sourceStats.web} web sources and {sourceStats.docs} private-document matches.
                  </div>

                  <div className="answer-block">
                    <span className="overview-label">SYNTHESIS</span>
                    <div className="answer">{report.answer}</div>
                  </div>

                  <div className="findings">
                    <div className="findings-head">
                      <div>
                        <span className="overview-label">EVIDENCE</span>
                        <h4>What Atlas found</h4>
                      </div>
                      <span className="mono-note">{sourceStats.web} web · {sourceStats.docs} private</span>
                    </div>

                    {report.findings.map((finding, index) => {
                      const isPrivate = finding.source.source_type === "document";

                      return (
                        <div className={`finding ${isPrivate ? "finding-private" : ""}`} key={`${finding.task_id}-${finding.source.url}-${index}`}>
                          <span className="finding-index">{String(index + 1).padStart(2, "0")}</span>
                          <div>
                            <div className="finding-title-row">
                              <strong>{finding.claim}</strong>
                              <span className={`source-badge ${isPrivate ? "document" : "web"}`}>{isPrivate ? "PRIVATE" : "WEB"}</span>
                            </div>
                            <details className="evidence-details">
                              <summary>View relevant passage</summary>
                              <p>{finding.evidence}</p>
                            </details>
                            {isPrivate ? (
                              <div className="private-source">
                                <span className="private-icon">◈</span>
                                <span>{finding.source.title}</span>
                                <small>Retrieved from Qdrant</small>
                              </div>
                            ) : (
                              <a href={finding.source.url} target="_blank" rel="noreferrer">{finding.source.title} ↗</a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="source-strip">
                    <span className="overview-label">SOURCE INDEX</span>
                    <div className="source-list">
                      {report.sources.map((source, index) => (
                        <a
                          key={`${source.url}-${index}`}
                          href={source.url.startsWith("http") ? source.url : undefined}
                          target={source.url.startsWith("http") ? "_blank" : undefined}
                          rel={source.url.startsWith("http") ? "noreferrer" : undefined}
                          className="source-pill"
                        >
                          <b>{String(index + 1).padStart(2, "0")}</b>
                          <span>{source.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </article>
              )}
            </>
          )}
        </div>
      </section>

      <section id="stack" className="section shell stack-section">
        <div className="section-label">04 / ENGINEERING STACK</div>
        <h2>Built like an AI system, not a demo script.</h2>
        <div className="stack-grid">
          {[["Orchestration", "LangGraph", "Stateful agent workflow"], ["Models", "LM Studio", "Local Qwen3 generation"], ["Search", "DDGS", "Free live web evidence"], ["Backend", "FastAPI", "Typed API layer"], ["Retrieval", "Qdrant", "Private vector search"], ["Embeddings", "FastEmbed", "Local document embeddings"], ["Frontend", "Next.js", "Recruiter-facing UI"], ["Deploy", "Docker", "Portable infrastructure"]].map(([name, tech, desc]) => <div className="stack-card" key={name}><span>{name}</span><strong>{tech}</strong><p>{desc}</p></div>)}
        </div>
      </section>

      <section className="closing shell"><div><span className="eyebrow">THE POINT</span><h2>Make the model<br /><em>show its work.</em></h2></div><a className="button primary" href="#research">Run Atlas →</a></section>
      <footer className="footer shell"><span>ATLAS / RESEARCH AI</span><span>Deep Research · Agentic RAG · Evidence</span><span>Built for serious GenAI engineering.</span></footer>
    </main>
  );
}

function Feature({ n, title, text }: { n: string; title: string; text: string }) { return <div className="feature"><span>{n}</span><div><strong>{title}</strong><p>{text}</p></div></div>; }
function Pipeline({ n, title, desc }: { n: string; title: string; desc: string }) { return <div className="pipeline-item"><span>{n}</span><strong>{title}</strong><small>{desc}</small></div>; }

function TraceStage({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="trace-stage">
      <div className="trace-stage-top">
        <span className="trace-stage-number">{number}</span>
        <span className="trace-check">✓</span>
      </div>

      <strong>{title}</strong>
      <small>{description}</small>
    </div>
  );
}