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
      "fileType": "pdf",
      "status": "completed",
      "pageCount": 4,
      "sourceType": "page",
      "sourceCount": 4,
      "chunkCount": 8,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

`status` is `processing`, `completed`, `failed`, or `cancelled`. Failed/cancelled entries may include a safe `errorMessage`.

**Errors:** `500 { "error": "Could not load your documents." }`.

## `DELETE /api/documents/{documentId}`

Deletes the document's dedicated Pinecone namespace contents and then removes its MongoDB document record. Processing documents cannot be deleted until processing finishes. The API validates the MongoDB ObjectId and keeps the MongoDB record if Pinecone cleanup fails, so the operation can be retried.

**Success `200`:** `{ "success": true, "documentId": "<mongo-object-id>" }`.

**Errors:** `400` invalid ID; `404` document not found; `409` document is still processing; `500` Pinecone or database cleanup failed. Deletion from Pinecone is asynchronous after the service accepts the delete request.

## `POST /api/upload`

Accepts PDF (`.pdf`), Word (`.docx`, `.doc`), PowerPoint (`.pptx`, `.ppt`), plain text (`.txt`), and Markdown (`.md`) files. Browser uploads use a raw body with the filename in `X-File-Name` and the file MIME type in `Content-Type`; existing clients may send `multipart/form-data`, field `file`. Maximum 10 MB. The server validates extension, MIME type, nonempty content, PDF/Office signatures, and UTF-8 for text files. ZIP-backed DOCX/PPTX archives are also validated by their format parser.

After validation and creation of the MongoDB document, the endpoint streams newline-delimited JSON events with content type `application/x-ndjson` and HTTP status `200`. Progress events include an overall server-processing percentage and stage (`extracting`, `chunking`, `embedding-indexing`, or `saving`). Pinecone uses integrated embedding, so embedding and vector indexing progress is reported together as successfully upserted chunks. The final `complete` event reports 100% only after the completed MongoDB record is saved. Early validation/database errors remain ordinary JSON error responses; processing errors are streamed as `error` events.

**Final `complete` event**

```json
{
  "type": "complete",
  "progress": 100,
  "body": {
    "documentId": "<mongo-object-id>",
    "fileName": "notes.pdf",
    "fileType": "pdf",
    "sourceType": "page",
    "sourceCount": 4,
    "chunkCount": 8,
    "status": "completed"
  }
}
```

**Errors:** `400` invalid/missing upload; `422` no extractable text; `500` database, Pinecone, or processing failure. Early error response shape: `{ "error": "Human-readable message" }`; streamed error events carry the same body shape. A cancelled request aborts an in-flight Pinecone batch when possible, records a cancelled MongoDB document, and attempts cleanup of partial writes.

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

**Success `200`:** UTF-8 `text/plain` streamed answer. Headers include `Cache-Control: no-store` and `X-Sources`, a JSON array of source objects such as `[{"type":"page","number":1},{"type":"slide","number":3},{"type":"document"}]`. The client also accepts the older numeric page array for compatibility. If the context does not contain an answer, the model returns the configured refusal sentence and the client hides source badges.

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
