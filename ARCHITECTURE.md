# Architecture

## Current stack

- Next.js 15 App Router and React 19 with TypeScript, deployed as a Node.js server.
- Tailwind CSS 3 and local shadcn-style UI primitives.
- MongoDB through Mongoose for document metadata and lifecycle status.
- Pinecone Documents API (`2026-07`) for chunk storage and integrated-embedding semantic retrieval.
- LangChain PDFLoader and RecursiveCharacterTextSplitter for PDF processing; Office Open parsers for DOCX, DOC, PPTX, and PPT; UTF-8 readers for TXT and Markdown.
- OpenRouter chat completions through LangChain `ChatOpenAI`, configured to use `openai/gpt-4o-mini`.

This stack is already present. Keep it for the MVP; do not add a new service or client library without a concrete need.

## Runtime and data flow

1. Browser sends one supported document's bytes to `POST /api/upload` using XMLHttpRequest for byte-accurate transfer progress. Multipart form uploads remain supported for API compatibility.
2. Server validates the filename extension, MIME type, size, UTF-8 text validity, and PDF/Office file signature; creates a MongoDB document in `processing` state.
3. The upload route chooses a format-specific loader. PDF pages and PowerPoint slides become individually numbered sources; Word, TXT, and Markdown become document-level sources. One shared splitter creates chunks (1,000 characters with 200-character overlap).
4. Server upserts chunk records to a Pinecone namespace named by the MongoDB document ID. Pinecone performs integrated embeddings, so progress is reported by successfully stored batch/chunk counts for this combined stage.
5. On success, MongoDB is updated with format, source/chunk counts, and `completed`; on failure or cancellation, partial vectors are deleted where possible and the document is marked accordingly.
6. The upload stream reports weighted server-processing progress; 100% is sent only after the MongoDB completion update succeeds. Browser then refreshes `GET /api/documents` to render the list. A completed document opens `/chat/[documentId]`.
7. Chat API verifies document existence/status, retrieves up to five relevant chunks from that document namespace, sends context plus bounded history to OpenRouter, and streams plain text with page, slide, or document citations in `X-Sources`.

## Boundaries and module map

```text
app/                    Next.js pages, root layout, API route handlers
  api/documents/        list document metadata
  api/upload/           validate, process and index supported documents
  api/chat/             retrieve context and stream answers
  chat/[documentId]/    document chat screen
components/             page components and reusable UI
  ui/                   local shadcn-style primitives
lib/                    format loaders, integrations, validation, processing, and types
models/                 Mongoose schemas
```

Browser components call same-origin routes only. `lib/mongodb.ts`, `lib/pinecone.ts`, and `lib/embeddings.ts` are server-only responsibilities and must never be imported into client components.

## Data and service ownership

- MongoDB owns document identity, display metadata, lifecycle state, and timestamps.
- Pinecone owns searchable chunk text and its source/chunk metadata. The MongoDB `_id` string is also the Pinecone namespace.
- The original uploaded file is processed from the request and is not retained as a binary.
- OpenRouter is called only by the chat route. Pinecone and MongoDB credentials stay in server environment variables.

## Authentication and authorization

No authentication or ownership checks exist. This is a single-user/trusted-environment MVP only. A public multi-user deployment is blocked until an authentication provider, session model, per-user ownership field, and server-side document authorization are approved. Do not bolt on client-only route protection.

## API and errors

See `API.md` for the current route contract. Validate every request at the boundary. Return safe, actionable error messages; log server-side diagnostics without logging credentials, document text, or full prompts. Preserve the distinction between a failed retrieval/provider and a valid no-answer response.

## Environment configuration

See `.env.example`. Required values are `MONGODB_URI`, `PINECONE_API_KEY`, `PINECONE_INDEX`, and `OPENROUTER_API_KEY`. Keep real values in ignored local/deployment secret stores, never in source control or client-exposed `NEXT_PUBLIC_*` variables.

## Reliability, security, and limits

- Upload/chat route handlers use Node.js runtime and declare a 60-second maximum duration.
- Upload processing is synchronous; larger documents may exceed host limits. Background jobs are a future option only if real workload requires them.
- Limit input size and validate format signatures; scanned PDFs are unsupported without OCR. Password-protected and malformed files fail processing with a safe message.
- Use a dedicated Pinecone namespace per document and server-side document status checks.
- There is currently no rate limiting, auth, document deletion UI, or persistent chat history; these are deployment risks for public use.

## Testing and deployment approach

Use `npm run typecheck` and `npm run build` as baseline checks. Add focused unit tests for validation/chunking, route integration tests with mocked MongoDB/Pinecone/OpenRouter, and a manual or automated upload-to-chat smoke path before release. Keep secrets in the hosting provider's secret configuration. Select the hosting target only after confirming its Node runtime, request body limit, and 60-second route duration support.
