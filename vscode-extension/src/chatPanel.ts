// vscode-extension/src/chatPanel.ts
// Sidebar chat WebView UI — Modern design with suggestions, alignment, and @mentions

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
    this._panel.webview.html = this._getHtml();

    // Restore previous messages in the UI
    if (this._history.length > 0) {
      this._panel.webview.postMessage({ type: "restoreHistory", history: this._history });
    }

    // Clean up when user closes the panel
    this._panel.onDidDispose(() => {
      ChatPanel.currentPanel = undefined;
    });

    // Receive messages from the WebView HTML
    this._panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "userMessage") {
        this._history.push({ role: "user", content: msg.text });
        this._saveHistory();
        await this.streamResponse(streamChat(msg.text, this._history));
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

  private _getHtml(): string {
    return /*html*/`<!DOCTYPE html>
<html>
<head>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

    :root {
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-sideBar-background, #1e1e2e);
      --bg-input: var(--vscode-input-background, #181825);
      --border-color: var(--vscode-panel-border, rgba(255,255,255,0.06));
      --text-primary: var(--vscode-editor-foreground, #cdd6f4);
      --text-secondary: var(--vscode-descriptionForeground, #a6adc8);
      --text-muted: var(--vscode-disabledForeground, #6c7086);
      --accent: var(--vscode-button-background, #89b4fa);
      --accent-hover: var(--vscode-button-hoverBackground, #74c7ec);
      --user-bubble: rgba(137, 180, 250, 0.12);
      --user-border: rgba(137, 180, 250, 0.22);
      --agent-bubble: rgba(166, 227, 161, 0.06);
      --agent-border: rgba(166, 227, 161, 0.12);
      --tool-bg: rgba(249, 226, 175, 0.08);
      --tool-border: rgba(249, 226, 175, 0.2);
      --code-bg: rgba(0, 0, 0, 0.3);
      --danger: #f38ba8;
      --success: #a6e3a1;
      --scroll-thumb: rgba(255,255,255,0.1);
      --scroll-thumb-hover: rgba(255,255,255,0.2);
      --mention-bg: rgba(137,180,250,0.15);
      --mention-border: rgba(137,180,250,0.3);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', var(--vscode-font-family, sans-serif);
      font-size: 13px;
      background: var(--bg-primary);
      color: var(--text-primary);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      line-height: 1.6;
    }

    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--scroll-thumb); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--scroll-thumb-hover); }

    /* ===== HEADER ===== */
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-secondary);
      flex-shrink: 0;
    }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .header-icon {
      width: 28px; height: 28px; border-radius: 8px;
      background: linear-gradient(135deg, #89b4fa 0%, #cba6f7 100%);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; color: #fff;
    }
    .header-title { font-size: 13px; font-weight: 600; }
    .header-subtitle { font-size: 10px; color: var(--text-muted); margin-top: 1px; }
    .clear-btn {
      background: transparent; border: 1px solid var(--border-color);
      color: var(--text-secondary); padding: 4px 10px; cursor: pointer;
      border-radius: 6px; font-size: 11px; font-family: inherit;
      transition: all 0.15s ease; display: flex; align-items: center; gap: 4px;
    }
    .clear-btn:hover { background: rgba(243,139,168,0.1); border-color: var(--danger); color: var(--danger); }

    /* ===== MESSAGES ===== */
    #messages {
      flex: 1; overflow-y: auto; padding: 14px;
      display: flex; flex-direction: column; gap: 6px;
    }

    /* Welcome */
    .welcome { text-align: center; padding: 28px 14px; animation: fadeIn 0.5s ease; }
    .welcome-icon { font-size: 32px; margin-bottom: 10px; }
    .welcome h3 { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
    .welcome p { font-size: 12px; color: var(--text-muted); max-width: 240px; margin: 0 auto; line-height: 1.5; }

    /* Suggestions */
    .suggestions {
      display: flex; flex-wrap: wrap; gap: 6px;
      justify-content: center; margin-top: 14px;
    }
    .suggestion-chip {
      background: var(--bg-input); border: 1px solid var(--border-color);
      color: var(--text-secondary); padding: 6px 12px; border-radius: 18px;
      font-size: 11px; font-family: inherit; cursor: pointer;
      transition: all 0.15s ease; white-space: nowrap;
    }
    .suggestion-chip:hover {
      border-color: var(--accent); color: var(--accent);
      background: rgba(137,180,250,0.08);
    }

    /* Message container */
    .msg {
      display: flex; gap: 8px; max-width: 88%;
      animation: slideIn 0.25s ease;
    }
    .msg.user { align-self: flex-end; flex-direction: row-reverse; }
    .msg.agent { align-self: flex-start; }

    .msg-avatar {
      width: 24px; height: 24px; border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; flex-shrink: 0; margin-top: 2px;
    }
    .user .msg-avatar { background: linear-gradient(135deg, #89b4fa 0%, #74c7ec 100%); }
    .agent .msg-avatar { background: linear-gradient(135deg, #a6e3a1 0%, #94e2d5 100%); }

    .msg-content { flex: 1; min-width: 0; }

    .msg-name {
      font-size: 10px; font-weight: 600; margin-bottom: 3px;
      display: flex; align-items: center; gap: 6px;
    }
    .user .msg-name { color: #89b4fa; justify-content: flex-end; }
    .agent .msg-name { color: #a6e3a1; }
    .msg-time { font-size: 9px; color: var(--text-muted); font-weight: 400; }

    .msg-bubble {
      padding: 9px 13px; border-radius: 14px;
      font-size: 13px; line-height: 1.6;
      word-wrap: break-word; overflow-wrap: break-word;
    }
    .user .msg-bubble {
      background: var(--user-bubble); border: 1px solid var(--user-border);
      border-top-right-radius: 4px;
    }
    .agent .msg-bubble {
      background: var(--agent-bubble); border: 1px solid var(--agent-border);
      border-top-left-radius: 4px;
    }

    /* File mention tag */
    .file-tag {
      display: inline-flex; align-items: center; gap: 3px;
      background: var(--mention-bg); border: 1px solid var(--mention-border);
      border-radius: 4px; padding: 1px 6px; font-size: 11px;
      color: #89b4fa; font-family: var(--vscode-editor-font-family, monospace);
      margin: 0 2px;
    }
    .file-tag::before { content: "📄"; font-size: 10px; }

    /* Tool badge */
    .tool-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 10px; background: var(--tool-bg); border: 1px solid var(--tool-border);
      border-radius: 8px; font-size: 11px; color: #f9e2af;
      margin: 4px 0; animation: slideIn 0.25s ease; align-self: flex-start;
    }

    /* Code blocks */
    .msg-bubble pre {
      background: var(--code-bg); border: 1px solid var(--border-color);
      border-radius: 8px; padding: 10px 12px; margin: 6px 0;
      overflow-x: auto; font-size: 12px; line-height: 1.5;
    }
    .msg-bubble code {
      font-family: var(--vscode-editor-font-family, 'Fira Code', monospace);
      font-size: 12px;
    }
    .msg-bubble p code {
      background: var(--code-bg); padding: 2px 5px; border-radius: 4px;
    }

    /* Typing */
    .typing {
      display: flex; gap: 8px; align-items: flex-start;
      animation: fadeIn 0.3s ease; align-self: flex-start;
    }
    .typing-avatar {
      width: 24px; height: 24px; border-radius: 7px;
      background: linear-gradient(135deg, #a6e3a1 0%, #94e2d5 100%);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; flex-shrink: 0;
    }
    .typing-dots {
      display: flex; align-items: center; gap: 4px;
      padding: 10px 14px; background: var(--agent-bubble);
      border: 1px solid var(--agent-border); border-radius: 14px; border-top-left-radius: 4px;
    }
    .typing-dots span {
      width: 5px; height: 5px; border-radius: 50%;
      background: #a6e3a1; animation: bounce 1.2s infinite ease-in-out;
    }
    .typing-dots span:nth-child(2) { animation-delay: 0.15s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.3s; }

    /* ===== @ MENTION DROPDOWN ===== */
    .mention-dropdown {
      position: absolute; bottom: 100%; left: 0; right: 0;
      max-height: 180px; overflow-y: auto;
      background: var(--bg-input); border: 1px solid var(--accent);
      border-radius: 10px; margin-bottom: 6px;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
      display: none; z-index: 100;
    }
    .mention-dropdown.visible { display: block; }
    .mention-item {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 12px; cursor: pointer; font-size: 12px;
      transition: background 0.1s ease;
    }
    .mention-item:hover, .mention-item.active {
      background: rgba(137,180,250,0.12);
    }
    .mention-item-icon { font-size: 13px; flex-shrink: 0; }
    .mention-item-name {
      flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      color: var(--text-primary);
    }
    .mention-item-path {
      font-size: 10px; color: var(--text-muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 140px;
    }
    .mention-header {
      padding: 6px 12px; font-size: 10px; font-weight: 600;
      color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;
      border-bottom: 1px solid var(--border-color);
    }

    /* ===== INPUT AREA ===== */
    .input-area {
      padding: 10px 14px; border-top: 1px solid var(--border-color);
      background: var(--bg-secondary); flex-shrink: 0; position: relative;
    }

    /* Attached files bar */
    .attached-files {
      display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px;
    }
    .attached-files:empty { display: none; }
    .attached-file {
      display: inline-flex; align-items: center; gap: 4px;
      background: var(--mention-bg); border: 1px solid var(--mention-border);
      border-radius: 6px; padding: 3px 8px; font-size: 11px; color: #89b4fa;
    }
    .attached-file-remove {
      cursor: pointer; opacity: 0.6; font-size: 12px; margin-left: 2px;
    }
    .attached-file-remove:hover { opacity: 1; }

    .input-wrapper {
      display: flex; align-items: flex-end; gap: 6px;
      background: var(--bg-input); border: 1px solid var(--border-color);
      border-radius: 12px; padding: 4px 4px 4px 12px;
      transition: border-color 0.15s ease; position: relative;
    }
    .input-wrapper:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(137,180,250,0.1);
    }
    #input {
      flex: 1; background: transparent; border: none; color: var(--text-primary);
      font-family: inherit; font-size: 13px; line-height: 1.5;
      resize: none; outline: none; max-height: 100px; min-height: 20px; padding: 5px 0;
    }
    #input::placeholder { color: var(--text-muted); }
    .send-btn {
      width: 30px; height: 30px; border-radius: 8px; border: none;
      background: var(--accent); color: #1e1e2e; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s ease; flex-shrink: 0;
    }
    .send-btn:hover:not(:disabled) { background: var(--accent-hover); transform: scale(1.05); }
    .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .send-btn svg { width: 14px; height: 14px; }

    .input-hint {
      font-size: 10px; color: var(--text-muted); margin-top: 5px;
      text-align: center;
    }
    .input-hint kbd {
      background: var(--bg-input); padding: 1px 4px; border-radius: 3px;
      border: 1px solid var(--border-color); font-family: inherit; font-size: 10px;
    }

    /* Animations */
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-3px); opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="header-icon">✦</div>
      <div>
        <div class="header-title">AI Agent</div>
        <div class="header-subtitle">Powered by Ollama</div>
      </div>
    </div>
    <button class="clear-btn" onclick="clearChat()">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      Clear
    </button>
  </div>

  <div id="messages">
    <div class="welcome" id="welcome">
      <div class="welcome-icon">✦</div>
      <h3>How can I help?</h3>
      <p>Ask me to read files, write code, run commands, or explain anything.</p>
      <div class="suggestions">
        <button class="suggestion-chip" onclick="useSuggestion('Explain this project structure')">📁 Explain project</button>
        <button class="suggestion-chip" onclick="useSuggestion('Read and explain main.py')">📄 Read a file</button>
        <button class="suggestion-chip" onclick="useSuggestion('Find all TODO comments in the code')">🔍 Find TODOs</button>
        <button class="suggestion-chip" onclick="useSuggestion('List all files in this directory')">📋 List files</button>
      </div>
    </div>
  </div>

  <div class="input-area">
    <div class="mention-dropdown" id="mentionDropdown">
      <div class="mention-header">Files</div>
    </div>
    <div class="attached-files" id="attachedFiles"></div>
    <div class="input-wrapper">
      <textarea id="input" rows="1" placeholder="Ask anything... type @ to mention a file"></textarea>
      <button class="send-btn" id="sendBtn" onclick="send()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
    <div class="input-hint"><kbd>Enter</kbd> send · <kbd>Shift+Enter</kbd> new line · <kbd>@</kbd> mention file</div>
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
    let attachedFiles = []; // {path, name}

    // Auto-resize textarea
    inputEl.addEventListener("input", () => {
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + "px";
      handleMentionInput();
    });

    function getTime() {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

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

    // ===== SUGGESTIONS =====
    function useSuggestion(text) {
      inputEl.value = text;
      inputEl.focus();
      send();
    }

    // ===== @ MENTION =====
    function handleMentionInput() {
      const val = inputEl.value;
      const cursorPos = inputEl.selectionStart;

      // Find the last @ before cursor
      const beforeCursor = val.substring(0, cursorPos);
      const atIdx = beforeCursor.lastIndexOf("@");

      if (atIdx >= 0) {
        const charBefore = atIdx > 0 ? val[atIdx - 1] : " ";
        if (charBefore === " " || charBefore === "\\n" || atIdx === 0) {
          const query = beforeCursor.substring(atIdx + 1);
          // If query has a space, mention is done
          if (query.includes(" ")) {
            closeMention();
            return;
          }
          mentionActive = true;
          mentionStartPos = atIdx;
          mentionQuery = query;
          mentionIndex = 0;
          vscode.postMessage({ type: "searchFiles", query: query });
          return;
        }
      }
      closeMention();
    }

    function closeMention() {
      mentionActive = false;
      mentionDropdown.classList.remove("visible");
    }

    function renderMentionDropdown(files) {
      mentionFiles = files;
      const items = mentionDropdown.querySelectorAll(".mention-item");
      items.forEach(i => i.remove());

      if (files.length === 0) {
        closeMention();
        return;
      }

      files.forEach((f, idx) => {
        const item = document.createElement("div");
        item.className = "mention-item" + (idx === mentionIndex ? " active" : "");
        const ext = f.name.split(".").pop() || "";
        const icon = getFileIcon(ext);
        item.innerHTML =
          '<span class="mention-item-icon">' + icon + '</span>' +
          '<span class="mention-item-name">' + escapeHtml(f.name.split("/").pop()) + '</span>' +
          '<span class="mention-item-path">' + escapeHtml(f.name) + '</span>';
        item.onclick = () => selectMention(f);
        mentionDropdown.appendChild(item);
      });
      mentionDropdown.classList.add("visible");
    }

    function getFileIcon(ext) {
      const icons = {
        py: "🐍", js: "📜", ts: "📘", json: "📋", html: "🌐", css: "🎨",
        md: "📝", txt: "📄", env: "🔒", yaml: "⚙️", yml: "⚙️",
        sh: "💻", rs: "🦀", go: "🔹", java: "☕"
      };
      return icons[ext] || "📄";
    }

    function selectMention(file) {
      // Replace @query with just @ marker, and add file to attached
      const val = inputEl.value;
      const before = val.substring(0, mentionStartPos);
      const after = val.substring(inputEl.selectionStart);
      inputEl.value = before + after;
      inputEl.focus();
      closeMention();

      // Add to attached files (avoid dups)
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
        tag.innerHTML =
          '📄 ' + escapeHtml(f.name.split("/").pop()) +
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
      const div = document.createElement("div");
      div.className = "msg " + role;
      if (!animate) div.style.animation = "none";

      const avatar = role === "user" ? "👤" : "✦";
      const name = role === "user" ? "You" : "Agent";
      const time = getTime();

      div.innerHTML =
        '<div class="msg-avatar">' + avatar + '</div>' +
        '<div class="msg-content">' +
          '<div class="msg-name">' + name + ' <span class="msg-time">' + time + '</span></div>' +
          '<div class="msg-bubble"></div>' +
        '</div>';

      const bubble = div.querySelector(".msg-bubble");
      if (role === "agent") {
        bubble.innerHTML = formatMarkdown(text);
      } else {
        // Render file mentions as tags in user messages
        bubble.innerHTML = renderUserMessage(text);
      }

      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
      return div;
    }

    function renderUserMessage(text) {
      return escapeHtml(text);
    }

    function addToolBadge(text) {
      const badge = document.createElement("div");
      badge.className = "tool-badge";
      badge.innerHTML = "🔧 " + escapeHtml(text);
      msgs.appendChild(badge);
      msgs.scrollTop = msgs.scrollHeight;
    }

    function showTyping() {
      const div = document.createElement("div");
      div.className = "typing"; div.id = "typing";
      div.innerHTML =
        '<div class="typing-avatar">✦</div>' +
        '<div class="typing-dots"><span></span><span></span><span></span></div>';
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

      // Build the message: include attached file paths
      let fullMessage = t;
      if (attachedFiles.length > 0) {
        const fileList = attachedFiles.map(f => f.path).join(", ");
        fullMessage = "[Attached files: " + fileList + "]\\n\\n" + t;
      }

      // Show user message in UI (just the text part)
      const displayText = t;
      addMessage("user", displayText, true);

      // Show attached files as tags under user message if any
      if (attachedFiles.length > 0) {
        const tagsDiv = document.createElement("div");
        tagsDiv.style.cssText = "align-self:flex-end;display:flex;gap:4px;flex-wrap:wrap;margin-top:-4px;margin-bottom:4px;";
        attachedFiles.forEach(f => {
          const tag = document.createElement("span");
          tag.className = "file-tag";
          tag.textContent = f.name.split("/").pop();
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
          '<div class="welcome-icon">✦</div>' +
          '<h3>How can I help?</h3>' +
          '<p>Ask me to read files, write code, run commands, or explain anything.</p>' +
          '<div class="suggestions">' +
            '<button class="suggestion-chip" onclick="useSuggestion(\\\'Explain this project structure\\\')">📁 Explain project</button>' +
            '<button class="suggestion-chip" onclick="useSuggestion(\\\'Read and explain main.py\\\')">📄 Read a file</button>' +
            '<button class="suggestion-chip" onclick="useSuggestion(\\\'Find all TODO comments in the code\\\')">🔍 Find TODOs</button>' +
            '<button class="suggestion-chip" onclick="useSuggestion(\\\'List all files in this directory\\\')">📋 List files</button>' +
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
        if (data.text.startsWith("🔧")) {
          addToolBadge(data.text.replace("🔧 ", ""));
          return;
        }
        const agentDiv = addMessage("agent", "", true);
        currentBody = agentDiv.querySelector(".msg-bubble");
        currentBody.setAttribute("data-raw", data.text);
        currentBody.innerHTML = formatMarkdown(data.text);
      } else if (data.type === "chunk" && currentBody) {
        if (data.text.startsWith("🔧")) {
          currentBody = null;
          addToolBadge(data.text.replace("🔧 ", ""));
          return;
        }
        const raw = (currentBody.getAttribute("data-raw") || "") + data.text;
        currentBody.setAttribute("data-raw", raw);
        currentBody.innerHTML = formatMarkdown(raw);
        msgs.scrollTop = msgs.scrollHeight;
      } else if (data.type === "endResponse") {
        removeTyping();
        currentBody = null;
        isStreaming = false;
        sendBtn.disabled = false;
        inputEl.focus();
      }
    });

    inputEl.addEventListener("keydown", e => {
      if (mentionActive) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          mentionIndex = Math.min(mentionIndex + 1, mentionFiles.length - 1);
          renderMentionDropdown(mentionFiles);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          mentionIndex = Math.max(mentionIndex - 1, 0);
          renderMentionDropdown(mentionFiles);
          return;
        }
        if ((e.key === "Enter" || e.key === "Tab") && mentionFiles.length > 0) {
          e.preventDefault();
          selectMention(mentionFiles[mentionIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeMention();
          return;
        }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    // Close mention on click outside
    document.addEventListener("click", e => {
      if (!e.target.closest(".mention-dropdown") && !e.target.closest("#input")) {
        closeMention();
      }
    });
  </script>
</body>
</html>`;
  }
}
