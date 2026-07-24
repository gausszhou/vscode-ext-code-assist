import * as vscode from 'vscode';
import { ChatWebViewProvider } from './views/chat-webview.provider';
import { logger } from './logger/logger.service';

function setupChatWebview(context: vscode.ExtensionContext) {
  const provider = new ChatWebViewProvider(
    context.extensionUri,
    context.globalState,
    context.secrets,
    context.globalStorageUri,
  );
  const view = vscode.window.registerWebviewViewProvider('code-assist.view', provider);
  context.subscriptions.push(view);

  const openViewAndSendMessage = (type: string, text: string) => {
    if (provider.isVisible()) {
      return provider.postMessage(type, text);
    }
    vscode.commands.executeCommand('workbench.view.extension.chat-container');
    vscode.commands.executeCommand('code-assist.view.focus');
    setTimeout(() => {
      provider.postMessage(type, text);
    }, 1000);
  };

  const addCommand = (command: string) => {
    const disposable = vscode.commands.registerCommand(`codeAssist.${command}`, () => {
      const editor = vscode.window.activeTextEditor;
      const selection = editor?.document.getText(editor.selection) || '';
      openViewAndSendMessage(command, selection);
    });
    context.subscriptions.push(disposable);
  };
  [
    'chat',
    'optimization',
    'explanation',
    'comment',
    'test',
    'analysis',
    'translation',
    'appreciation',
    'add-to-chat',
  ].forEach(addCommand);

  context.subscriptions.push(provider);
}

export function activate(context: vscode.ExtensionContext) {
  logger.info('Extension activate');
  setupChatWebview(context);

  const openCommand = vscode.commands.registerCommand('codeAssist.open', () => {
    vscode.commands.executeCommand('workbench.view.extension.chat-container');
    vscode.commands.executeCommand('code-assist.view.focus');
  });
  context.subscriptions.push(openCommand);
}
