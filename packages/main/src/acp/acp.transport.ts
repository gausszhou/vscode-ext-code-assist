import * as vscode from 'vscode';
import { AgentSideConnection } from '@agentclientprotocol/sdk';
import type { Stream, AnyMessage } from '@agentclientprotocol/sdk';
import { AcpAgent } from './acp.agent';
import { logger } from '../logger/logger.service';

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

export function connectServer(server: AcpAgent, stream: Stream): vscode.Disposable {
  logger.info('ACP Agent connect');

  const connection = new AgentSideConnection(() => server, stream);
  server.setConnection(connection);

  connection.signal.addEventListener('abort', () => {
    logger.info('ACP Agent disconnected');
  });

  return {
    dispose: () => {
      stream.writable.close();
      server.dispose();
    },
  };
}
