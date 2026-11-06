# Coding Rules for This Project

## Source of truth

Read `PRD.md`, `DESIGN.md`, `ARCHITECTURE.md`, `DATABASE.md`, and `API.md` before making a substantial change. If the implementation and docs disagree, inspect the code and update the relevant docs with the same change. Requirements stated by the user for the current task take precedence over these project notes.

## Working discipline

- Inspect the relevant existing files and dependencies before editing.
- Keep changes focused on the requested feature or bug. Preserve working behavior and existing patterns.
- Do not silently expand scope, add product features, or introduce dependencies. Explain a justified dependency or architecture change.
- Do not add credentials, `.env.local`, user PDFs, generated build files, or other secrets/private data to source control.
- Do not print secrets, log PDF text, or expose provider diagnostics to clients.

## Structure and code quality

- Keep App Router pages and route handlers in `app/`, reusable UI in `components/`, server integrations and domain helpers in `lib/`, and persistence schemas in `models/`.
- Use TypeScript strict mode. Avoid `any`; validate untrusted JSON/form data with the existing Zod schemas or an equivalent boundary validator.
- Reuse the semantic theme tokens and local primitives in `components/ui/`. Keep client-only behavior in components marked `"use client"` and keep MongoDB/Pinecone/OpenRouter calls on the server.
- Use clear names and small functions. Keep user-facing errors actionable without revealing internal stack traces or credentials.
- When changing an API or persisted schema, update `API.md`, `DATABASE.md`, and related usage docs in the same task.

## Security and data

- Treat uploaded PDFs, question text, and model output as untrusted data.
- Never import server credentials or server integration modules into client components.
- Validate document IDs and verify document state on the server. Do not treat UI visibility as authorization.
- The current project has no authentication or ownership checks. Do not claim it is safe for public multi-user use. Any auth/ownership change requires an explicit product decision and server-side enforcement.
- Do not log full prompts, retrieved text, API keys, or database connection strings.

## Tests, checks, and documentation

- For behavior changes, add/update focused tests when a test framework exists; this repository currently has no test script or test framework configured.
- Run the relevant type check/build when asked to verify, and report commands and outcomes accurately. Do not claim checks that were not run.
- Update README and architecture/API docs when setup or runtime behavior changes.
- Keep environment examples limited to variable names and safe placeholders; real secrets stay local or in deployment secret storage.
