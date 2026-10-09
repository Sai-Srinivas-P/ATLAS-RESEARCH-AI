from fastapi.testclient import TestClient

from atlas_research.api import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_chat(monkeypatch):
    class FakeLLM:
        def chat(self, messages):
            assert any(message["role"] == "user" for message in messages)
            return "RAG is Retrieval-Augmented Generation."

    class FakeVectorStore:
        def search(self, query, limit=None):
            return []

    monkeypatch.setattr("atlas_research.api.LLM", FakeLLM)
    monkeypatch.setattr("atlas_research.api.VectorStore", FakeVectorStore)

    response = client.post(
        "/chat",
        json={
            "messages": [
                {"role": "user", "content": "What is RAG?"}
            ],
            "use_private_knowledge": True,
        },
    )

    assert response.status_code == 200
    assert response.json()["answer"].startswith("RAG is")


def test_upload_text_document(monkeypatch):
    seen = {}

    def fake_ingest_file(filename, content):
        seen["filename"] = filename
        seen["content"] = content
        return 3

    monkeypatch.setattr("atlas_research.api.ingest_file", fake_ingest_file)

    response = client.post(
        "/documents/upload",
        files={"file": ("notes.txt", b"Useful private research notes.", "text/plain")},
    )

    assert response.status_code == 200
    assert response.json() == {
        "filename": "notes.txt",
        "chunks_indexed": 3,
        "status": "indexed",
    }
    assert seen == {"filename": "notes.txt", "content": b"Useful private research notes."}


def test_upload_normalizes_client_filename(monkeypatch):
    def fake_ingest_file(filename, content):
        assert filename == "notes.txt"
        return 1

    monkeypatch.setattr("atlas_research.api.ingest_file", fake_ingest_file)
    response = client.post(
        "/documents/upload",
        files={"file": (r"C:\\private\\notes.txt", b"hello", "text/plain")},
    )

    assert response.status_code == 200
    assert response.json()["filename"] == "notes.txt"


def test_upload_rejects_unsupported_file_type():
    response = client.post(
        "/documents/upload",
        files={"file": ("notes.docx", b"not supported", "application/octet-stream")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Supported files: PDF, TXT, MD"


def test_upload_rejects_files_over_size_limit(monkeypatch):
    monkeypatch.setattr("atlas_research.api.MAX_UPLOAD_BYTES", 4)
    response = client.post(
        "/documents/upload",
        files={"file": ("notes.txt", b"12345", "text/plain")},
    )

    assert response.status_code == 413
    assert "upload limit" in response.json()["detail"]


def test_upload_reports_unreadable_text(monkeypatch):
    def fake_ingest_file(filename, content):
        raise ValueError("No readable text found in the uploaded file.")

    monkeypatch.setattr("atlas_research.api.ingest_file", fake_ingest_file)
    response = client.post(
        "/documents/upload",
        files={"file": ("empty.txt", b"   ", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "No readable text found in the uploaded file."


def test_cors_allows_local_frontend_on_alternate_port():
    response = client.get(
        "/health",
        headers={"Origin": "http://localhost:3001"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3001"
