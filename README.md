# Shelly Wall Display Remote

A small web app to **remote-control the Shelly Wall Display XL** through its
local HTTP/RPC interface. It shows a live screenshot of the display and forwards
your clicks as tap commands to the device — handy for settings that are only
reachable directly on the screen.

Built on the device's local endpoints:

- `http://<wd-ip>/screenshot` – current image of the display
- `http://<wd-ip>/rpc/Ui.Tap?x=<x>&y=<y>` – simulates a tap at pixel `x/y`

The app calls these endpoints **server-side** (as a proxy), so there are no CORS
issues and optional login credentials never reach the browser.

## Features

- Live screenshot of the display; clicking the image taps that spot
- Configurable auto-refresh interval (from 200 ms)
- Optional device login (Digest auth), shown only when needed
- Settings are persisted locally in the browser

---

## Quick start with Docker (recommended)

The prebuilt image is hosted on the GitHub Container Registry. A single command
is enough:

```bash
docker run -d --name shelly-rpc -p 3000:3000 ghcr.io/hudint/shelly-rpc:latest
```

Then open it in your browser: **http://localhost:3000**

Enter your Wall Display's IP (e.g. `192.168.1.50`) and click *Refresh*.

Stop / remove:

```bash
docker stop shelly-rpc && docker rm shelly-rpc
```

### Alternative: Docker Compose

The image is already set in [`docker-compose.yml`](docker-compose.yml), so all
you need is:

```bash
docker compose up -d
```

---

## Networking note

For the app to reach the display, the container (i.e. the Docker host) and the
Wall Display must be on the **same network**. The screenshot/tap calls are made
from the server process, not from your browser — so the Docker host needs to be
able to reach the device's IP. With the default bridge network this is normally
the case on a home network.

## Different port

To serve the app on, say, port 8080:

```bash
docker run -d --name shelly-rpc -p 8080:3000 ghcr.io/hudint/shelly-rpc:latest
```

---

## Local development (without Docker)

Requires Node.js 20+.

```bash
npm install
npm run dev
```

The app then runs at http://localhost:3000. For a production build:

```bash
npm run build
npm start
```

## Build the image yourself

```bash
docker build -t shelly-rpc .
docker run -d -p 3000:3000 shelly-rpc
```

---

## CI/CD

The workflow [`.github/workflows/docker.yml`](.github/workflows/docker.yml)
automatically builds the Docker image on every push to `main` (and on `v*` tags)
and pushes it to `ghcr.io/hudint/shelly-rpc`. Tagged releases (`v1.2.3`) also
produce matching version tags.

## Tech

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- API routes as a server-side proxy, incl. RFC 2617 Digest auth
- Docker image based on `node:20-alpine` using Next.js `standalone` output
