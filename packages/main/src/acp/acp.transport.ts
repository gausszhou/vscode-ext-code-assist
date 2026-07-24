import * as vscode from 'vscode';
import type { Stream, AnyMessage } from '@agentclientprotocol/sdk';

export function createWebviewStream(webview: vscode.Webview): Stream {
  const writable = new WritableStream<AnyMessage>({
    write(msg) {
      webview.postMessage(JSON.stringify(msg));
    },
  });

  const buffer: AnyMessage[] = [];
  let readableController: ReadableStreamDefaultController<AnyMessage> | null = null;
  let started = false;

  const disposable = webview.onDidReceiveMessage((msg: any) => {
    const parsed = typeof msg === 'string' ? JSON.parse(msg) : msg;
    if (started && readableController) {
      readableController.enqueue(parsed);
    } else {
      buffer.push(parsed);
    }
  });

  const readable = new ReadableStream<AnyMessage>({
    start(controller) {
      readableController = controller;
      started = true;
      for (const msg of buffer) {
        controller.enqueue(msg);
      }
      buffer.length = 0;
    },
  });

  return { writable, readable };
}
