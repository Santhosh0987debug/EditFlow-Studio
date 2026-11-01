# EditFlow Studio

A prompt-first media editing workspace. Users will eventually describe changes
to text, images, audio, and video in natural language, review a structured edit
plan, approve it, and then process the media.

> **Status: foundation only.** Editing, authentication, AI integration, media
> upload, media processing, database models, and migrations are intentionally not
> implemented yet.

## Stack

- **Web:** React, TypeScript, Vite, Tailwind CSS
- **Server:** Node.js, Express, TypeScript
- **Database:** PostgreSQL with Prisma (configured, not connected yet)
- **Packages:** npm workspaces

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer
- PostgreSQL is **not required** for this foundation

## Getting started

```bash
npm install
```

`npm install` also builds the shared type package. Then optionally create a local
environment file:

```bash
# macOS / Linux
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

Start the frontend and backend together:

```bash
npm run dev
```

| Service      | URL                            |
| ------------ | ------------------------------ |
| Web app      | http://localhost:5173          |
| Health check | http://localhost:3001/api/health |

Vite proxies requests starting with `/api` to the Express server, so the browser
can call the backend without CORS configuration.

## Scripts

Run these from the repository root.

| Command              | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| `npm run dev`        | Start the Vite frontend and Express backend concurrently.  |
| `npm run build`      | Build the shared package, then the server and frontend.    |
| `npm test`           | Run the backend and frontend test suites.                  |
| `npm run typecheck`  | Type-check all workspaces.                                 |
| `npm run db:validate`| Validate the Prisma schema.                                |
| `npm run db:generate`| Generate the Prisma client after models are added.         |

Workspace-specific commands are also available, for example:

```bash
npm run dev -w apps/web
npm run dev -w apps/server
npm run test -w apps/server
npm run build -w apps/web
```

## Project structure

```text
EditFlow-Studio/
├── apps/
│   ├── web/                 React + Vite frontend
│   │   ├── public/
│   │   └── src/
│   │       ├── test/
│   │       ├── App.tsx
│   │       ├── App.test.tsx
│   │       └── main.tsx
│   └── server/              Express backend
│       ├── prisma/
│       │   └── schema.prisma
│       ├── src/
│       │   ├── config/
│       │   ├── app.ts
│       │   └── index.ts
│       └── tests/
├── packages/
│   └── shared/              Shared TypeScript types
│       └── src/
├── .env.example
├── package.json
└── README.md
```

- `apps/web` contains the landing page and frontend tests.
- `apps/server` contains the Express app, server tests, and Prisma configuration.
- `packages/shared` contains shared types such as `MediaKind` and `HealthResponse`.
  It is compiled to `dist` before the applications are built.

## Environment variables

All environment variables live in one optional root `.env` file. The server only
loads it when it exists, so local defaults work without one.

| Variable                 | Default                  | Purpose                                      |
| ------------------------ | ------------------------ | -------------------------------------------- |
| `PORT`                   | `3001`                   | Express API port                             |
| `DATABASE_URL`           | PostgreSQL example value | Prisma connection string                     |
| `VITE_API_PROXY_TARGET`  | `http://localhost:3001`  | Vite development proxy target                |

Only variables prefixed with `VITE_` are exposed to the frontend.

## API

### `GET /api/health`

```json
{
  "status": "ok",
  "service": "editflow-studio-api",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Unknown routes return a JSON `404` response. There are no other API features yet.

## Database and Prisma

Prisma is configured in `apps/server/prisma/schema.prisma` with PostgreSQL and the
standard Prisma Client generator.

There are **no models or migrations yet**, and the server does not connect to a
database. When persistence is needed:

1. Add models to the schema.
2. Copy `.env.example` to `.env` and set a real `DATABASE_URL`.
3. Create a migration with `npx prisma migrate dev --schema apps/server/prisma/schema.prisma`.
4. Run `npm run db:generate`.

Prisma CLI commands are run from the repository root so they can read the root
`.env` file.

## Testing

```bash
npm test
```

- **Backend:** Vitest and Supertest verify the health endpoint and JSON 404
  handling without opening a network port.
- **Frontend:** Vitest, jsdom, and Testing Library verify the landing page content
  and the "Get Started" link.

## Production build

```bash
npm run build
```

Build output:

- `apps/server/dist` — compiled Express server
- `apps/web/dist` — static frontend bundle
- `packages/shared/dist` — compiled shared types

Start the built API with `npm run start -w apps/server`. Serve the frontend from
`apps/web/dist` with any static host. The Vite proxy only applies during
development; production deployments will need to route `/api` to the Express
server.
