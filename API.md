# API Contract

All routes are same-origin Next.js App Router handlers. Responses are JSON except for the streamed chat body. There is currently no authentication or per-document authorization; this is for a trusted single-user deployment only.

## `GET /api/documents`

Lists all document metadata, newest first.

**Response `200`**

```json
{
  "documents": [
    {
      "id": "<mongo-object-id>",
      "fileName": "notes.pdf",
      "fileSize": 12345,
      "status": "completed",
      "pageCount": 4,
      "chunkCount": 8,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

`status` is `processing`, `completed`, or `failed`. Failed entries may include a safe `errorMessage`.

**Errors:** `500 { "error": "Could not load your documents." }`.

## `POST /api/upload`

Accepts `multipart/form-data`, field `file`. Maximum 10 MB; nonempty `.pdf` filename and `%PDF-` signature required. The client may report byte transfer progress, but server-side extraction/indexing is part of this same request and has no known percentage.

**Success `201`**

```json
{
  "documentId": "<mongo-object-id>",
  "fileName": "notes.pdf",
  "chunkCount": 8,
  "status": "completed"
}
```

**Errors:** `400` invalid/missing upload; `422` no extractable text; `500` database, Pinecone, or processing failure. Error response shape: `{ "error": "Human-readable message" }`. The endpoint records a failed Mongo document after it creates one. Cleanup of partial Pinecone writes is best-effort.

## `POST /api/chat`

Accepts JSON. `documentId` must be a valid Mongo ObjectId. `question` is trimmed and 1–2,000 characters. `history` is optional, at most six `{ role, content }` entries; role is `user` or `assistant`, content at most 8,000 characters.

**Request**

```json
{
  "documentId": "<mongo-object-id>",
  "question": "What are the main conclusions?",
  "history": []
}
```

**Success `200`:** UTF-8 `text/plain` streamed answer. Headers include `Cache-Control: no-store` and `X-Sources: [1,2]` (JSON array of source page numbers). If the context does not contain an answer, the model returns the configured refusal sentence and the client hides source badges.

**Errors:** `400` invalid request; `404` document not found; `409` document is not completed; `503` no indexed chunks were returned; `500` retrieval/model/stream setup failure. Error response shape is `{ "error": "Could not answer that question. Try again." }` or a specific validation/status message.

## Integrations and configuration

- MongoDB/Mongoose via `MONGODB_URI`.
- Pinecone control plane and Documents API via `PINECONE_API_KEY`, `PINECONE_INDEX`; current API version is `2026-07`.
- OpenRouter via `OPENROUTER_API_KEY`, called with LangChain model `openai/gpt-4o-mini` at `https://openrouter.ai/api/v1`.
- Required variables are server-only; never prefix them with `NEXT_PUBLIC_`.

## Limits and operational behavior

- Upload and chat route handlers use Node.js runtime and declare a 60-second maximum duration.
- No pagination, filters, webhooks, CORS exceptions, or rate limiter currently exist.
- Provider calls are synchronous in request handlers. Do not add automatic retries for uploads unless idempotency/duplicate-write behavior is defined.
- Never expose provider response bodies, credentials, extracted document text, or prompts in API errors. Add rate limiting and authentication before public deployment.
