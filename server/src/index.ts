import { createServer } from 'http';
import { AddressInfo } from 'net';
import process from 'node:process';
import { WebSocketServer } from 'ws';
import { GameRoom } from './game/GameRoom';
import { isMicMessage } from './net/messages';

function parsePort(): number {
  const argPort = process.argv.find((arg) => arg.startsWith('--port='));
  if (argPort) {
    const value = Number(argPort.split('=')[1]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  const envPort = Number(process.env.PORT ?? '');
  if (Number.isFinite(envPort) && envPort > 0) {
    return envPort;
  }
  return 3000;
}

export function startServer(): { close(): Promise<void>; port: number } {
  const httpServer = createServer();
  const wss = new WebSocketServer({ server: httpServer });
  const room = new GameRoom();

  wss.on('connection', (socket) => {
    const playerId = `player-${Math.random().toString(36).slice(2)}`;
    room.addPlayer(playerId);

    socket.on('message', (data) => {
      try {
        const payload = JSON.parse(String(data));
        if (isMicMessage(payload)) {
          room.processMessage(playerId, payload);
        }
      } catch (error) {
        console.warn('Invalid message', error);
      }
    });

    socket.on('close', () => {
      room.removePlayer(playerId);
    });
  });

  const tickInterval = setInterval(() => room.tick(), 1000 / 10);

  const port = parsePort();

  httpServer.listen(port, () => {
    const address = httpServer.address() as AddressInfo | null;
    console.log(
      address
        ? `Server listening on ws://localhost:${address.port}`
        : `Server listening on port ${port}`,
    );
  });

  const close = async (): Promise<void> => {
    clearInterval(tickInterval);
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  };

  return { close, port };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { port } = startServer();
  process.on('SIGINT', () => {
    console.log('Shutting down server...');
    process.exit(0);
  });
  console.log(`Liminal Hotel server started on port ${port}`);
}
