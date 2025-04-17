import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { chat, tags } from "./prompt";

let controller = new AbortController();

export class ChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // 处理来自 webview 的消息
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "tags": {
          tags((type: string, text: string) => {
            webviewView.webview.postMessage({ type, text });
          });
          break;
        }
        case "chat": {
          console.log("[debug] chat", message);
          controller = new AbortController();
          chat(
            message.text,
            message.messages || [],
            message.model,
            (type: string, text: string) => {
              webviewView.webview.postMessage({ type, text });
            },
            controller
          );
          break;
        }
        case "stop": {
          controller.abort();
          break;
        }
        default:
          return;
      }
    });

    webviewView.onDidChangeVisibility(() => {
      console.log("[debug] visible", webviewView.visible);
      if (webviewView.visible) {
        // 视图变为可见时执行的操作
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // 获取依赖包

    const markedUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this._extensionUri.fsPath, "assets", "lib", "marked.min.js")
      )
    );

    const highlightUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this._extensionUri.fsPath, "assets", "lib", "highlight.min.js")
      )
    );

    const oneDarkUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this._extensionUri.fsPath, "assets", "lib", "atom-one-dark.min.css")
      )
    );
    // 获取本地脚本和样式表的 URI
    const SimpleIDBUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this._extensionUri.fsPath, "assets", "SimpleIDB.js")
      )
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this._extensionUri.fsPath, "assets", "script.js")
      )
    );

    const vscodeStyleUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this._extensionUri.fsPath, "assets", "vscode.css")
      )
    );

    const markdownStyleUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this._extensionUri.fsPath, "assets", "markdown.css")
      )
    );

    const mainStyleUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this._extensionUri.fsPath, "assets", "style.css")
      )
    );

    // 读取 HTML 模板文件
    const htmlPath = path.join(
      this._extensionUri.fsPath,
      "assets",
      "index.html"
    );
    let html = fs.readFileSync(htmlPath, "utf-8");

    // 替换占位符
    
    html = html.replace("{{markedUri}}", markedUri.toString());
    html = html.replace("{{highlightUri}}", highlightUri.toString());
    html = html.replace("{{oneDarkUri}}", oneDarkUri.toString());
    html = html.replace("{{SimpleIDBUri}}", SimpleIDBUri.toString());
    html = html.replace("{{scriptUri}}", scriptUri.toString());
    html = html.replace("{{vscodeStyleUri}}", vscodeStyleUri.toString());
    html = html.replace("{{markdownStyleUri}}", markdownStyleUri.toString());
    html = html.replace("{{styleUri}}", mainStyleUri.toString());

    return html;
  }

  // 添加一个公开的显示方法
  public show() {
    if (this._view) {
      this._view.show(true); // true 参数表示即使已可见也强制聚焦
    }
  }

  public isVisible() {
    return this._view?.visible;
  }

  public onSelection(type: string, text: string) {
    if (this._view) {
      this._view.webview.postMessage({ type, text });

    }
  }
}
