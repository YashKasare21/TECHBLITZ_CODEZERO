# Repository Guidelines

## Project Structure & Module Organization
The main product lives in `app/` using the Next.js App Router. Route groups include `app/(auth)` for login, `app/receptionist` for front-desk flows, `app/doctor` for queue and schedule views, and `app/api` for server endpoints. Shared UI belongs in `components/ui`, while feature components stay in folders such as `components/appointments` and `components/schedule`. Cross-cutting logic lives in `lib/`, realtime hooks in `hooks/`, and SQL migrations in `supabase/migrations` with numbered files like `001_initial_schema.sql`. The WhatsApp bot is a separate Bun service under `bot/`.

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
