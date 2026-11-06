# RAG Document Chat

A small web app for asking questions about PDF documents. Upload a PDF, wait for its text to be indexed, then ask questions and check the cited pages.

## What it does

- Accepts text-based PDF files up to 10 MB.
- Extracts text page by page and indexes overlapping chunks.
- Shows document processing status and lists completed uploads.
- Streams answers grounded in the selected document and displays source page numbers.
- Supports light and dark themes.

Scanned PDFs are not supported because the app does not run OCR.

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

Configure the Pinecone index with a `chunk_text` string field that uses integrated embedding. The app writes each chunk with its filename, document ID, page number, and chunk index. The embedding model configured by the index must be available for both writes and searches; this project is set up for `llama-text-embed-v2`.

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

The upload route validates the PDF, creates a `processing` record in MongoDB, extracts page text, and splits it into chunks of about 1,000 characters with 200 characters of overlap. Chunks are stored in Pinecone under a namespace matching the document ID. The MongoDB record is marked `completed` after indexing finishes. If processing fails, the app records a failure message and attempts to remove any partial Pinecone writes.

When a question is submitted, the chat route checks the document status, retrieves up to five relevant chunks from that document's namespace, and sends those excerpts and recent conversation history to the configured model through OpenRouter. The answer is streamed to the browser; source page numbers are returned in the `X-Sources` response header.

## Project structure

```text
app/                    Pages and API routes
components/             Upload, document list, chat, and shared UI
lib/                    PDF processing, validation, database, and Pinecone helpers
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
- PDFs are processed synchronously in the upload request. Large files or slow external services may exceed a hosting provider's request limit.
- Uploaded PDF binaries are not retained, but extracted text is stored in Pinecone and relevant excerpts are sent to OpenRouter when answering questions.
- Chat history is kept in the browser for the active page and is not saved as a conversation.
- The app does not currently provide document deletion, OCR, or multi-document search.
