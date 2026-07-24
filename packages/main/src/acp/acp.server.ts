import * as vscode from 'vscode';
import { AgentSideConnection } from '@agentclientprotocol/sdk';
import type { Stream } from '@agentclientprotocol/sdk';
import { AgentServer } from '../agent/agent.service';
import { logger } from '../logger/logger.service';

export function connectServer(server: AgentServer, stream: Stream): vscode.Disposable {
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
