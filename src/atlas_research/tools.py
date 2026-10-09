from __future__ import annotations

import asyncio

from .models import Source


async def web_search(query: str, limit: int = 5) -> list[Source]:
    """Free metasearch using DDGS. No search API key is required."""
    from ddgs import DDGS

    def search_sync() -> list[dict]:
        return DDGS(timeout=10).text(
            query,
            region="wt-wt",
            safesearch="moderate",
            max_results=limit,
            backend="auto",
        )

    try:
        results = await asyncio.to_thread(search_sync)
    except Exception as exc:  # noqa: BLE001
        return [
            Source(
                title="Web search unavailable",
                url="local://ddgs-error",
                snippet=f"Free web search failed: {exc}",
                source_type="web",
            )
        ]

    return [
        Source(
            title=item.get("title", "Untitled"),
            url=item.get("href", ""),
            snippet=item.get("body", "")[:1500],
            source_type="web",
        )
        for item in results
        if item.get("href")
    ]
