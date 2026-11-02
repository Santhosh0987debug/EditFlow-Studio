# EditFlow Studio

A prompt-first media editing workspace. Users will eventually describe changes
to text, images, audio, and video in natural language, review a structured edit
plan, approve it, and then process the media.

> **Status: Phase 3.** Accounts, sessions, projects, and versioned text editing
> are working. AI editing is available when a provider is configured. Image,
> audio, and video editing, uploads, and media processing are intentionally not
> implemented yet.

## Features

- Email/password registration and login
- Password hashing with bcrypt (cost factor 12)
- Seven-day JWT session stored in an HttpOnly, SameSite=Lax cookie
- Protected `/dashboard` and `/editor` routes with session bootstrap via
  `/api/auth/me`
- Project creation, listing, and deletion, scoped to the signed-in owner
- Responsive text editor with a title, plain text/Markdown editing, a formatting
  toolbar, and a safe rendered preview
- Prompt-driven AI actions: rewrite, grammar correction, summarize, expand,
  change tone, and translate
- Side-by-side original/edited comparison with explicit accept and reject
- Append-only version history stored in PostgreSQL and linked to the project;
  previous versions can be reopened and saved again
- Clear loading, empty, success, and error states, including an explicit
  configuration message when no AI provider is available
- Server-side request validation with Zod and consistent JSON errors
- PostgreSQL persistence with Prisma migrations

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

# Optional AI editing. Leave these unset to use the editor without AI.
# AI_PROVIDER=openai-compatible
# AI_API_KEY="<provider-api-key>"
# AI_MODEL=gpt-4o-mini
# AI_BASE_URL=https://api.openai.com/v1
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
│   │   │   ├── editor/           Markdown editor, AI panel, comparison, history
│   │   │   ├── pages/            Landing, auth, dashboard, and editor pages
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
│       │   │   ├── ai/           Provider interface and structured editing
│       │   │   ├── auth/
│       │   │   ├── projects/
│       │   │   └── text/         Document and version persistence
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

| Variable                | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `PORT`                  | Express API port. Defaults to `3001`.                      |
| `NODE_ENV`              | `development`, `test`, or `production`.                    |
| `DATABASE_URL`          | PostgreSQL connection string used by Prisma.               |
| `JWT_SECRET`            | HS256 signing secret. Must be at least 32 characters.      |
| `VITE_API_PROXY_TARGET` | Vite dev/preview proxy target.                             |
| `AI_PROVIDER`           | Optional. Only `openai-compatible` is supported.           |
| `AI_API_KEY`            | Optional provider key. Never commit a real value.          |
| `AI_MODEL`              | Optional model identifier, for example `gpt-4o-mini`.      |
| `AI_BASE_URL`           | Optional OpenAI-compatible base URL. Defaults to OpenAI.   |

The server loads one optional `.env` from the repository root. Missing
`DATABASE_URL` or `JWT_SECRET` values fail fast at startup with a clear error.

### AI configuration

AI editing stays disabled until `AI_PROVIDER=openai-compatible`, `AI_API_KEY`,
and `AI_MODEL` are all set. When any piece is missing, `GET /api/ai/status`
reports the problem and `POST /api/ai/generate` returns `503` with a
configuration message. The editor shows that message and keeps all
non-AI features available.

The provider layer only handles transport. Prompts and structured output
validation live in `apps/server/src/modules/ai/ai.service.ts`; responses must be
a JSON object with `text` and `notes`. No API keys are stored in the repository,
and no successful result is fabricated when a provider is unavailable.

## API

All error responses use the shared shape:

```json
{
  "error": "Please correct the highlighted fields.",
  "fields": { "email": "Enter a valid email address." }
}
```

`fields` is present only for validation errors.

| Method   | Endpoint                                    | Auth | Description                                  |
| -------- | ------------------------------------------- | ---- | -------------------------------------------- |
| `POST`   | `/api/auth/register`                        | No   | Create an account and start a session.       |
| `POST`   | `/api/auth/login`                           | No   | Start a session.                             |
| `POST`   | `/api/auth/logout`                          | No   | Clear the session cookie.                    |
| `GET`    | `/api/auth/me`                              | No   | Return the current user or `null`.           |
| `GET`    | `/api/projects`                             | Yes  | List projects owned by the current user.     |
| `POST`   | `/api/projects`                             | Yes  | Create a project.                            |
| `DELETE` | `/api/projects/:id`                         | Yes  | Delete an owned project.                     |
| `GET`    | `/api/projects/:projectId/text`             | Yes  | Get the document and latest version.         |
| `POST`   | `/api/projects/:projectId/text/versions`    | Yes  | Append a new version.                        |
| `GET`    | `/api/projects/:projectId/text/versions`    | Yes  | List version metadata.                       |
| `GET`    | `/api/projects/:projectId/text/versions/:id`| Yes  | Read one version for reopening.              |
| `GET`    | `/api/ai/status`                            | Yes  | Report provider configuration.               |
| `POST`   | `/api/ai/generate`                          | Yes  | Generate a validated editing proposal.       |
| `GET`    | `/api/health`                               | No   | Return API status.                           |

Registration accepts `{ name, email, password }`; login accepts
`{ email, password }`. Project creation accepts `{ name, description? }`.
Saving a version accepts `{ title, content, source? }`, where `source` is
`manual`, `ai_accepted`, or `restored`. AI generation accepts
`{ action, content, instruction?, tone?, targetLanguage? }`; `tone` is required
for the `tone` action and `targetLanguage` for `translate`. Passwords and
provider credentials are never returned by the API.

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
- **TextDocument:** one per project, stores the current title and timestamps.
- **TextVersion:** append-only content snapshot with a sequential version
  number, source (`manual`, `ai_accepted`, `restored`), and creation time.
  Versions cascade when their document or project is deleted.

Migrations are applied with `npm run db:deploy`:

- `apps/server/prisma/migrations/20261101052218_init/migration.sql` — accounts
  and projects.
- `apps/server/prisma/migrations/20261101054204_text_editor/migration.sql` —
  text documents and versions.

Saving always inserts a new `TextVersion`; earlier content is never updated or
deleted. Reopening a version only changes the browser draft. Accepting an AI
proposal also changes only the draft, and saving records another version.

## Text editor

Open the editor from any project card on the dashboard, or visit:

```text
http://localhost:5173/editor?project=<project-id>
```

Without a `project` query parameter the editor selects the first project. The
editor supports:

- Title plus plain text or Markdown editing, with Write and Preview tabs.
- Formatting shortcuts for bold, italic, headings, lists, and quotes.
- AI actions when configured, with a proposal shown side by side against the
  text it was generated from.
- Accept, which updates only the local draft, or reject, which leaves it
  untouched. Saving after accepting records an `ai_accepted` version.
- Compare saved, which shows the latest saved version beside the current draft.
- Version history that can reopen earlier content. Saving reopened content
  creates a `restored` version instead of modifying the old one.

## Testing

```bash
npm test
```

- **Backend:** Vitest and Supertest cover registration, hashing, login, logout,
  session cookies, protected routes, validation, owner-scoped project CRUD,
  text document/version ownership, append-only saving, AI input validation, the
  unconfigured-provider contract, prompt forwarding, and strict proposal
  parsing. Prisma is mocked so the test suite does not touch the development
  database.
- **Frontend:** Vitest, jsdom, and Testing Library cover landing-page
  preservation, protected/public routing, login success and failure, session
  redirects, project create/delete flows, editor loading and project selection,
  saving, version reopening, saved-version comparison, AI configuration and
  proposal states, accept/reject, and retryable errors with mocked API
  responses.

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
