# EditFlow Studio

A prompt-first media editing workspace. Users will eventually describe changes
to text, images, audio, and video in natural language, review a structured edit
plan, approve it, and then process the media.

> **Status: Phase 2.** Accounts, sessions, and project management are working.
> Media editing, AI features, uploads, and processing are intentionally not
> implemented yet.

## Features

- Email/password registration and login
- Password hashing with bcrypt (cost factor 12)
- Seven-day JWT session stored in an HttpOnly, SameSite=Lax cookie
- Protected `/dashboard` route and session bootstrap via `/api/auth/me`
- Project creation, listing, and deletion, scoped to the signed-in owner
- Responsive dashboard with loading, empty, success, and error states
- Server-side request validation with Zod and consistent JSON errors
- PostgreSQL persistence with Prisma and an initial migration

## Stack

- **Web:** React, TypeScript, Vite, Tailwind CSS, React Router
- **Server:** Node.js, Express, TypeScript, Zod
- **Database:** PostgreSQL with Prisma
- **Auth:** bcryptjs, JSON Web Tokens, HttpOnly cookies
- **Packages:** npm workspaces

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer
- A running PostgreSQL server (the project was verified with PostgreSQL 17)

## Getting started

### 1. Install dependencies

```bash
npm install
```

The postinstall step builds the shared package and generates the Prisma Client.

### 2. Create the database

Create a PostgreSQL database named `editflow_studio`:

```sql
CREATE DATABASE editflow_studio;
```

For example, with `psql`:

```bash
psql -U postgres -c "CREATE DATABASE editflow_studio;"
```

### 3. Configure the environment

