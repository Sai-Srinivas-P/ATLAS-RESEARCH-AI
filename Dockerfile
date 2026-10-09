FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY pyproject.toml .
COPY src ./src
COPY evals ./evals

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir ".[local,search]"

EXPOSE 8000
CMD ["uvicorn", "atlas_research.api:app", "--host", "0.0.0.0", "--port", "8000"]
