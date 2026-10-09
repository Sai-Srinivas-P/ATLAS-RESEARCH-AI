install:
	pip install -e ".[dev,openai,search]"

run:
	uvicorn atlas_research.api:app --reload

test:
	pytest -q

lint:
	ruff check .

eval:
	python scripts/run_eval.py
