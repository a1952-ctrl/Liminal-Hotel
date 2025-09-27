import { app, BrowserWindow, ipcMain } from 'electron';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import os from 'node:os';
import process from 'node:process';
import portfinder from 'portfinder';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcessWithoutNullStreams | null = null;
let currentServerPort: number | null = null;

const WEB_DIST = resolve(__dirname, '../../../web/liminal-hotel/dist/index.html');
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
const SERVER_DIST = resolve(__dirname, '../../../server/dist/index.js');

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged || existsSync(WEB_DIST)) {
    void mainWindow.loadFile(WEB_DIST);
  } else {
    void mainWindow.loadURL(DEV_SERVER_URL);
  }
}

async function startLocalServer(): Promise<{ wsUrl: string; port: number; lanAddresses: string[] }> {
  if (serverProcess && currentServerPort) {
    return {
      wsUrl: `ws://localhost:${currentServerPort}`,
      port: currentServerPort,
      lanAddresses: getLanAddresses(currentServerPort),
    };
  }

  const port = await portfinder.getPortPromise({ port: 8787, stopPort: 8899 });

  if (!existsSync(SERVER_DIST)) {
    throw new Error('No se encontró la build del servidor. Ejecuta npm run build --workspace server.');
  }

  const child = spawn(process.execPath, [SERVER_DIST], {
    cwd: resolve(__dirname, '../../../server'),
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV ?? 'production',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess = child;
  currentServerPort = port;

  child.stdout?.on('data', (chunk) => {
    const message = chunk.toString().trim();
    mainWindow?.webContents.send('liminalHost:status', message);
  });

  child.stderr?.on('data', (chunk) => {
    const message = chunk.toString().trim();
    mainWindow?.webContents.send('liminalHost:status', `⚠️ ${message}`);
  });

  try {
    await waitForServerReady(child);
  } catch (error) {
    serverProcess = null;
    currentServerPort = null;
    child.kill();
    throw error;
  }

  child.once('exit', (code) => {
    const message = code === 0 ? 'Servidor detenido' : `Servidor salió con código ${code}`;
    mainWindow?.webContents.send('liminalHost:status', message);
    serverProcess = null;
    currentServerPort = null;
  });

  return {
    wsUrl: `ws://localhost:${port}`,
    port,
    lanAddresses: getLanAddresses(port),
  };
}

async function waitForServerReady(child: ChildProcessWithoutNullStreams): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('El servidor tardó demasiado en iniciar.'));
    }, 5000);

    const handleData = (chunk: Buffer): void => {
      const text = chunk.toString();
      if (text.toLowerCase().includes('listening')) {
        cleanup();
        resolve();
      }
    };

    const handleExit = (code: number | null): void => {
      cleanup();
      reject(new Error(`El servidor terminó antes de iniciar (código ${code ?? 'desconocido'}).`));
    };

    const cleanup = (): void => {
      clearTimeout(timeout);
      child.stdout?.off('data', handleData);
      child.off('exit', handleExit);
    };

    child.stdout?.on('data', handleData);
    child.once('exit', handleExit);
  });
}

async function stopLocalServer(): Promise<void> {
  if (!serverProcess) {
    return;
  }
  return new Promise((resolve) => {
    serverProcess?.once('exit', () => resolve());
    serverProcess?.kill();
  });
}

function getLanAddresses(port: number): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const info of iface) {
      if (info.internal) continue;
      if (info.family === 'IPv4' && info.address) {
        addresses.push(`ws://${info.address}:${port}`);
      }
    }
  }
  return addresses;
}

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    await stopLocalServer();
    app.quit();
  }
});

app.on('before-quit', async () => {
  await stopLocalServer();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('liminalHost:start', async () => {
    const info = await startLocalServer();
    return info;
  });

  ipcMain.handle('liminalHost:stop', async () => {
    await stopLocalServer();
    return true;
  });
});
