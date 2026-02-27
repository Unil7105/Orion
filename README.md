<p align="center">
  <img src="https://img.shields.io/badge/Ollama-Local%20LLM-blueviolet?style=for-the-badge" />
  <img src="https://img.shields.io/badge/VS%20Code-Extension-007ACC?style=for-the-badge&logo=visual-studio-code" />
  <img src="https://img.shields.io/badge/Python-FastAPI-009688?style=for-the-badge&logo=python" />
</p>

# ✦ Orion

**A fully local AI coding agent for VS Code, powered by [Ollama](https://ollama.com).**
No API keys. No cloud. Everything runs privately on your machine.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 💬 **Chat Panel** | Modern chat UI with streaming responses, markdown rendering & typing animations |
| 🔧 **Tool Use** | Agent autonomously reads files, writes code, and runs bash commands |
| 📄 **@File Mentions** | Type `@` to reference workspace files in your conversation |
| ⚡ **Inline Suggestions** | AI code completions via `Cmd+Shift+A` (Mac) / `Ctrl+Shift+A` |
| 📝 **File Explanations** | Instantly explain any open file with one command |
| 💾 **Persistent Chat** | Conversations saved and restored across sessions |
| 🎯 **Quick Actions** | Suggestion chips to get started fast |

---

## 🏗 Architecture

```
Orion/
├── vscode-extension/       # TypeScript — VS Code extension
│   ├── src/
│   │   ├── extension.ts    # Entry point, registers commands
│   │   ├── chatPanel.ts    # Chat UI (WebView)
│   │   └── agentClient.ts  # HTTP client to backend
│   └── package.json
│
├── agent-backend/          # Python — FastAPI server
│   ├── main.py             # API endpoints
│   └── agent/
│       ├── loop.py         # ReAct agent loop
│       ├── prompt.py       # System prompts
│       └── tools.py        # Tool definitions & execution
│
└── .gitignore
```

| Layer | Tech | Role |
|-------|------|------|
| **Frontend** | TypeScript, VS Code WebView | Chat UI, commands, @mentions, inline completions |
| **Backend** | Python, FastAPI | ReAct agent loop, tool execution, streaming |
| **LLM** | Ollama (Llama 3.2) | Local inference, no API keys |

---

## 🚀 Getting Started

### Prerequisites

- **[Ollama](https://ollama.com)** installed and running
- **Node.js** (v18+)
- **Python** (3.10+)

### 1. Pull a model

```bash
ollama pull llama3.2
```

### 2. Start the backend

```bash
cd agent-backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

### 3. Launch the extension

```bash
cd vscode-extension
npm install
```

1. Open the `vscode-extension/` folder in VS Code
2. Press **F5** to launch the Extension Development Host
3. Look for the **🤖 AI Agent** icon in the Activity Bar

---

## ⌨️ Commands & Keybindings

| Command | Keybinding | Description |
|---------|------------|-------------|
| `My Agent: Open Chat` | — | Opens the chat panel |
| `My Agent: Explain This File` | — | Explains the current file |
| `My Agent: Suggest Completion` | `Cmd+Shift+A` | Inline AI suggestion at cursor |

---

## 🔧 Configuration

Edit `agent-backend/.env` to customize:

```env
OLLAMA_BASE_URL=http://localhost:11434/v1
```

Change the model in `agent-backend/agent/loop.py`:

```python
DEFAULT_MODEL = "llama3.2:latest"   # or "llama3.1:8b", "mistral:latest", etc.
```

---

## 🛠 Available Tools

The agent has access to these tools during conversation:

| Tool | Description |
|------|-------------|
| `read_file(path)` | Read contents of any file |
| `write_file(path, content)` | Create or overwrite a file |
| `run_bash(command)` | Execute a shell command |

---

## 📄 License

MIT — see [LICENSE](LICENSE)
