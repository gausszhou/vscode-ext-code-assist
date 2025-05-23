import * as vscode from "vscode";
import { ChatWebViewProvider } from "./ChatWebViewProvider";

// ====== AI 对话聊天 ======
function setupChatWebview(context: vscode.ExtensionContext) {
  const provider = new ChatWebViewProvider(context.extensionUri);
  const view = vscode.window.registerWebviewViewProvider(
    "code-assist.view",
    provider
  );
  context.subscriptions.push(view);

  const openViewAndSendMessage = (type: string, text: string) => {
    if (provider.isVisible()) {
      return provider.onSelection(type, text);
    }
    vscode.commands.executeCommand("workbench.view.extension.chat-container");
    vscode.commands.executeCommand("code-assist.view.focus");
    setTimeout(() => {
      provider.onSelection(type, text);
    }, 1000);
  };

  const chat = vscode.commands.registerCommand(
    "codeAssist.chat",
    () => {
      openViewAndSendMessage("chat", '');
    }
  );

  const optimization = vscode.commands.registerCommand(
    "codeAssist.optimization",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const selection = editor.document.getText(editor.selection);
        openViewAndSendMessage("optimization", selection);
      }
    }
  );

  const explanation = vscode.commands.registerCommand(
    "codeAssist.explanation",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const selection = editor.document.getText(editor.selection);
        openViewAndSendMessage("explanation", selection);
      }
    }
  );

  const comment = vscode.commands.registerCommand(
    "codeAssist.comment",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const selection = editor.document.getText(editor.selection);
        openViewAndSendMessage("comment", selection);
      }
    }
  );

  context.subscriptions.push(chat, optimization, explanation, comment);
}

export function activate(context: vscode.ExtensionContext) {
  setupChatWebview(context);
}
