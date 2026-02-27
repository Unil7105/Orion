<p align="center">
  <img src="https://img.shields.io/badge/Ollama-Local%20LLM-blueviolet?style=for-the-badge" />
  <img src="https://img.shields.io/badge/VS%20Code-Extension-007ACC?style=for-the-badge&logo=visual-studio-code" />
  <img src="https://img.shields.io/badge/Python-FastAPI-009688?style=for-the-badge&logo=python" />
</p>

# ✦ Orion (Premium Local AI Agent)

**A fully local AI coding agent for VS Code, engineered with a premium Cursor-style minimalist UI. Powered by [Ollama](https://ollama.com).**
No API keys. No cloud. Everything runs privately on your machine.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎨 **Premium UI/UX** | Deep dark navy theme (`#1a1a2e`) mirroring modern editors (Cursor/Copilot), clean floating chat inputs, and text-embedded shimmer animations. |
| 💬 **Context-Aware Chat** | Seamless chat panel with dynamic streaming, smart scroll, and real-time markdown rendering. |
| 🗂️ **Advanced @ Mentions** | Type `@` to invoke a fully keyboard-navigable (`ArrowUp`/`ArrowDown`/`Enter`) file search dropdown. |
| 🖼️ **Authentic File Icons** | Integrates native **VS Code Material Theme Icons** automatically mapping file extensions (`.ts`, `.py`, `.json`, etc.) perfectly mimicking your VS Code sidebar. |
| 🔧 **Tool Use** | Agent autonomously reads/writes files and securely runs terminal commands in your workspace directory. |
| ⚡ **Inline Suggestions** | AI code completions via `Cmd+Shift+A` (Mac) / `Ctrl+Shift+A` |
| 💾 **Persistent Chat** | Conversations saved and restored across sessions, including your pinned contexts. |

---

## 🏗 Architecture

```
Orion/
├── vscode-extension/       # TypeScript — VS Code extension UI
│   ├── src/
│   │   ├── extension.ts    # Entry point, registers commands
│   │   ├── chatPanel.ts    # Webview styling, custom HTML, and listeners
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
| **Frontend** | TypeScript, VS Code WebView | Clean UI, file mentions, tool badges, keyboard listeners |
| **Backend** | Python, FastAPI | ReAct agent loop, workspace path forwarding, tool execution |
| **LLM** | Ollama (Llama 3.2 / Mistral) | Local inference, zero data tracking |

---

## 🚀 Getting Started

### Prerequisites

- **[Ollama](https://ollama.com)** installed and running locally
- **Node.js** (v18+)
- **Python** (3.10+)

### 1. Pull the Models

```bash
ollama pull llama3.2
ollama pull mistral  # Recommended for fast inline suggestions
```

### 2. Start the Backend

```bash
cd agent-backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

You should see:
```text
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

### 3. Launch the Extension

```bash
cd vscode-extension
npm install
npm run compile
```

1. Open the `vscode-extension/` folder in VS Code
2. Press **F5** to launch the Extension Development Host window
3. Look for the **🤖 AI Agent** icon in the left Activity Bar

### 4. Package as a VSIX (Optional)

If you'd like to install the extension permanently in your main VS Code editor instead of running it in a development host:

```bash
cd vscode-extension
npm run compile
npx @vscode/vsce package
```

This will generate a `my-ai-agent-0.0.1.vsix` wrapper.
To install it:
1. Open your VS Code **Extensions** view (`Cmd+Shift+X` or `Ctrl+Shift+X`)
2. Click the `...` menu in the top right corner
3. Select **Install from VSIX...**
4. Choose the generated `.vsix` file!

---

## ⌨️ Commands & Keybindings

| Command | Keybinding | Description |
|---------|------------|-------------|
| `My Agent: Open Chat` | — | Opens the chat webview panel |
| `My Agent: Explain This File` | — | Highlights current active file and explains it |
| `My Agent: Suggest Completion` | `Cmd+Shift+A` | Fast inline AI suggestion at cursor position |

*Pro-tip: When the chat panel is open, use the `@` prefix to attach files. Use `ArrowUp/ArrowDown` and `Enter` to navigate without leaving the keyboard.*

---

## 🔧 Configuration

Edit `agent-backend/.env` to customize your local endpoint:

```env
OLLAMA_BASE_URL=http://localhost:11434/v1
```

Switch out intelligence models in `agent-backend/agent/loop.py`:

```python
DEFAULT_MODEL = "llama3.2:latest"
```

---

## 🛠 Available Tools

The AI continuously spins up thought loops and executes these local commands autonomously:

| Tool | Description |
|------|-------------|
| `read_file(path)` | Analyzes local file contents |
| `write_file(path, content)` | Directly replaces or manipulates code within your active workspace |
| `run_bash(command)` | Safe execution of terminal lines |

---

## 📄 License

MIT — see [LICENSE](LICENSE)
