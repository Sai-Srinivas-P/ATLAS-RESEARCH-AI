import asyncio
import json
from pathlib import Path

from atlas_research.graph import run_research


async def main():
    path = Path("evals/questions.jsonl")
    for line in path.read_text().splitlines():
        case = json.loads(line)
        report = await run_research(case["question"])
        text = report.answer.lower()
        hits = [topic for topic in case["expected_topics"] if topic.lower() in text]
        score = len(hits) / max(1, len(case["expected_topics"]))
        print(f"{case['id']}: topic_coverage={score:.2f} hits={hits}")


if __name__ == "__main__":
    asyncio.run(main())
