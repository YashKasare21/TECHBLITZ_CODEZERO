# Repository Guidelines

## Project Structure & Module Organization
The main product lives in `app/` using the Next.js App Router. Route groups include `app/(auth)` for login, `app/receptionist` for front-desk flows (dashboard, appointments, patients, users, whatsapp), `app/doctor` for queue and schedule views, and `app/api` for server endpoints. Shared UI belongs in `components/ui`, while feature components stay in folders such as `components/appointments` and `components/schedule`. Cross-cutting logic lives in `lib/`, realtime hooks in `hooks/`, and SQL migrations in `supabase/migrations` with numbered files like `001_initial_schema.sql`. The WhatsApp bot is a separate Bun service under `bot/`.

Key API routes:
- `app/api/appointments` — appointment CRUD and status updates
- `app/api/slots` — available slot generation for a doctor+date
- `app/api/users` — staff user management (GET list, POST create, PATCH edit, DELETE deactivate); **must use `createServiceClient()` from `lib/supabase/server.ts`** because it calls `supabase.auth.admin.*` which requires the service role key
- `app/api/whatsapp/*` — WhatsApp bot bridge endpoints (`/status`, `/messages`, `/send`); all are thin proxies to the Bun bot at `BOT_URL` (default `http://localhost:3001`)

The receptionist WhatsApp page (`app/receptionist/whatsapp/page.tsx`) is a full chat UI: it fetches the flat message log from the bot, groups messages by JID client-side into per-contact threads, and cross-references JIDs against the `patients` table by normalizing phone numbers (`phone.replace(/\D/g, "")`). WhatsApp JIDs have the form `<digits>@s.whatsapp.net`. The bot keeps the last 300 messages in memory (`bot/whatsapp.ts` → `getMessageLog`).

## Build, Test, and Development Commands
Install dependencies with `bun install` at the repo root and inside `bot/` when working on the bot. Use `bun dev` to run the Next.js app locally, `bun run build` to verify a production build, and `bun run lint` to run ESLint. Start the WhatsApp worker with `cd bot && bun dev`. Apply database changes by running the SQL files in `supabase/migrations/` against your Supabase project in order.

## Coding Style & Naming Conventions
TypeScript runs in strict mode; keep types explicit at module boundaries and prefer the `@/` import alias over deep relative paths. Match the existing style: double quotes, semicolons, and 2-space indentation. Use PascalCase for React components, `useX` for hooks, and kebab-case for file names such as `dashboard-client.tsx` or `status-badge.tsx`. Keep route handlers in `*/route.ts` and server actions close to their route files.

## Testing Guidelines
There is no dedicated automated test suite yet. Before opening a PR, run `bun run lint` and `bun run build`, then manually smoke-test the affected flow: login, receptionist booking, doctor queue updates, and any changed API or bot path. When adding tests, colocate `*.test.ts` or `*.test.tsx` files beside the feature they cover.

## Commit & Pull Request Guidelines
Follow the repository’s existing Conventional Commit style, for example `feat: add WhatsApp bot for clinic communication` or `fix: handle empty appointment states`. Keep each commit focused. PRs should include a short summary, linked issue or task when available, screenshots for UI changes, and notes for schema, env, or bot-session impacts.

## Security & Configuration Tips
Never commit `.env*`, Supabase service keys, or `bot/sessions/`. Use `.env.local.example` and `bot/.env.example` as templates, and rotate credentials immediately if they are exposed during local testing.

Any API route that manages auth users (creating, banning, deleting) must use `createServiceClient()` — not `createClient()` — because only the service role key has access to `supabase.auth.admin.*`. Never call admin auth methods from client components or the anon client.

## Database Migrations
Migrations are numbered sequentially in `supabase/migrations/`. Run them in order against the Supabase SQL Editor. Current migrations:
- `001_initial_schema.sql` — full schema: enums, tables, indexes, RLS, triggers
- `002_fix_handle_new_user_trigger.sql` — robust trigger with null/empty role guard
- `003_fix_trigger_rls_and_search_path.sql` — adds INSERT policy on `profiles` and sets `search_path = ''` on the trigger function (required for user creation to work)
