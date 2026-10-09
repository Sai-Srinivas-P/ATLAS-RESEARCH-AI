from __future__ import annotations

import hashlib
from functools import lru_cache

from qdrant_client import QdrantClient, models

from .config import get_settings
from .models import Source


@lru_cache(maxsize=2)
def _embedding_model(model_name: str):
    from fastembed import TextEmbedding
    return TextEmbedding(model_name=model_name)


class VectorStore:
    """Qdrant-backed local RAG using FastEmbed."""

    def __init__(self) -> None:
        settings = get_settings()
        self.settings = settings
        self.client = QdrantClient(url=settings.qdrant_url)
        self.embeddings = _embedding_model(settings.embedding_model)

    def _embed(self, texts: list[str]) -> list[list[float]]:
        return [vector.tolist() for vector in self.embeddings.embed(texts)]

    def ensure_collection(self) -> None:
        collections = {c.name for c in self.client.get_collections().collections}
        if self.settings.qdrant_collection not in collections:
            self.client.create_collection(
                collection_name=self.settings.qdrant_collection,
                vectors_config=models.VectorParams(
                    size=self.settings.embedding_dimensions,
                    distance=models.Distance.COSINE,
                ),
            )

    def add_documents(self, filename: str, chunks: list[str]) -> int:
        self.ensure_collection()
        vectors = self._embed(chunks)
        points = []
        for index, (chunk, vector) in enumerate(zip(chunks, vectors)):
            digest = hashlib.sha256(f"{filename}:{index}:{chunk}".encode()).hexdigest()
            points.append(
                models.PointStruct(
                    id=digest[:32],
                    vector=vector,
                    payload={"filename": filename, "chunk_index": index, "text": chunk},
                )
            )
        self.client.upsert(collection_name=self.settings.qdrant_collection, points=points)
        return len(points)

    def search(self, query: str, limit: int | None = None) -> list[Source]:
        self.ensure_collection()
        vector = self._embed([query])[0]
        hits = self.client.query_points(
            collection_name=self.settings.qdrant_collection,
            query=vector,
            limit=limit or self.settings.rag_top_k,
            with_payload=True,
        ).points
        query_terms = set(query.lower().split())
        ranked = []
        for hit in hits:
            payload = hit.payload or {}
            text = str(payload.get("text", ""))
            overlap = sum(term in text.lower() for term in query_terms)
            score = float(hit.score or 0) + min(overlap, 8) * 0.01
            ranked.append((score, payload))
        ranked.sort(key=lambda item: item[0], reverse=True)
        return [
            Source(
                title=f"{payload.get('filename', 'document')} · chunk {payload.get('chunk_index', 0)}",
                url=f"document://{payload.get('filename', 'unknown')}",
                snippet=str(payload.get("text", ""))[:1800],
                source_type="document",
            )
            for _, payload in ranked
        ]

    def list_documents(self) -> list[dict[str, int | str]]:
        self.ensure_collection()
        counts: dict[str, int] = {}
        offset = None
        while True:
            records, offset = self.client.scroll(
                collection_name=self.settings.qdrant_collection,
                limit=256,
                offset=offset,
                with_payload=["filename"],
                with_vectors=False,
            )
            for record in records:
                filename = str((record.payload or {}).get("filename", "unknown"))
                counts[filename] = counts.get(filename, 0) + 1
            if offset is None:
                break
        return [{"filename": name, "chunks": count} for name, count in sorted(counts.items())]

    def delete_document(self, filename: str) -> int:
        self.ensure_collection()
        ids: list[str] = []
        offset = None
        while True:
            records, offset = self.client.scroll(
                collection_name=self.settings.qdrant_collection,
                limit=256,
                offset=offset,
                with_payload=["filename"],
                with_vectors=False,
            )
            ids.extend(
                record.id for record in records
                if (record.payload or {}).get("filename") == filename
            )
            if offset is None:
                break
        if ids:
            self.client.delete(
                collection_name=self.settings.qdrant_collection,
                points_selector=models.PointIdsList(points=ids),
            )
        return len(ids)


def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    cleaned = " ".join(text.split())
    if not cleaned:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = min(start + chunk_size, len(cleaned))
        chunk = cleaned[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(cleaned):
            break
        start = max(0, end - overlap)
    return chunks


def extract_pdf(file_bytes: bytes) -> str:
    from io import BytesIO

    from pypdf import PdfReader
    reader = PdfReader(BytesIO(file_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def ingest_file(filename: str, file_bytes: bytes) -> int:
    settings = get_settings()
    if filename.lower().endswith(".pdf"):
        text = extract_pdf(file_bytes)
    elif filename.lower().endswith((".txt", ".md")):
        text = file_bytes.decode("utf-8", errors="ignore")
    else:
        raise ValueError("Supported files: PDF, TXT, MD")
    chunks = chunk_text(text, settings.chunk_size, settings.chunk_overlap)
    if not chunks:
        raise ValueError("No readable text found in the uploaded file.")
    return VectorStore().add_documents(filename, chunks)
