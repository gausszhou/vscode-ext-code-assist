import * as vscode from 'vscode';

const outputChannel = vscode.window.createOutputChannel('Code Assist');

class LoggerService {
  info(msg: string): void {
    outputChannel.appendLine(`[INFO] ${msg}`);
  }

  warn(msg: string): void {
    outputChannel.appendLine(`[WARN] ${msg}`);
  }

  error(msg: string): void {
    outputChannel.appendLine(`[ERROR] ${msg}`);
  }
}

export const logger = new LoggerService();
