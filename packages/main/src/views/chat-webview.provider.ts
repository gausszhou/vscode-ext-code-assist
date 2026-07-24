import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AcpAgent } from '../acp/acp.agent';
import { createWebviewStream, connectServer } from '../acp/acp.transport';
import { logger } from '../logger/logger.service';

const setting = vscode.workspace.getConfiguration('code-assist');

export class ChatWebViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private _view?: vscode.WebviewView;
  private agentServer: AcpAgent;
  private serverDisposable: vscode.Disposable | null = null;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    globalState: vscode.Memento,
    secrets: vscode.SecretStorage,
    globalStorageUri: vscode.Uri,
  ) {
    this.agentServer = new AcpAgent(globalState, secrets, globalStorageUri);
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    logger.info('Webview resolve');
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    const stream = createWebviewStream(webviewView.webview);
    this.serverDisposable = connectServer(this.agentServer, stream);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const mainStyleUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this._extensionUri.fsPath, 'dist-web/css/style.css'))
    );

    const appUri = webview.asWebviewUri(vscode.Uri.file(path.join(this._extensionUri.fsPath, 'dist-web/js/app.js')));

    const htmlPath = path.join(this._extensionUri.fsPath, 'dist-web', 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf-8');

    html = html.replace('Object.entries({})', `Object.entries(${JSON.stringify(setting)})`);
    html = html.replace('/css/style.css', mainStyleUri.toString());
    html = html.replace('/js/app.js', appUri.toString());
    return html;
  }

  public isVisible() {
    return this._view?.visible;
  }

  public postMessage(type: string, text: string) {
    if (this._view) {
      this._view.webview.postMessage({ type, text });
    }
  }

  dispose(): void {
    this.serverDisposable?.dispose();
  }
}
