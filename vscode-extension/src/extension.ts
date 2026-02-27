// vscode-extension/src/extension.ts
// Entry point — registers all commands and providers

import * as vscode from "vscode";
import { ChatPanel } from "./chatPanel";
import { getSuggestion, explainFile } from "./agentClient";

export function activate(ctx: vscode.ExtensionContext) {
    console.log("My AI Agent extension is now active!");

    // Command 1: Open the chat sidebar
    ctx.subscriptions.push(
        vscode.commands.registerCommand("myAgent.openChat", () => {
            ChatPanel.createOrShow(ctx);
        })
    );

    // Command 2: Explain the current open file
    ctx.subscriptions.push(
        vscode.commands.registerCommand("myAgent.explainFile", async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage("No file open!");
                return;
            }
            const content = editor.document.getText();
            const filePath = editor.document.fileName;
            const lang = editor.document.languageId;

            // Open the chat panel and stream the explanation
            const panel = ChatPanel.createOrShow(ctx);
            await panel.streamResponse(
                explainFile(content, filePath, `Explain this ${lang} file clearly.`)
            );
        })
    );

    // Command 3: Inline suggestion via keybind (Cmd+Shift+A on Mac)
    ctx.subscriptions.push(
        vscode.commands.registerCommand("myAgent.suggestInline", async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: "Getting AI suggestion...",
                    cancellable: false,
                },
                async () => {
                    const pos = editor.selection.active;
                    const textBefore = editor.document.getText(
                        new vscode.Range(new vscode.Position(0, 0), pos)
                    );
                    const lang = editor.document.languageId;
                    const suggestion = await getSuggestion(textBefore, lang);
                    if (suggestion) {
                        await editor.edit((eb) => eb.insert(pos, suggestion));
                    }
                }
            );
        })
    );
}

export function deactivate() { }
