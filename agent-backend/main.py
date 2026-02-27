# agent-backend/main.py
# FastAPI server — exposes HTTP endpoints for the VS Code extension

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agent.loop import run_agent
from openai import AsyncOpenAI
from agent.prompt import INLINE_PROMPT

app = FastAPI(title="VS Code AI Agent Backend")

# CORS middleware — allows the VS Code WebView to call this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Request Models ---

class ChatRequest(BaseModel):
    message: str
    history: list = []
    workspace_path: str = ""

class FileRequest(BaseModel):
    file_content: str
    file_path: str
    instruction: str = "Explain this file"

class InlineRequest(BaseModel):
    code_before_cursor: str
    language: str


# --- Ollama Client for inline suggestions ---

inline_client = AsyncOpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)

# Use mistral for fast inline suggestions (it's snappier for completions)
INLINE_MODEL = "mistral:latest"


# --- Endpoints ---

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "message": "Agent backend is running"}


@app.post("/chat")
async def chat(req: ChatRequest):
    """Chat endpoint — streams responses from the agent."""
    async def stream():
        async for chunk in run_agent(req.message, req.history, req.workspace_path):
            yield chunk
    return StreamingResponse(stream(), media_type="text/plain")


@app.post("/explain-file")
async def explain_file(req: FileRequest):
    """Explain file endpoint — sends file content to the agent."""
    prompt = f"""File: {req.file_path}
```
{req.file_content}
```
{req.instruction}"""

    async def stream():
        async for chunk in run_agent(prompt, []):
            yield chunk
    return StreamingResponse(stream(), media_type="text/plain")


@app.post("/suggest")
async def suggest(req: InlineRequest):
    """Inline suggestion endpoint — fast, no tools, returns a short completion."""
    try:
        resp = await inline_client.chat.completions.create(
            model=INLINE_MODEL,
            messages=[
                {"role": "system", "content": INLINE_PROMPT},
                {
                    "role": "user",
                    "content": f"Language: {req.language}\nCode:\n{req.code_before_cursor}",
                },
            ],
            max_tokens=150,
            temperature=0.2,
        )
        suggestion = resp.choices[0].message.content or ""
        return {"suggestion": suggestion.strip()}
    except Exception as e:
        return {"suggestion": "", "error": str(e)}


# Run with: uvicorn main:app --reload --port 8000
