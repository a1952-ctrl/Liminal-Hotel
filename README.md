# Liminal Hotel

Prototype vertical slice for the multiplayer horror experience **Liminal Hotel**. This repository bundles the privacy-safe web client, the authoritative WebSocket server, and a desktop hoster built with Electron that can spawn the server locally with a single click.

## Project layout

- `web/liminal-hotel` – Vite-powered web client with microphone loudness capture, lobby UI, and options menu.
- `server` – Node/TypeScript authoritative server driving Host AI and mic-driven hearing logic.
- `apps/liminal-hotel-desktop` – Electron wrapper that embeds the client and exposes a **Host local** control to launch the server on an available port.

The repo uses npm workspaces; install once at the root to share dependencies.

```bash
npm install
```

## Running the web experience

### Development

```bash
npm run dev:web
```

This runs Vite dev mode for the client at <http://localhost:5173>. Use `npm run dev:server` in another terminal to watch the server with hot-reload through `tsx`:

```bash
npm run dev:server
```

The lobby’s **Connect** box defaults to `ws://localhost:8787`; adjust the URL if you pick a different port.

### Production build

```bash
npm run --workspace web/liminal-hotel build
```

The static output lands in `web/liminal-hotel/dist` and can be hosted on any web server.

## Desktop app with “Host local”

The Electron app embeds the built client and can spawn the Node server as a child process. It auto-selects a free port (starting at `8787`) and broadcasts the LAN URLs back to the UI.

### Develop / preview

```bash
npm run dev:desktop
```

This command builds the main & preload scripts, then launches Electron. In development the window loads the Vite dev server if present; otherwise it falls back to the built files under `web/liminal-hotel/dist`.

### Package builds

```bash
npm run build --workspace server
npm run build --workspace web/liminal-hotel
npm run build:desktop
```

The Electron builder configuration (`apps/liminal-hotel-desktop/electron-builder.yml`) prepares artifacts for Windows, macOS, and Linux.

### Firewall & ports

The host button surfaces the port and LAN endpoints inside the lobby. If Windows/macOS prompts for firewall permission, allow incoming connections so friends on the same network can join via the displayed `ws://` URLs. If the selected port is blocked, the host status feed highlights the error and you can retry.

## Microphone privacy & calibration

The client never forwards raw audio. The `MicLevel` helper samples microphone loudness, smooths it, applies hysteresis, and only transmits a scalar value (0–100) plus the push-to-talk flag. Toggle privacy options under **Options → Privacy**:

- **Microphone** — request or release microphone access.
- **Push-to-Talk (V)** — gate loudness updates behind the `V` key.
- **Sensitivity** — adjust the dBFS threshold for the voice detector.
- **Calibrate** — record ambient noise for ~2 seconds and subtract it from future levels.

The HUD displays when the mic is active and how strong the captured loudness is. Silence or disabled microphones mean the Host AI cannot “hear” you.

## Lobby workflow

1. Launch the client (web or desktop).
2. Choose **Connect** and enter the WebSocket URL, or click **Host local** inside the desktop build.
3. Once connected, the options menu persists your mic settings for the session, and the HUD shows real-time loudness feedback.
4. Use the shared LAN URLs (desktop app) to invite other players into the same authoritative server room.

## Scripts quick reference

| Command | Description |
| --- | --- |
| `npm run dev:web` | Start Vite dev server for the web client. |
| `npm run dev:server` | Run the Node server in watch mode via `tsx`. |
| `npm run dev:desktop` | Build Electron sources and open the desktop shell. |
| `npm run build --workspace server` | Compile the server to `dist/`. |
| `npm run build --workspace web/liminal-hotel` | Build the static web client. |
| `npm run build:desktop` | Package the Electron desktop application (requires built client/server). |

