# RAG Document Chat

A small web app for asking questions about documents. Upload a supported file, wait for its text to be indexed, then ask questions and check the cited source.

## What it does

- Accepts PDF, Word (`.docx`, `.doc`), PowerPoint (`.pptx`, `.ppt`), plain text (`.txt`), and Markdown (`.md`) files up to 10 MB.
- Extracts PDF pages and PowerPoint slides separately; Word, text, and Markdown files use document-level sources.
- Sends every format through the same text chunking and Pinecone indexing pipeline.
- Shows document processing status and lists completed uploads.
- Lets the user delete a document and its indexed Pinecone content from the document list.
- Streams answers grounded in the selected document and displays page, slide, or document citations.
- Supports light and dark themes.

Scanned PDFs are not supported because the app does not run OCR. Password-protected and damaged Office files cannot be indexed; upload an unprotected, readable copy.

## Requirements

- Node.js and npm
- A MongoDB database
- A Pinecone serverless index configured for the Documents API
- An OpenRouter API key

## Run locally

From the project directory, install dependencies and create the local environment file:

```powershell
npm install
Copy-Item .env.example .env.local
```

Set the following values in `.env.local`:

```dotenv
MONGODB_URI=your-mongodb-connection-string
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX=your-pinecone-index-name
OPENROUTER_API_KEY=your-openrouter-api-key
```

Keep `.env.local` private. The app reads these values on the server; do not add them to source control or expose them through `NEXT_PUBLIC_*` variables.

Configure the Pinecone index with a `chunk_text` string field that uses integrated embedding. The app writes each chunk with its filename, document ID, source type and source number (page or slide when available), and chunk index. The embedding model configured by the index must be available for both writes and searches; this project is set up for `llama-text-embed-v2`.

Start the development server:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful commands

```powershell
npm run dev        # Start the local development server
npm run typecheck  # Check TypeScript types
npm run build      # Create a production build
npm run start      # Serve the production build
```

## How a document gets processed

The upload route validates the extension, MIME type, size, and file signature, creates a `processing` record in MongoDB, and uses a format-specific loader to extract text. PDF pages and PowerPoint slides are kept as separate sources; other supported formats retain document-level citations. All extracted text is split into chunks of about 1,000 characters with 200 characters of overlap and stored in Pinecone under a namespace matching the document ID. The MongoDB record is marked `completed` after indexing finishes. If processing fails, the app records a failure message and attempts to remove any partial Pinecone writes.

When a question is submitted, the chat route checks the document status, retrieves the configured number of relevant chunks from that document's namespace, and sends those excerpts and recent conversation history to the configured model through OpenRouter. The answer is streamed to the browser; citations identify PDF pages, PowerPoint slides, DOCX headings, or document-level TXT content in the `X-Sources` response header. Older indexed chunks without section metadata continue to receive page, slide, or document-level citations.

## Project structure

```text
app/                    Pages and API routes
components/             Upload, document list, chat, and shared UI
lib/                    Format-aware document processing, validation, database, and Pinecone helpers
models/                 Mongoose document model
```

Project decisions and implementation notes:

- [Product requirements](./PRD.md)
- [Design guide](./DESIGN.md)
- [Architecture](./ARCHITECTURE.md)
- [Database model](./DATABASE.md)
- [API contract](./API.md)
- [Contributor and coding-agent rules](./AGENTS.md)
- [Implementation plan](./IMPLEMENTATION_PLAN.md)

## Current limits

- There is no sign-in or document ownership system. Run this as a local or trusted single-user app; it is not ready for public multi-user access.
- Documents are processed synchronously in the upload request. Large files or slow external services may exceed a hosting provider's request limit.
- Uploaded binaries are not retained, but extracted text is stored in Pinecone and relevant excerpts are sent to OpenRouter when answering questions.
- Chat history is kept in the browser for the active page and is not saved as a conversation.
- The app does not currently provide document deletion, OCR, or multi-document search.
