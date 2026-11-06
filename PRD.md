# Product Requirements Document

## Product

**RAG Document Chat** is a web app for uploading text-based PDFs and asking questions grounded in their contents. Answers include page references so a reader can check the source.

## Problem and value

Readers often need to locate facts across a PDF without scanning every page. The product extracts and indexes PDF text, retrieves relevant passages for a question, and presents a concise answer with source pages.

## Target users

- Students and researchers working with course notes, papers, and reports.
- Anyone who needs to ask questions about a text-based PDF.

The current implementation has no accounts or per-user ownership. **Assumption:** the MVP is a single-user/local demonstration. A public multi-user deployment requires an approved authentication and data ownership design before launch.

## Core journeys and stories

1. **Upload:** As a reader, I choose or drop a PDF, see transfer progress and processing status, and learn whether it is ready or why processing failed.
2. **Browse:** As a reader, I see uploaded documents, their status, size, and page count, and can open a completed document's chat.
3. **Ask:** As a reader, I ask a question about one completed PDF, see a streamed answer based only on retrieved text, and see the source pages.
4. **Recover:** As a reader, I can correct an invalid upload or retry after a service error without mistaking failure for a successful answer.

## Functional requirements

- Accept PDF files up to 10 MB. Reject empty, non-PDF, oversized, and textless/scanned documents with an understandable message.
- Extract page text, split it into overlapping chunks, and index chunks in a namespace dedicated to the document.
- Record document metadata and processing status in MongoDB. Expose completed, processing, and failed states.
- Show an upload progress bar while transferring; show an indeterminate processing state while extraction/indexing runs.
- List documents newest first. Only completed documents can open chat.
- Validate question length (1–2,000 characters), document ID, and supplied chat history. Stream answers and include source page numbers.
- The assistant must use retrieved document context only. If context does not answer the question, it must clearly say it could not find the answer in that document.
- Never send provider credentials to the browser.

## Pages and screens

- **Home (`/`)**: brand header, PDF upload/drop area, upload status, document list, quick start/help panels.
- **Document chat (`/chat/[documentId]`)**: document header and metadata, conversation, source page badges, question composer, theme control.
- **API routes**: `/api/documents`, `/api/upload`, `/api/chat` (specified in `API.md`).

## Roles and permissions

The current app has no authentication, roles, or authorization boundary. All users of the running instance can see its document list and use listed document IDs. This is acceptable only for a trusted single-user demonstration. **Approval required before public launch:** choose authentication, ownership rules, and migration of existing records if multiple users will use the app.

## Data and integrations

- MongoDB stores document metadata, counts, lifecycle status, timestamps, and a safe processing error message.
- Pinecone Documents API stores text chunks and page/chunk metadata in a namespace keyed by MongoDB document ID.
- LangChain PDFLoader and text splitters extract and chunk pages.
- OpenRouter provides the configured chat model (`openai/gpt-4o-mini`).
- Required environment variables: `MONGODB_URI`, `PINECONE_API_KEY`, `PINECONE_INDEX`, `OPENROUTER_API_KEY`.
- Original PDF binaries are not persistently stored by this app.

## States and error handling

- **Loading:** transfer percentage; processing/indexing indicator; chat answer stream indicator; document-list loading is handled by the server-rendered page.
- **Empty:** prompt to upload when no documents exist; empty conversation prompt before the first question.
- **Success:** completed status, indexed chunk count confirmation, streamed answer with sources.
- **Error:** actionable upload validation/service error, failed document status, invalid/missing document, unavailable database/index/model, or empty retrieval. Do not report a failed integration as a document-grounding refusal.

## Non-functional requirements

- Keep all database and provider calls on the server.
- Validate external input at API boundaries and avoid returning raw provider errors or secrets.
- Stream chat responses; keep answers concise and traceable to page numbers.
- Support small screens, keyboard use, screen readers, dark mode, and reduced-motion preferences.
- Keep the MVP understandable and maintainable; avoid adding infrastructure until usage requires it.
- Upload/chat routes currently have a 60-second maximum duration. Document this deployment constraint.

## MVP scope

PDF upload, text extraction and chunking, Pinecone indexing/retrieval, document listing/status, grounded streamed chat with page citations, and responsive light/dark UI.

## Out of scope

Scanned-PDF OCR, accounts and collaboration, document deletion/retention controls, conversation persistence, multi-document search, citations with clickable PDF viewer, billing, and background job infrastructure. Add only after a product decision.

## Success criteria

- Valid text PDFs under 10 MB upload and reach a terminal completed or failed state.
- A completed document is searchable and answers supported questions using its retrieved content with page references.
- Unanswerable questions are explicitly identified; service failures are shown as service failures.
- Invalid uploads and missing integrations produce useful errors without exposing secrets.
- Core upload and chat journeys work at desktop and mobile widths and are keyboard-accessible.

## Assumptions and decisions needing approval

- **Assumption:** initial use is one trusted user/local or controlled demonstration because no auth exists.
- **Approval before public deployment:** authentication provider and user/document ownership model.
- **Approval before adding:** deletion, persistent chat history, OCR, or multi-document search.
- **Deployment target, data-retention period, and expected document volume are unspecified.** Confirm these before production architecture decisions.
