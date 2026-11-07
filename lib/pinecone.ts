import { RETRIEVAL_TOP_K } from "@/lib/constants";
import { requireEnv } from "@/lib/env";
import type { TextChunk } from "@/lib/types";
import type { DocumentFileType, SourceType } from "@/lib/document-formats";

const PINECONE_API_VERSION = "2026-07";
const PINECONE_EMBED_BATCH_SIZE = 96;
const DELETE_VERIFY_ATTEMPTS = 8;
const DELETE_VERIFY_INTERVAL_MS = 600;

export class PineconeNamespaceDeletePendingError extends Error {}

type PineconeIndexDescription = { host?: string };
type PineconeErrorBody = { error?: { message?: string }; message?: string };
type SearchHit = {
  fields?: Record<string, unknown>;
  _id?: unknown;
  chunk_text?: unknown;
  pageNumber?: unknown;
  sourceType?: unknown;
  sourceNumber?: unknown;
  sectionTitle?: unknown;
  fileType?: unknown;
  uploadDate?: unknown;
  documentId?: unknown;
  title?: unknown;
  chunkIndex?: unknown;
};
type SearchResponse = { matches?: SearchHit[] };

let indexHostPromise: Promise<string> | undefined;

async function getIndexHost(): Promise<string> {
  indexHostPromise ??= (async () => {
    const indexName = requireEnv("PINECONE_INDEX");
    const response = await fetch(`https://api.pinecone.io/indexes/${encodeURIComponent(indexName)}`, {
      headers: {
        "Api-Key": requireEnv("PINECONE_API_KEY"),
        "X-Pinecone-Api-Version": PINECONE_API_VERSION,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Could not look up Pinecone index (${response.status}): ${detail.slice(0, 240)}`);
    }
    const index = (await response.json()) as PineconeIndexDescription;
    if (!index.host) throw new Error("Pinecone did not return a host for the configured index.");
    return index.host;
  })().catch((error) => {
    indexHostPromise = undefined;
    throw error;
  });

  return indexHostPromise;
}

async function documentsRequest<T>(
  namespace: string,
  operation: "upsert" | "search" | "delete",
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const host = await getIndexHost();
  const response = await fetch(
    `https://${host}/namespaces/${encodeURIComponent(namespace)}/documents/${operation}`,
    {
      method: "POST",
      headers: {
        "Api-Key": requireEnv("PINECONE_API_KEY"),
        "X-Pinecone-Api-Version": PINECONE_API_VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    },
  );

  if (!response.ok) {
    const detail = (await response.text()).replace(/\bsk-[A-Za-z0-9_-]+\b/g, "[redacted]").slice(0, 400);
    throw new Error(`Pinecone ${operation} failed (${response.status}): ${detail}`);
  }

  const responseText = await response.text();
  return (responseText ? JSON.parse(responseText) : {}) as T;
}

/** This index's chunk_text field uses Pinecone integrated embedding (llama-text-embed-v2). */
export async function storeChunks(
  documentId: string,
  fileName: string,
  fileType: DocumentFileType,
  uploadDate: Date,
  chunks: TextChunk[],
  onBatchStored?: (completedChunks: number, totalChunks: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  let completedChunks = 0;
  for (let start = 0; start < chunks.length; start += PINECONE_EMBED_BATCH_SIZE) {
    signal?.throwIfAborted();
    const documents = chunks.slice(start, start + PINECONE_EMBED_BATCH_SIZE).map((chunk) => ({
      _id: `${documentId}-${chunk.chunkIndex}`,
      chunk_text: chunk.text,
      title: fileName,
      documentId,
      fileType,
      uploadDate: uploadDate.toISOString(),
      pageNumber: chunk.pageNumber ?? chunk.sourceNumber ?? 0,
      sourceType: chunk.sourceType,
      sourceNumber: chunk.sourceNumber,
      sectionTitle: chunk.sectionTitle,
      chunkIndex: chunk.chunkIndex,
    }));

    await documentsRequest(documentId, "upsert", { documents }, signal);
    completedChunks += documents.length;
    onBatchStored?.(completedChunks, chunks.length);
  }
}

export type RetrievedChunk = {
  documentId?: string;
  title?: string;
  fileType?: DocumentFileType;
  uploadDate?: string;
  chunkIndex?: number;
  sectionTitle?: string;
  sourceType: SourceType;
  sourceNumber?: number;
  pageNumber?: number;
  text: string;
};

export async function searchChunks(
  documentId: string,
  question: string,
  fallbackSourceType: SourceType = "document",
): Promise<RetrievedChunk[]> {
  const result = await documentsRequest<SearchResponse>(documentId, "search", {
    score_by: [{ type: "embed", fields: ["chunk_text"], query: question }],
    top_k: RETRIEVAL_TOP_K,
    include_fields: [
      "chunk_text", "documentId", "title", "fileType", "uploadDate", "chunkIndex", "sectionTitle",
      "pageNumber", "sourceType", "sourceNumber",
    ],
  });

  return (result.matches ?? []).flatMap((match) => {
    // Documents API matches expose document fields directly; accept nested fields too
    // so the parser remains compatible with the Records API hit shape.
    const fields = match.fields ?? match;
    if (typeof fields.documentId === "string" && fields.documentId !== documentId) return [];
    const text = typeof fields.chunk_text === "string" ? fields.chunk_text : "";
    const rawPageNumber = typeof fields.pageNumber === "number" ? fields.pageNumber : undefined;
    const pageNumber = rawPageNumber !== undefined && rawPageNumber > 0 ? rawPageNumber : undefined;
    const sourceType = fields.sourceType === "slide" || fields.sourceType === "document" || fields.sourceType === "page"
      ? fields.sourceType
      : fallbackSourceType;
    const rawSourceNumber = typeof fields.sourceNumber === "number" ? fields.sourceNumber : pageNumber;
    const sourceNumber = rawSourceNumber !== undefined && rawSourceNumber > 0 ? rawSourceNumber : undefined;
    const fileType = ["pdf", "docx", "doc", "pptx", "ppt", "txt", "md"].includes(String(fields.fileType))
      ? fields.fileType as DocumentFileType
      : undefined;
    return text ? [{
      documentId: typeof fields.documentId === "string" ? fields.documentId : undefined,
      title: typeof fields.title === "string" ? fields.title : undefined,
      fileType,
      uploadDate: typeof fields.uploadDate === "string" ? fields.uploadDate : undefined,
      chunkIndex: typeof fields.chunkIndex === "number" ? fields.chunkIndex : undefined,
      sectionTitle: typeof fields.sectionTitle === "string" && fields.sectionTitle.trim() ? fields.sectionTitle : undefined,
      sourceType,
      sourceNumber,
      pageNumber,
      text,
    }] : [];
  });
}

/** Remove partial document writes if processing fails midway. */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
  await documentsRequest(documentId, "delete", { filter: { documentId: { $eq: documentId } } });
}

/** Each document owns its Pinecone namespace, so deleting the namespace contents removes every chunk. */
export async function deleteDocumentNamespace(documentId: string): Promise<void> {
  await documentsRequest(documentId, "delete", { delete_all: true });

  // Pinecone accepts namespace deletion asynchronously. Confirm the namespace no
  // longer returns documents before the caller removes the MongoDB source record.
  for (let attempt = 0; attempt < DELETE_VERIFY_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, DELETE_VERIFY_INTERVAL_MS));
    const result = await documentsRequest<SearchResponse>(documentId, "search", {
      score_by: [{ type: "embed", fields: ["chunk_text"], query: "namespace deletion verification" }],
      top_k: 1,
      include_fields: ["documentId"],
    });
    if ((result.matches?.length ?? 0) === 0) return;
  }

  throw new PineconeNamespaceDeletePendingError("Pinecone has not finished deleting this namespace yet.");
}
