// vscode-extension/src/agentClient.ts
// HTTP client — all communication with the Python backend

const BASE = "http://localhost:8000";

/**
 * Stream chat messages from the agent backend.
 * Yields text chunks as they arrive.
 */
export async function* streamChat(
    message: string,
    history: any[]
): AsyncGenerator<string> {
    const res = await fetch(`${BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
    });

    if (!res.ok) {
        yield `Error: Backend returned ${res.status} ${res.statusText}`;
        return;
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
        const { value, done } = await reader.read();
        if (done) { break; }
        yield decoder.decode(value);
    }
}

/**
 * Stream an explanation of a file from the agent.
 */
export async function* explainFile(
    content: string,
    path: string,
    instruction: string
): AsyncGenerator<string> {
    const res = await fetch(`${BASE}/explain-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            file_content: content,
            file_path: path,
            instruction,
        }),
    });

    if (!res.ok) {
        yield `Error: Backend returned ${res.status} ${res.statusText}`;
        return;
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
        const { value, done } = await reader.read();
        if (done) { break; }
        yield decoder.decode(value);
    }
}

/**
 * Get a quick inline suggestion (not streamed).
 */
export async function getSuggestion(
    codeBefore: string,
    language: string
): Promise<string> {
    try {
        const res = await fetch(`${BASE}/suggest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                code_before_cursor: codeBefore,
                language,
            }),
        });
        const data = await res.json();
        return data.suggestion || "";
    } catch (e) {
        return `// Error getting suggestion: ${e}`;
    }
}
