from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # LM Studio exposes an OpenAI-compatible local API.
    lm_studio_url: str = "http://127.0.0.1:1234/v1"
    lm_studio_model: str = "auto"
    lm_studio_api_key: str = "lm-studio"

    max_research_sources: int = 6
    max_research_rounds: int = 1
    request_timeout_seconds: float = 45.0
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    local_fast_mode: bool = True
    lm_studio_max_tokens: int = 500

    qdrant_url: str = "http://127.0.0.1:6333"
    qdrant_collection: str = "atlas_documents_lmstudio"
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_dimensions: int = 384
    rag_top_k: int = 5
    chunk_size: int = 1000
    chunk_overlap: int = 150

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
