<div align="center">

<h1 align="center">
  <img src="./assets/atlas-research-ai-logo.svg" alt="Atlas Research AI animated wordmark" width="900" />
</h1>

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=22&duration=2800&pause=650&color=5CE1E6&center=true&vCenter=true&width=820&lines=Your+local-first+AI+research+workspace;Chat+with+a+locally+served+LLM;Explore+web+evidence+with+LangGraph;Ground+answers+in+your+own+documents" alt="Animated tagline for Atlas Research AI" />

**A local-first generative AI workspace for chat, evidence-focused research, and private-document retrieval.**

<p>
  <a href="https://github.com/Sai-Srinivas-P/ATLAS_NEXUS_AI"><img src="https://img.shields.io/badge/project-Atlas%20Research%20AI-0b7285?style=for-the-badge" alt="Atlas Research AI" /></a>
  <img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.11+" />
  <img src="https://img.shields.io/badge/Next.js-React-black?style=for-the-badge&logo=next.js" alt="Next.js and React" />
  <img src="https://img.shields.io/badge/FastAPI-API-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/AI-LangGraph%20%2B%20RAG-7c3aed?style=for-the-badge" alt="LangGraph and RAG" />
</p>

[Features](#-what-it-does) · [Architecture](#-architecture) · [Getting Started](#-getting-started) · [API](#-api-reference) · [Troubleshooting](#-troubleshooting)

</div>

---

## ✨ What it does

Atlas Research AI is a **generative AI application** bringing conversational AI, research orchestration, and retrieval-augmented generation (RAG) into one web interface. It can use a model served locally by LM Studio, gather web evidence for research, and retrieve relevant passages from documents added to your own knowledge base.

> **Important distinction:** Atlas Research AI is an application and orchestration layer built around existing language models. It does not claim to be a foundation model trained from scratch.

| Capability | How it works |
|---|---|
| 💬 Conversational chat | Sends conversation messages to a model served through LM Studio's OpenAI-compatible API. |
| 🧠 Research workflow | Uses LangGraph to coordinate planning, evidence gathering, critique, synthesis, and a final guardrail. |
| 🌐 Web research | Uses the optional DDGS search integration to discover web sources. |
| 📚 Private knowledge (RAG) | Ingests PDF, TXT, and Markdown files, chunks content, creates embeddings, and retrieves relevant passages. |
| 🔎 Source-aware answers | Returns source details and evidence alongside research results when sources are available. |
| 🗃️ Vector search | Uses Qdrant to store and search document vectors. |
| ⚡ Local-first inference | Connects to LM Studio so generation can run on your machine with a compatible downloaded model. |
| 🩺 Health checks | Exposes API and LM Studio health endpoints for troubleshooting. |

## 🧰 Technology stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | Python, FastAPI, Uvicorn, Pydantic |
| Research orchestration | LangGraph, LangChain Core |
| Model runtime | LM Studio OpenAI-compatible API |
| Retrieval and vector storage | Qdrant, FastEmbed |
| Document ingestion | pypdf, text chunking, embeddings |
| Web discovery | Optional DDGS search dependency |
| Quality checks | pytest, pytest-asyncio, Ruff |
| Local infrastructure | Docker Compose for Qdrant and optional API container |

## 🏗️ Architecture

The frontend calls the FastAPI backend. The backend routes chat requests to LM Studio and can retrieve private document context from Qdrant. Research requests use a LangGraph workflow, combining web search and private-document retrieval before producing a synthesis.

~~~mermaid
flowchart TD
    U["User"] --> FE["Next.js + React UI"]
    FE --> API["FastAPI backend"]
    API --> CHAT["Chat endpoint"]
    API --> RG["LangGraph research workflow"]
    CHAT --> LLM["LM Studio model API"]
    CHAT -. optional private context .-> Q["Qdrant vector database"]
    RG --> PLAN["Plan"]
    PLAN --> SEARCH["Gather evidence"]
    SEARCH --> WEB["DDGS web search"]
    SEARCH --> Q
    Q <--> EMB["FastEmbed embeddings"]
    WEB --> CRIT["Critique evidence"]
    Q --> CRIT
    CRIT -->|More evidence needed and rounds remain| SEARCH
    CRIT -->|Ready to answer or limit reached| SYN["Synthesize answer"]
    SYN --> LLM
    LLM --> OUT["Answer and sources"]
    OUT --> FE
~~~

### 🔄 Research workflow

~~~mermaid
flowchart LR
    A(["Start"]) --> B["Plan question"]
    B --> C["Gather web and document evidence"]
    C --> D["Critique evidence"]
    D --> E{"Evidence sufficient?"}
    E -->|No, another round is allowed| C
    E -->|Yes or round limit reached| F["Synthesize answer"]
    F --> G["Validate non-empty response"]
    G --> H(["Return report"])
~~~

Fast local mode uses a simpler deterministic plan and critique to reduce extra model calls. With fast mode disabled, the planner and critic can use structured LLM calls. Research depth depends on the configured model, available sources, and research limits.

## 🖥️ Getting Started

### 1. Prerequisites and installation links

Install these tools before running Atlas Research AI:

| Tool | Why you need it | Official download / installation guide |
|---|---|---|
| **Python 3.11+** | Runs the FastAPI backend and AI workflow. | [python.org/downloads](https://www.python.org/downloads/) |
| **Node.js 20.9+** | Runs the Next.js frontend. **npm is included with the Node.js installer**, so you normally do not need to install npm separately. | [nodejs.org/en/download](https://nodejs.org/en/download) |
| **Docker Desktop** | Runs Qdrant locally using Docker Compose. On Linux, Docker Engine with the Compose plugin is also an option. | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **LM Studio** | Downloads and serves the local language model used for chat and research. | [lmstudio.ai](https://lmstudio.ai/) |
| **Git** | Clones the repository and helps manage source changes. | [git-scm.com/downloads](https://git-scm.com/downloads) |

**LM Studio setup:** After installing LM Studio, open it, download a model compatible with your computer, load the model, and start the Local Server. The default server address used by this project is usually `http://127.0.0.1:1234/v1`. See the [LM Studio documentation](https://lmstudio.ai/docs) for help setting up the local server.

**Docker setup:** Install Docker Desktop and launch it before running `docker compose up -d qdrant`. On Windows, Docker Desktop may ask you to enable or install WSL 2. Follow the official Docker setup instructions for your operating system.

Model generation and embedding inference can use significant memory; exact requirements depend on model choice and document sizes.

### 2. Clone the repository

~~~bash
git clone https://github.com/Sai-Srinivas-P/ATLAS_NEXUS_AI.git
cd ATLAS_NEXUS_AI
~~~

### 3. Configure LM Studio and load the project model

**Model used in this project's example configuration: Qwen3-4B.** The root `.env.example` sets `LM_STUDIO_MODEL=qwen/qwen3-4b`, and the model client includes handling for Qwen3 chat behavior.

1. Install and open [LM Studio](https://lmstudio.ai/).
2. Open **Discover** and search for **Qwen3-4B**. Choose a compatible instruct/chat version and a quantization your computer can fit in memory. A smaller quantized build (for example, a Q4 build if available) can be a practical starting point, but performance and memory needs vary by file, context length, and hardware.
3. Download the model and open the **Chat** tab. Use the model loader to select and load the downloaded Qwen3-4B model. Wait for loading to finish, then ask a simple question in LM Studio chat first. If that works, the model itself is running.
4. Open the **Developer** tab and switch on **Start Server**. Keep the default local address and port when possible: `http://127.0.0.1:1234`. Atlas Research AI uses the OpenAI-compatible API base URL `http://127.0.0.1:1234/v1`.
5. Keep LM Studio open, with the model loaded and the server running, while using Atlas Research AI.

**Important model-ID detail:** The identifier sent by LM Studio can vary depending on which model file or preset you downloaded. After you create the root `.env` file in the next step, check `LM_STUDIO_MODEL`. If `qwen/qwen3-4b` does not exactly match the identifier returned by LM Studio, set it to that exact identifier, or use `LM_STUDIO_MODEL=auto` so Atlas Research AI detects the first model listed by the local API. The model must be loaded and the server running either way.

Official guides: [LM Studio getting started](https://lmstudio.ai/docs/app/basics) · [Run LM Studio as a local API server](https://lmstudio.ai/docs/developer/core/server).

### 4. Set up the backend

The following commands use Windows PowerShell. Run them from the repository root.

~~~powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[search,dev]"
Copy-Item .env.example .env
~~~

If PowerShell blocks environment activation, run this in the same terminal, then activate the environment again:

~~~powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
~~~

On macOS or Linux, create the environment using:

~~~bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[search,dev]"
cp .env.example .env
~~~

### 5. Configure environment variables

Review the root **.env** file after copying **.env.example**. These are the current example settings:

~~~dotenv
LM_STUDIO_URL=http://127.0.0.1:1234/v1
LM_STUDIO_MODEL=qwen/qwen3-4b
LM_STUDIO_API_KEY=lm-studio
LM_STUDIO_MAX_TOKENS=500

LOCAL_FAST_MODE=true
MAX_RESEARCH_SOURCES=6
MAX_RESEARCH_ROUNDS=1
REQUEST_TIMEOUT_SECONDS=60

QDRANT_URL=http://127.0.0.1:6333
QDRANT_COLLECTION=atlas_documents_lmstudio

EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
EMBEDDING_DIMENSIONS=384
RAG_TOP_K=5
CHUNK_SIZE=1000
CHUNK_OVERLAP=150

ATLAS_HOST=0.0.0.0
ATLAS_PORT=8000
~~~

Use a model identifier that matches the model loaded in LM Studio. The API key shown above is a local placeholder for compatible clients, not a substitute for securing any network-accessible service.

### 6. Start Qdrant

Start only Qdrant if the backend will run directly on your computer:

~~~bash
docker compose up -d qdrant
~~~

Qdrant's HTTP API should be reachable at http://127.0.0.1:6333. The first embedding operation may download the configured FastEmbed model, so initial document ingestion can take longer and may need internet access.

### 7. Start the backend

Open a terminal at the repository root, activate the virtual environment, and run:

~~~bash
python -m uvicorn atlas_research.api:app --host 127.0.0.1 --port 8000 --reload
~~~

Useful checks:

- API health: http://127.0.0.1:8000/health
- LM Studio connection: http://127.0.0.1:8000/health/lm-studio
- Interactive API docs: http://127.0.0.1:8000/docs

Keep this terminal running.

### 8. Start the frontend

Open a second terminal:

~~~bash
cd frontend
npm install
~~~

Optionally create **frontend/.env.local** with:

~~~dotenv
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
~~~

Then start Next.js:

~~~bash
npm run dev
~~~

Open **http://localhost:3000** in your browser. Keep the frontend, backend, Qdrant, and LM Studio running while using the application.

## ✅ Verify that the model responds

Run these checks after LM Studio has loaded Qwen3-4B and its local server is on, and after you have installed the backend dependencies. Run the Python examples from the repository root with the project's virtual environment activated.

### A. Test LM Studio directly

This first test calls LM Studio's OpenAI-compatible API directly. It lists the model IDs available from the server, selects the first one, sends a short prompt, and prints the generated response.

~~~python
import httpx

base_url = "http://127.0.0.1:1234/v1"
headers = {"Authorization": "Bearer lm-studio"}

with httpx.Client(timeout=60) as client:
    models_response = client.get(f"{base_url}/models")
    models_response.raise_for_status()
    models = models_response.json().get("data", [])

    if not models:
        raise SystemExit(
            "No model was returned. Load Qwen3-4B in LM Studio and start the Local Server."
        )

    model_id = models[0]["id"]
    print("Model reported by LM Studio:", model_id)

    response = client.post(
        f"{base_url}/chat/completions",
        headers=headers,
        json={
            "model": model_id,
            "messages": [
                {"role": "user", "content": "In two sentences, what is Atlas Research AI?"}
            ],
            "temperature": 0,
            "max_tokens": 120,
            "stream": False,
        },
    )
    response.raise_for_status()
    answer = response.json()["choices"][0]["message"]["content"]
    print("\nModel response:\n", answer)
~~~

A successful test prints a model identifier and a non-empty answer. This confirms that the local model API can generate text. It does not yet test the Atlas Research AI backend.

### B. Test the model through the Atlas Research AI API

Start the Atlas Research AI backend as described in step 7 and leave that terminal running. In a second terminal, from the repository root, run:

~~~python
import httpx

base_url = "http://127.0.0.1:8000"

health = httpx.get(f"{base_url}/health/lm-studio", timeout=20)
health.raise_for_status()
print("Atlas Research AI model connection:", health.json())

response = httpx.post(
    f"{base_url}/chat",
    json={
        "messages": [
            {"role": "user", "content": "Briefly explain what Atlas Research AI does."}
        ],
        "use_private_knowledge": False,
    },
    timeout=90,
)
response.raise_for_status()
result = response.json()
print("\nAtlas Research AI response:\n", result["answer"])
~~~

A successful call prints the model ID reported by Atlas Research AI and the generated chat answer. You can also open [the LM Studio health endpoint](http://127.0.0.1:8000/health/lm-studio) in a browser; it should return a JSON object with `"status": "ok"` and the model identifier.

**If it fails:** first send a prompt in LM Studio's own Chat tab. Then confirm the Developer tab's server is on, check `http://127.0.0.1:1234/v1/models`, and make sure `LM_STUDIO_MODEL` in the root `.env` matches the returned model ID, or is set to `auto`. Restart the Atlas Research AI backend after changing `.env`. If LM Studio works directly but the Atlas Research AI test fails, check the backend terminal for the error.

## 🐳 Docker setup

The repository includes a Dockerfile and a Compose configuration for the backend and Qdrant. For a containerized backend, the service URLs must change because 127.0.0.1 inside a container refers to that container.

Before starting the complete Compose stack, set these values in the root **.env** file:

~~~dotenv
LM_STUDIO_URL=http://host.docker.internal:1234/v1
QDRANT_URL=http://qdrant:6333
~~~

Then run:

~~~bash
docker compose up --build
~~~

This starts the API and Qdrant containers. The frontend is not included in Compose, so run it separately using the frontend steps above. On Linux, host.docker.internal may require additional Docker host-gateway configuration. Keep LM Studio's local server running and reachable from the backend container. If the backend runs directly on your computer instead, restore the non-container URLs from **.env.example** and start only Qdrant through Compose.

## 🧪 Tests and code quality

Run from the repository root with development dependencies installed:

~~~bash
python -m pytest -q
python -m ruff check .
~~~

Build the frontend to check the production bundle:

~~~bash
cd frontend
npm run build
~~~

## 🔌 API reference

FastAPI's interactive documentation is available at **/docs** while the backend is running.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /health | Check whether the API is responding. |
| GET | /health/lm-studio | Check whether the model endpoint is reachable. |
| POST | /chat | Generate a conversational response, optionally using private document context. |
| POST | /research | Run the LangGraph research workflow and return a report. |
| POST | /documents/upload | Upload and index a PDF, TXT, or Markdown file. |
| GET | /documents | List indexed documents. |
| DELETE | /documents/{filename} | Delete an indexed document by filename. |

The chat endpoint accepts conversation messages and a **use_private_knowledge** option. The research endpoint accepts a research question. Use **/docs** for the request and response schemas served by the running API version.

## 📁 Project structure

~~~text
ATLAS_NEXUS_AI/
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── package.json
│   └── ...
├── src/
│   └── atlas_research/
│       ├── api.py        # FastAPI routes
│       ├── config.py     # Environment-based settings
│       ├── graph.py      # LangGraph research workflow
│       ├── llm.py        # LM Studio client
│       ├── models.py     # Request and response models
│       ├── rag.py        # Document ingestion and vector search
│       ├── state.py      # Research state
│       └── tools.py      # Web search integration
├── tests/                # Automated tests
├── evals/                # Evaluation assets
├── scripts/              # Helper scripts
├── .env.example          # Safe example configuration
├── Dockerfile
├── docker-compose.yml
└── pyproject.toml
~~~

## 🔐 Privacy and responsible use

- **Local model inference:** when configured as described, prompts are sent to the LM Studio server running on your machine.
- **Web search is not fully offline:** when research uses DDGS, search queries leave your machine and are sent to the configured search provider.
- **Document storage:** indexed chunks and vectors are stored in your configured Qdrant instance. Protect that instance and its storage.
- **Embedding model download:** first use of FastEmbed may download model files.
- **No secrets in Git:** keep real environment values in **.env** and never commit credentials, private documents, or local databases. **.env.example** is the shareable template.
- **Review generated output:** language models can make mistakes. Check citations and source material before relying on research results.

## 🛠️ Troubleshooting

<details>
<summary><strong>LM Studio health check fails</strong></summary>

Confirm that LM Studio's local server is running, the model is loaded, and **LM_STUDIO_URL** points to the correct OpenAI-compatible base URL. Ensure **LM_STUDIO_MODEL** matches the loaded model identifier. For a containerized backend, use the Docker networking address rather than 127.0.0.1.

</details>

<details>
<summary><strong>Qdrant connection errors</strong></summary>

Check that Docker is running and Qdrant is up. For a local backend, use http://127.0.0.1:6333. For the backend container in Compose, use http://qdrant:6333. Check container status with docker compose ps and logs with docker compose logs qdrant.

</details>

<details>
<summary><strong>Frontend cannot reach the API</strong></summary>

Make sure the backend is listening on port 8000 and **NEXT_PUBLIC_API_URL** points to it. Restart the Next.js development server after changing the frontend environment file. Check the browser console and the API docs page for details.

</details>

<details>
<summary><strong>Document ingestion is slow or fails initially</strong></summary>

FastEmbed may download the embedding model on first use. Confirm you have network access for that initial download, enough memory and disk space, a supported PDF, TXT, or Markdown file (up to 25 MB), and a running Qdrant instance. For Docker Compose, the API container is configured to use `http://qdrant:6333`; for a backend running directly on your computer, use `http://127.0.0.1:6333`. Scanned PDFs without an extractable text layer cannot be indexed by the current PDF parser.

</details>

<details>
<summary><strong>Python dependency or command not found errors</strong></summary>

Activate the project's virtual environment before running Python commands. Use python -m pip, python -m pytest, and python -m ruff to run tools from the active environment.

</details>

## 🗺️ Ideas for future development

Potential extensions include richer evaluation reports, configurable research depth in the UI, more ingestion formats, improved source-quality ranking, and optional observability integration. These are future ideas, not claims that those features are already implemented.

## 🤝 Contributing

Contributions and constructive feedback are welcome:

1. Open an issue describing the proposed change or bug.
2. Create a focused branch.
3. Make the change and add or update tests where appropriate.
4. Run the Python tests, Ruff checks, and frontend build.
5. Open a pull request with a clear explanation and screenshots for UI changes.

---

<div align="center">

**Built to make local generative AI more useful, inspectable, and grounded in evidence.** 🧭

<sub>Atlas Research AI · Chat · Research · Retrieval-Augmented Generation</sub>

</div>