```bash
# macOS / Linux
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

Edit `.env`:

```dotenv
PORT=3001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/editflow_studio?schema=public"
JWT_SECRET="<a-random-secret-of-at-least-32-characters>"
VITE_API_PROXY_TARGET=http://localhost:3001
```

Generate a strong local secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Never commit `.env` or a real JWT secret.

### 4. Apply the database migration

```bash
npm run db:deploy
```

For local schema changes during development, use `npm run db:migrate`. The
committed migration lives in `apps/server/prisma/migrations`.

### 5. Start the app

```bash
npm run dev
```

| Service      | URL                            |
| ------------ | ------------------------------ |
| Web app      | http://localhost:5173          |
| Health check | http://localhost:3001/api/health |

Vite proxies `/api` to the Express server during development and preview. If
port 5173 is busy, Vite prints the next available port.

## Scripts

Run these from the repository root.

| Command               | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `npm run dev`         | Start Vite and Express concurrently.                          |
| `npm run build`       | Build the shared package, server, and frontend.               |
| `npm test`            | Run the backend and frontend test suites.                     |
| `npm run typecheck`   | Type-check all workspaces.                                    |
| `npm run db:migrate`  | Create/apply a development migration and regenerate Prisma.   |
| `npm run db:deploy`   | Apply committed migrations without creating a new one.        |
| `npm run db:validate` | Validate the Prisma schema.                                   |
| `npm run db:generate` | Regenerate the Prisma Client.                                 |

## Project structure

```text
EditFlow-Studio/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── api/              Fetch client and error helpers
│   │   │   ├── auth/             Session context and route guards
│   │   │   ├── components/       Shared UI primitives
│   │   │   ├── pages/            Landing, auth, and dashboard pages
│   │   │   ├── projects/         Project loading/CRUD hook
│   │   │   ├── test/             Test setup
│   │   │   ├── App.tsx           Route map
│   │   │   └── main.tsx          App bootstrap
│   │   └── vite.config.ts
│   └── server/
│       ├── prisma/
│       │   ├── migrations/       Committed SQL migrations
│       │   └── schema.prisma
│       ├── src/
│       │   ├── config/           Validated environment configuration
│       │   ├── lib/              Prisma, password, JWT, and error helpers
│       │   ├── middleware/       Authentication and error handling
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   └── projects/
│       │   ├── types/            Express request augmentation
│       │   ├── app.ts            Express app
│       │   └── index.ts          Server bootstrap
│       └── tests/
├── packages/
│   └── shared/                  Shared API types
├── .env.example
├── package.json
└── README.md
```

## Environment variables

| Variable                | Purpose                                               |
| ----------------------- | ----------------------------------------------------- |
| `PORT`                  | Express API port. Defaults to `3001`.                 |
| `NODE_ENV`              | `development`, `test`, or `production`.               |
| `DATABASE_URL`          | PostgreSQL connection string used by Prisma.          |
| `JWT_SECRET`            | HS256 signing secret. Must be at least 32 characters. |
| `VITE_API_PROXY_TARGET` | Vite dev/preview proxy target.                        |

The server loads one optional `.env` from the repository root. Missing
`DATABASE_URL` or `JWT_SECRET` values fail fast at startup with a clear error.

## API

All error responses use the shared shape:

```json
{
  "error": "Please correct the highlighted fields.",
  "fields": { "email": "Enter a valid email address." }
}
```

`fields` is present only for validation errors.

| Method   | Endpoint             | Auth | Description                              |
| -------- | -------------------- | ---- | ---------------------------------------- |
| `POST`   | `/api/auth/register` | No   | Create an account and start a session.   |
| `POST`   | `/api/auth/login`    | No   | Start a session.                         |
| `POST`   | `/api/auth/logout`   | No   | Clear the session cookie.                |
| `GET`    | `/api/auth/me`       | No   | Return the current user or `null`.       |
| `GET`    | `/api/projects`      | Yes  | List projects owned by the current user. |
| `POST`   | `/api/projects`      | Yes  | Create a project.                        |
| `DELETE` | `/api/projects/:id`  | Yes  | Delete an owned project.                 |
| `GET`    | `/api/health`        | No   | Return API status.                       |

Registration accepts `{ name, email, password }`; login accepts
`{ email, password }`. Project creation accepts `{ name, description? }`.
Passwords are never returned by the API.

## Authentication and security notes

- Passwords are hashed with bcrypt at cost factor 12. Plain-text passwords are
  never stored or logged.
- Sessions use a signed HS256 JWT with a seven-day expiry. The token is stored
  in an HttpOnly cookie so browser JavaScript cannot read it.
- Cookies use `SameSite=Lax` and become `Secure` when `NODE_ENV=production`.
- Login failures use a generic message, and unknown emails still run a dummy
  bcrypt comparison to reduce timing differences.
- Project queries always include the authenticated `ownerId`.
- API responses set `Cache-Control: no-store`.

This is an application foundation, not a complete production security program.
Email verification, password reset, rate limiting, and token revocation are not
implemented yet.

## Database models

- **User:** unique email, display name, bcrypt password hash, timestamps.
- **Project:** name, optional description, owner relation, timestamps. Deleting
  a user cascades to their projects.

The initial migration is
`apps/server/prisma/migrations/20261101052218_init/migration.sql`. There are no
media or editing models yet.

## Testing

```bash
npm test
```

- **Backend:** Vitest and Supertest cover registration, hashing, login, logout,
  session cookies, protected routes, validation, and owner-scoped project CRUD.
  Prisma is mocked so the test suite does not touch the development database.
- **Frontend:** Vitest, jsdom, and Testing Library cover landing-page
  preservation, protected/public routing, login success and failure, session
  redirects, and project create/delete flows with mocked API responses.

Type-check and build:

```bash
npm run typecheck
npm run build
```

Build output:

- `apps/server/dist` — compiled Express server
- `apps/web/dist` — static frontend bundle
- `packages/shared/dist` — compiled shared types

Start the built API with `npm run start -w apps/server`. Serve the frontend from
`apps/web/dist` with a static host. The Vite proxy applies to dev and preview,
not to an arbitrary production web server.
