// vscode-extension/src/chatPanel.ts
// Sidebar chat WebView UI — Cursor-style premium design

import * as vscode from "vscode";
import { streamChat } from "./agentClient";

const HISTORY_KEY = "myAgent.chatHistory";

export class ChatPanel {
  static currentPanel: ChatPanel | undefined;
  private _panel: vscode.WebviewPanel;
  private _history: any[] = [];
  private _context: vscode.ExtensionContext;

  static createOrShow(ctx: vscode.ExtensionContext): ChatPanel {
    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel._panel.reveal();
      return ChatPanel.currentPanel;
    }
    const panel = vscode.window.createWebviewPanel(
      "myAgentChat",
      "AI Agent Chat",
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    ChatPanel.currentPanel = new ChatPanel(panel, ctx);
    return ChatPanel.currentPanel;
  }

  constructor(panel: vscode.WebviewPanel, ctx: vscode.ExtensionContext) {
    this._panel = panel;
    this._context = ctx;
    this._history = ctx.globalState.get<any[]>(HISTORY_KEY) || [];
    this._panel.webview.html = ChatPanel.getChatHtml();

    if (this._history.length > 0) {
      this._panel.webview.postMessage({ type: "restoreHistory", history: this._history });
    }

    this._panel.onDidDispose(() => {
      ChatPanel.currentPanel = undefined;
    });

    this._panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "userMessage") {
        this._history.push({ role: "user", content: msg.text });
        this._saveHistory();
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
        await this.streamResponse(streamChat(msg.text, this._history, workspacePath));
      } else if (msg.type === "clearChat") {
        this._history = [];
        this._saveHistory();
      } else if (msg.type === "searchFiles") {
        await this._handleFileSearch(msg.query);
      }
    });
  }

  private _saveHistory() {
    this._context.globalState.update(HISTORY_KEY, this._history);
  }

  private async _handleFileSearch(query: string) {
    try {
      const files = await vscode.workspace.findFiles(
        `**/*${query}*`,
        '**/node_modules/**',
        20
      );
      const results = files.map(f => {
        const rel = vscode.workspace.asRelativePath(f);
        return { path: f.fsPath, name: rel };
      });
      this._panel.webview.postMessage({ type: "fileResults", files: results });
    } catch {
      this._panel.webview.postMessage({ type: "fileResults", files: [] });
    }
  }

  async streamResponse(gen: AsyncGenerator<string>) {
    this._panel.webview.postMessage({ type: "startResponse" });
    let fullResponse = "";
    for await (const chunk of gen) {
      fullResponse += chunk;
      this._panel.webview.postMessage({ type: "chunk", text: chunk });
    }
    this._panel.webview.postMessage({ type: "endResponse" });
    this._history.push({ role: "assistant", content: fullResponse });
    this._saveHistory();
  }

  public static getChatHtml(): string {
    return /*html*/`<!DOCTYPE html>
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  :root {
    --bg-primary: #1a1b26;
    --bg-secondary: #16171f;
    --bg-tertiary: #1e1f2e;
    --bg-hover: rgba(255,255,255,0.04);
    --bg-input: #1e1f2e;
    --border: rgba(255,255,255,0.06);
    --border-focus: rgba(120,130,255,0.35);
    --text-primary: #c9cdd6;
    --text-secondary: #8b8fa3;
    --text-muted: #5a5e72;
    --accent: #7c83f7;
    --accent-dim: rgba(124,131,247,0.12);
    --blue-file: #5b9af5;
    --blue-file-bg: rgba(91,154,245,0.1);
    --blue-file-border: rgba(91,154,245,0.2);
    --green: #4ec994;
    --red: #e95f6a;
    --yellow: #e8b95a;
    --code-bg: rgba(0,0,0,0.25);
    --scroll-thumb: rgba(255,255,255,0.08);
    --scroll-hover: rgba(255,255,255,0.14);
  }

  * { margin:0; padding:0; box-sizing:border-box; }

  body {
    font-family: 'Inter', -apple-system, sans-serif;
    font-size: 13px;
    background: var(--bg-primary);
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar { width:6px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:var(--scroll-thumb); border-radius:3px; }
  ::-webkit-scrollbar-thumb:hover { background:var(--scroll-hover); }

  /* ===== MESSAGES AREA ===== */
  #messages {
    flex:1; overflow-y:auto; padding:12px 0;
    display:flex; flex-direction:column; gap:4px;
  }

  /* Welcome */
  .welcome {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:40px 20px; flex:1; animation:fadeIn .4s ease;
  }
  .welcome-glow {
    width:56px; height:56px; border-radius:16px;
    background: linear-gradient(135deg, #7c83f7, #a78bfa);
    display:flex; align-items:center; justify-content:center;
    font-size:22px; color:#fff; margin-bottom:16px;
    box-shadow: 0 0 30px rgba(124,131,247,0.25);
  }
  .welcome h3 { font-size:16px; font-weight:600; color:#e2e4ea; margin-bottom:6px; }
  .welcome p { font-size:12px; color:var(--text-muted); max-width:260px; text-align:center; line-height:1.5; }
  .suggestions { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin-top:16px; max-width:320px; }
  .suggestion-chip {
    background:var(--bg-tertiary); border:1px solid var(--border);
    color:var(--text-secondary); padding:7px 14px; border-radius:20px;
    font-size:11px; font-family:inherit; cursor:pointer;
    transition:all .15s ease; white-space:nowrap;
    display:inline-flex; align-items:center; gap:6px;
  }
  .suggestion-chip svg { width:13px; height:13px; flex-shrink:0; }
  .suggestion-chip:hover { border-color:var(--accent); color:var(--accent); background:var(--accent-dim); }

  /* === User message === */
  .user-msg {
    padding:8px 16px; margin:2px 16px;
    background:var(--bg-tertiary); border:1px solid var(--border);
    border-radius:10px; font-size:13px; line-height:1.6;
    color:var(--text-primary); animation:slideIn .2s ease;
    word-wrap:break-word; overflow-wrap:break-word;
  }

  /* === Agent message === */
  .agent-msg {
    padding:6px 18px; animation:slideIn .2s ease;
  }
  .agent-msg .msg-body { font-size:13px; line-height:1.7; color:var(--text-primary); }
  .agent-msg .msg-body p { margin-bottom:8px; }
  .agent-msg .msg-body p:last-child { margin-bottom:0; }
  .agent-msg .msg-body ul, .agent-msg .msg-body ol { margin:6px 0 6px 18px; }
  .agent-msg .msg-body li { margin-bottom:3px; }
  .agent-msg .msg-body strong { color:#e2e4ea; font-weight:600; }
  .agent-msg .msg-body a { color:var(--blue-file); text-decoration:none; }
  .agent-msg .msg-body a:hover { text-decoration:underline; }

  /* File reference pill */
  .file-ref {
    display:inline-flex; align-items:center; gap:5px;
    padding:4px 10px; margin:3px 0;
    background:var(--bg-tertiary); border:1px solid var(--border);
    border-radius:7px; font-size:12px; color:var(--text-primary);
    cursor:pointer; transition:all .15s ease;
  }
  .file-ref:hover { border-color:var(--blue-file-border); background:var(--blue-file-bg); }
  .file-ref .file-icon { display:flex; align-items:center; }
  .file-ref .file-icon svg { width:14px; height:14px; }
  .file-ref .file-name { font-weight:500; }

  /* Inline code */
  .msg-body code {
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 11.5px;
    background: var(--code-bg);
    padding: 2px 6px;
    border-radius: 4px;
    color: #d4b9f7;
  }

  /* Code block */
  .msg-body pre {
    background: rgba(0,0,0,0.3);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    margin: 8px 0;
    overflow-x: auto;
    font-size: 12px;
    line-height: 1.5;
  }
  .msg-body pre code {
    background:none; padding:0; font-size:12px; color:var(--text-primary);
  }

  /* Feedback row — only on last agent msg */
  .feedback-row {
    display:flex; align-items:center; gap:4px; padding:4px 18px 2px;
  }
  .fb-btn {
    display:inline-flex; align-items:center; gap:4px;
    background:transparent; border:none; color:var(--text-muted);
    font-size:11px; cursor:pointer; padding:3px 6px; border-radius:4px;
    font-family:inherit; transition:all .12s ease;
  }
  .fb-btn:hover { color:var(--text-secondary); background:var(--bg-hover); }
  .fb-btn svg { width:12px; height:12px; }

  /* Tool badge — no box, shimmer on text */
  .tool-badge {
    display:inline-flex; align-items:center; gap:7px;
    padding:4px 18px; margin:2px 0;
    background:transparent; border:none;
    font-size:12px; animation:slideIn .2s ease;
  }
  .tool-badge .tb-icon { display:flex; align-items:center; flex-shrink:0; }
  .tool-badge .tb-icon svg { width:14px; height:14px; }
  .tool-badge .tb-text {
    font-weight:500;
    background: linear-gradient(90deg, var(--text-muted) 0%, var(--text-muted) 35%, #c0c6f7 50%, var(--text-muted) 65%, var(--text-muted) 100%);
    background-size:200% 100%;
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
    animation:textShimmer 2s infinite linear;
  }

  /* Typing indicator */
  .typing-row { padding:14px 18px; animation:fadeIn .3s ease; }
  .typing-dots {
    display:inline-flex; align-items:center; gap:4px; padding:6px 0;
  }
  .typing-dots span {
    width:5px; height:5px; border-radius:50%;
    background:var(--accent); animation:bounce 1.2s infinite ease-in-out;
  }
  .typing-dots span:nth-child(2) { animation-delay:.15s; }
  .typing-dots span:nth-child(3) { animation-delay:.3s; }

  /* ===== MENTION DROPDOWN ===== */
  .mention-dropdown {
    position:absolute; bottom:100%; left:0; right:0;
    max-height:200px; overflow-y:auto;
    background:var(--bg-secondary); border:1px solid var(--border);
    border-radius:10px; margin-bottom:4px;
    box-shadow:0 -8px 30px rgba(0,0,0,0.4);
    display:none; z-index:100;
  }
  .mention-dropdown.visible { display:block; }
  .mention-item {
    display:flex; align-items:center; gap:8px;
    padding:0 12px; height:36px; cursor:pointer; font-size:12px;
    transition:background .08s ease;
    border-left: 2px solid transparent;
  }
  /* The active state is now dynamically added via JS style to match requirement */
  .mention-item-icon { display:flex; align-items:center; flex-shrink:0; width:20px; height:20px; }
  .mention-item-name {
    flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    color:#fff; font-weight:500; font-size:13px;
  }
  .mention-item-path {
    font-size:11px; color:#6b7280; white-space:nowrap;
    overflow:hidden; text-overflow:ellipsis; max-width:160px; text-align:right;
  }

  /* ===== BOTTOM INPUT AREA ===== */
  .input-area {
    background: #1a1a2e;
    flex-shrink: 0; position: relative;
    padding: 12px 16px 20px;
    border-top: none;
  }

  .attached-files { display:flex; flex-wrap:wrap; gap:6px; padding:10px 12px 2px 12px; }
  .attached-files:empty { display:none; padding:0; }
  .attached-file {
    display:inline-flex; align-items:center; gap:4px;
    background:var(--blue-file-bg); border:1px solid var(--blue-file-border);
    border-radius:6px; padding:3px 8px; font-size:11px; color:var(--blue-file);
  }
  .attached-file svg { width:12px; height:12px; flex-shrink:0; }
  .attached-file-remove { cursor:pointer; opacity:.5; font-size:11px; margin-left:2px; transition:opacity .1s; }
  .attached-file-remove:hover { opacity:1; }

  .input-container {
    background: #0d0d1a;
    border: 1px solid #2a2a3e;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    transition: border-color .15s ease;
  }
  .input-container:focus-within { border-color: rgba(124,131,247,0.4); box-shadow: 0 0 0 1px rgba(124,131,247,0.2); }

  #input {
    width: 100%;
    background: transparent; border: none;
    color: #6b7280;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px; line-height: 1.5;
    resize: none; outline: none;
    max-height: 150px; min-height: 24px;
    padding: 10px 12px 4px 12px;
  }
  #input::placeholder { color: #4b5563; }

  /* Bottom toolbar inside input container */
  .bottom-toolbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 8px 8px 8px;
    height: 36px;
  }

  .toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 4px; }

  .icon-btn {
    width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
    background: transparent; border: none; color: #6b7280; cursor: pointer;
    border-radius: 4px; transition: all .12s ease;
  }
  .icon-btn:hover { color: #a1a1aa; background: rgba(255,255,255,0.05); }
  .icon-btn svg { width: 14px; height: 14px; }

  .model-text {
    display: flex; align-items: center; gap: 4px;
    color: #6b7280; font-size: 11px; cursor: pointer;
    background: transparent; border: none; padding: 4px 6px;
    border-radius: 4px; font-family: inherit; transition: color .12s;
  }
  .model-text:hover { color: #a1a1aa; background: rgba(255,255,255,0.05); }
  .model-text svg { width: 10px; height: 10px; opacity: 0.7; }

  .send-btn-round {
    width: 28px; height: 28px; border-radius: 50%; border: none;
    background: #6c63ff; color: #fff; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all .15s ease; flex-shrink: 0; margin-left: 2px;
  }
  .send-btn-round:hover:not(:disabled) { background: #7c73ff; transform: scale(1.05); }
  .send-btn-round:disabled { opacity: 0.4; cursor: not-allowed; }
  .send-btn-round svg { width: 13px; height: 13px; }

  /* Clear chat btn (top right subtle) */
  .clear-float {
    position:fixed; top:8px; right:8px; z-index:50;
    width:28px; height:28px; display:flex; align-items:center; justify-content:center;
    background:transparent; border:1px solid transparent;
    color:var(--text-muted); cursor:pointer; border-radius:6px;
    transition:all .12s ease;
  }
  .clear-float:hover { color:var(--red); background:rgba(233,95,106,0.08); border-color:rgba(233,95,106,0.2); }
  .clear-float svg { width:14px; height:14px; }

  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes slideIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
  @keyframes bounce { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-3px);opacity:1} }
  @keyframes textShimmer { 0%{background-position:100% 0} 100%{background-position:-100% 0} }
</style>
</head>
<body>
  <button class="clear-float" onclick="clearChat()" title="Clear chat">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
  </button>

  <div id="messages">
    <div class="welcome" id="welcome">
      <div class="welcome-glow"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/></svg></div>
      <h3>How can I help?</h3>
      <p>Ask me to read files, write code, run commands, or explain anything in your project.</p>
      <div class="suggestions">
        <button class="suggestion-chip" onclick="useSuggestion('Explain this project structure')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> Explain project</button>
        <button class="suggestion-chip" onclick="useSuggestion('Read and explain main.py')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Read a file</button>
        <button class="suggestion-chip" onclick="useSuggestion('Find all TODO comments')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Find TODOs</button>
        <button class="suggestion-chip" onclick="useSuggestion('List all files in this directory')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14h6"/><path d="M9 18h6"/><path d="M9 10h6"/></svg> List files</button>
      </div>
    </div>
  </div>

  <div class="input-area">
    <div class="mention-dropdown" id="mentionDropdown"></div>
    <div class="input-container">
      <div class="attached-files" id="attachedFiles"></div>
      <textarea id="input" rows="1" placeholder="Ask anything, @ to mention, / for workflows"></textarea>
      <div class="bottom-toolbar">
        <div class="toolbar-left">
          <button class="icon-btn" title="Attach context" onclick="/* Attach context handler */">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button class="model-text">
            Fast
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
        <div class="toolbar-right">
          <button class="icon-btn" title="Voice input">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
          </button>
          <button class="send-btn-round" id="sendBtn" onclick="send()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const msgs = document.getElementById("messages");
    const inputEl = document.getElementById("input");
    const sendBtn = document.getElementById("sendBtn");
    const welcome = document.getElementById("welcome");
    const mentionDropdown = document.getElementById("mentionDropdown");
    const attachedFilesEl = document.getElementById("attachedFiles");

    let currentBody = null;
    let isStreaming = false;
    let mentionActive = false;
    let mentionQuery = "";
    let mentionStartPos = -1;
    let mentionFiles = [];
    let mentionIndex = 0;
    let attachedFiles = [];

    const FILE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#5b9af5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>';
    const GEAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#5b9af5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>';

    inputEl.addEventListener("input", () => {
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + "px";
      handleMentionInput();
    });

    function hideWelcome() { if (welcome) welcome.style.display = "none"; }

    function escapeHtml(text) {
      const d = document.createElement("div");
      d.textContent = text;
      return d.innerHTML;
    }

    function formatMarkdown(text) {
      let html = escapeHtml(text);
      html = html.replace(/\`\`\`(\\w*)?\\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>');
      html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
      html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
      html = html.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
      html = html.replace(/\\n/g, '<br>');
      return html;
    }

    function useSuggestion(text) {
      inputEl.value = text;
      inputEl.focus();
      send();
    }

    // ===== MENTION =====
    function handleMentionInput() {
      const val = inputEl.value;
      const cursorPos = inputEl.selectionStart;
      const beforeCursor = val.substring(0, cursorPos);
      const atIdx = beforeCursor.lastIndexOf("@");
      if (atIdx >= 0) {
        const charBefore = atIdx > 0 ? val[atIdx - 1] : " ";
        if (charBefore === " " || charBefore === "\\n" || atIdx === 0) {
          const query = beforeCursor.substring(atIdx + 1);
          if (query.includes(" ")) { closeMention(); return; }
          mentionActive = true;
          mentionStartPos = atIdx;
          mentionQuery = query;
          mentionIndex = 0;
          vscode.postMessage({ type: "searchFiles", query });
          return;
        }
      }
      closeMention();
    }

    function closeMention() {
      mentionActive = false;
      mentionDropdown.classList.remove("visible");
    }

    function getFileIconUri(filename) {
      const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
      let icon = 'document';
      switch (ext) {
        case 'ts': icon = 'typescript'; break;
        case 'tsx': icon = 'react_ts'; break;
        case 'js': icon = 'javascript'; break;
        case 'jsx': icon = 'react'; break;
        case 'py': icon = 'python'; break;
        case 'css': icon = 'css'; break;
        case 'html': icon = 'html'; break;
        case 'json': icon = 'json'; break;
        case 'md': icon = 'markdown'; break;
        case 'svg': icon = 'svg'; break;
        case 'rs': icon = 'rust'; break;
        case 'go': icon = 'go'; break;
        case 'yaml': case 'yml': icon = 'yaml'; break;
        case 'toml': case 'config': icon = 'settings'; break;
      }
      return 'https://cdn.jsdelivr.net/gh/PKief/vscode-material-icon-theme@main/icons/' + icon + '.svg';
    }

    function getFileIconHtml(filename) {
      return '<img src="' + getFileIconUri(filename) + '" style="width:16px;height:16px;object-fit:contain;flex-shrink:0;" alt="file-icon" />';
    }

    function renderMentionDropdown(files) {
      mentionFiles = files;
      mentionDropdown.innerHTML = "";
      if (files.length === 0) { closeMention(); return; }
      files.forEach((f, idx) => {
        const item = document.createElement("div");
        item.className = "mention-item";
        const fileName = f.name.split("/").pop();
        const dirPath = f.name.split("/").slice(0, -1).join("/");
        item.innerHTML =
          '<span class="mention-item-icon">' + getFileIconHtml(f.name) + '</span>' +
          '<span class="mention-item-name">' + escapeHtml(fileName) + '</span>' +
          '<span class="mention-item-path">' + escapeHtml(dirPath || f.name) + '</span>';
        
        // Mouse hover syncs with index for unified styling
        item.addEventListener("mouseenter", () => {
          mentionIndex = idx;
          updateHighlight();
        });
        item.onclick = () => selectMention(f);
        mentionDropdown.appendChild(item);
      });
      mentionDropdown.classList.add("visible");
      updateHighlight();
    }

    function updateHighlight() {
      const items = mentionDropdown.querySelectorAll('.mention-item');
      items.forEach((el, i) => {
        if (i === mentionIndex) {
          el.style.background = 'rgba(255,255,255,0.08)';
          el.style.borderLeft = '2px solid #6c63ff';
          // Scroll into view if needed
          el.scrollIntoView({ block: 'nearest' });
        } else {
          el.style.background = '';
          el.style.borderLeft = '2px solid transparent';
        }
      });
    }

    function selectMention(file) {
      const val = inputEl.value;
      const before = val.substring(0, mentionStartPos);
      const after = val.substring(inputEl.selectionStart);
      inputEl.value = before + after;
      inputEl.focus();
      closeMention();
      if (!attachedFiles.find(f => f.path === file.path)) {
        attachedFiles.push(file);
        renderAttachedFiles();
      }
    }

    function renderAttachedFiles() {
      attachedFilesEl.innerHTML = "";
      attachedFiles.forEach((f, idx) => {
        const tag = document.createElement("div");
        tag.className = "attached-file";
        tag.innerHTML = getFileIconHtml(f.name) + ' ' + escapeHtml(f.name.split("/").pop()) +
          '<span class="attached-file-remove" onclick="removeAttached(' + idx + ')">✕</span>';
        attachedFilesEl.appendChild(tag);
      });
    }

    function removeAttached(idx) {
      attachedFiles.splice(idx, 1);
      renderAttachedFiles();
    }

    // ===== MESSAGES =====
    function addMessage(role, text, animate) {
      hideWelcome();

      if (role === "user") {
        const el = document.createElement("div");
        el.className = "user-msg";
        if (!animate) el.style.animation = "none";
        el.textContent = text;
        msgs.appendChild(el);
        msgs.scrollTop = msgs.scrollHeight;
        return el;
      } else {
        const el = document.createElement("div");
        el.className = "agent-msg";
        if (!animate) el.style.animation = "none";
        el.innerHTML = '<div class="msg-body"></div>';
        const body = el.querySelector(".msg-body");
        if (text) body.innerHTML = formatMarkdown(text);
        msgs.appendChild(el);
        msgs.scrollTop = msgs.scrollHeight;
        return el;
      }
    }

    function addFeedbackRow() {
      const row = document.createElement("div");
      row.className = "feedback-row";
      row.innerHTML =
        '<button class="fb-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 00-6 0v1H5a2 2 0 00-2 2v11a2 2 0 002 2h11.28a2 2 0 001.9-1.37l2.2-6.6A2 2 0 0019.47 9H14z"/></svg> Good</button>' +
        '<button class="fb-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 006 0v-1h3a2 2 0 002-2V5a2 2 0 00-2-2H7.72a2 2 0 00-1.9 1.37l-2.2 6.6A2 2 0 004.53 15H10z"/></svg> Bad</button>';
      msgs.appendChild(row);
    }

function addToolBadge(text) {
  const badge = document.createElement("div");
  badge.className = "tool-badge";
  badge.innerHTML = '<span class="tb-icon">' + FILE_SVG + '</span><span class="tb-text">' + escapeHtml(text) + '</span>';
  msgs.appendChild(badge);
  msgs.scrollTop = msgs.scrollHeight;
}

function showTyping() {
  const div = document.createElement("div");
  div.className = "typing-row"; div.id = "typing";
  div.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById("typing");
  if (t) t.remove();
}

function send() {
  const t = inputEl.value.trim();
  if (!t && attachedFiles.length === 0) return;
  if (isStreaming) return;

  let fullMessage = t;
  if (attachedFiles.length > 0) {
    const fileList = attachedFiles.map(f => f.path).join(", ");
    fullMessage = "[Attached files: " + fileList + "]\\n\\n" + t;
  }

  addMessage("user", t, true);

  if (attachedFiles.length > 0) {
    const tagsDiv = document.createElement("div");
    tagsDiv.style.cssText = "display:flex;gap:4px;flex-wrap:wrap;padding:0 18px 8px;";
    attachedFiles.forEach(f => {
      const tag = document.createElement("span");
      tag.className = "file-ref";
      tag.innerHTML = '<span class="file-icon">' + getFileIconHtml(f.name) + '</span><span class="file-name">' + escapeHtml(f.name.split("/").pop()) + '</span>';
      tagsDiv.appendChild(tag);
    });
    msgs.appendChild(tagsDiv);
  }

  vscode.postMessage({ type: "userMessage", text: fullMessage });
  inputEl.value = "";
  inputEl.style.height = "auto";
  attachedFiles = [];
  renderAttachedFiles();
  inputEl.focus();
}

function clearChat() {
  msgs.innerHTML =
    '<div class="welcome" id="welcome">' +
    '<div class="welcome-glow"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/></svg></div>' +
    '<h3>How can I help?</h3>' +
    '<p>Ask me to read files, write code, run commands, or explain anything in your project.</p>' +
    '<div class="suggestions">' +
    '<button class="suggestion-chip" onclick="useSuggestion(\\\'Explain this project structure\\\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> Explain project</button>' +
    '<button class="suggestion-chip" onclick="useSuggestion(\\\'Read and explain main.py\\\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Read a file</button>' +
    '<button class="suggestion-chip" onclick="useSuggestion(\\\'Find all TODO comments\\\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Find TODOs</button>' +
    '<button class="suggestion-chip" onclick="useSuggestion(\\\'List all files in this directory\\\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14h6"/><path d="M9 18h6"/><path d="M9 10h6"/></svg> List files</button>' +
    '</div>' +
    '</div>';
  vscode.postMessage({ type: "clearChat" });
}

window.addEventListener("message", e => {
  const data = e.data;
  if (data.type === "restoreHistory") {
    msgs.innerHTML = "";
    if (data.history.length === 0) return;
    hideWelcome();
    data.history.forEach(m => addMessage(m.role, m.content, false));
    msgs.scrollTop = msgs.scrollHeight;
  } else if (data.type === "fileResults") {
    if (mentionActive) renderMentionDropdown(data.files);
  } else if (data.type === "startResponse") {
    isStreaming = true;
    sendBtn.disabled = true;
    showTyping();
  } else if (data.type === "chunk" && !currentBody) {
    removeTyping();
    if (data.text.startsWith("[TOOL]")) {
      addToolBadge(data.text.replace("[TOOL] ", ""));
      return;
    }
    const agentBlock = addMessage("agent", "", true);
    currentBody = agentBlock.querySelector(".msg-body");
    currentBody.setAttribute("data-raw", data.text);
    currentBody.innerHTML = formatMarkdown(data.text);
  } else if (data.type === "chunk" && currentBody) {
    if (data.text.startsWith("[TOOL]")) {
      currentBody = null;
      addToolBadge(data.text.replace("[TOOL] ", ""));
      return;
    }
    const raw = (currentBody.getAttribute("data-raw") || "") + data.text;
    currentBody.setAttribute("data-raw", raw);
    currentBody.innerHTML = formatMarkdown(raw);
    msgs.scrollTop = msgs.scrollHeight;
  } else if (data.type === "endResponse") {
    removeTyping();
    if (currentBody) addFeedbackRow();
    currentBody = null;
    isStreaming = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
});

inputEl.addEventListener("keydown", e => {
  if (mentionActive && mentionDropdown.classList.contains("visible")) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      mentionIndex = (mentionIndex + 1) % mentionFiles.length;
      updateHighlight();
      return;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      mentionIndex = (mentionIndex - 1 + mentionFiles.length) % mentionFiles.length;
      updateHighlight();
      return;
    } else if ((e.key === "Enter" || e.key === "Tab") && mentionFiles.length > 0 && mentionIndex >= 0) {
      e.preventDefault();
      selectMention(mentionFiles[mentionIndex]);
      return;
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMention();
      return;
    }
  }
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
});

document.addEventListener("click", e => {
  if (!e.target.closest(".mention-dropdown") && !e.target.closest("#input")) closeMention();
});
</script>
  </body>
  </html>`;
  }
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'myAgent.chatView';
  private _view?: vscode.WebviewView;
  private _history: any[] = [];

  constructor(private readonly _context: vscode.ExtensionContext) {
    this._history = _context.globalState.get<any[]>(HISTORY_KEY) || [];
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = ChatPanel.getChatHtml();

    if (this._history.length > 0) {
      webviewView.webview.postMessage({ type: "restoreHistory", history: this._history });
    }

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "userMessage") {
        this._history.push({ role: "user", content: msg.text });
        this._saveHistory();
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
        await this.streamResponse(streamChat(msg.text, this._history, workspacePath));
      } else if (msg.type === "clearChat") {
        this._history = [];
        this._saveHistory();
      } else if (msg.type === "searchFiles") {
        await this._handleFileSearch(msg.query);
      }
    });
  }

  private _saveHistory() {
    this._context.globalState.update(HISTORY_KEY, this._history);
  }

  private async _handleFileSearch(query: string) {
    try {
      const files = await vscode.workspace.findFiles(`**/*${query}*`, '**/node_modules/**', 20);
      const results = files.map(f => ({ path: f.fsPath, name: vscode.workspace.asRelativePath(f) }));
      this._view?.webview.postMessage({ type: "fileResults", files: results });
    } catch {
      this._view?.webview.postMessage({ type: "fileResults", files: [] });
    }
  }

  async streamResponse(gen: AsyncGenerator<string>) {
    if (!this._view) return;
    this._view.webview.postMessage({ type: "startResponse" });
    let fullResponse = "";
    for await (const chunk of gen) {
      fullResponse += chunk;
      this._view.webview.postMessage({ type: "chunk", text: chunk });
    }
    this._view.webview.postMessage({ type: "endResponse" });
    this._history.push({ role: "assistant", content: fullResponse });
    this._saveHistory();
  }
}
