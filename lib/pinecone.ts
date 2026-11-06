import { RETRIEVAL_TOP_K } from "@/lib/constants";
import { requireEnv } from "@/lib/env";
import type { TextChunk } from "@/lib/types";
import type { SourceType } from "@/lib/document-formats";

const PINECONE_API_VERSION = "2026-07";
const PINECONE_EMBED_BATCH_SIZE = 96;

type PineconeIndexDescription = { host?: string };
type PineconeErrorBody = { error?: { message?: string }; message?: string };
type SearchHit = {
  fields?: { chunk_text?: unknown; pageNumber?: unknown; sourceType?: unknown; sourceNumber?: unknown };
  chunk_text?: unknown;
  pageNumber?: unknown;
  sourceType?: unknown;
  sourceNumber?: unknown;
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
      pageNumber: chunk.pageNumber ?? chunk.sourceNumber ?? 0,
      sourceType: chunk.sourceType,
      sourceNumber: chunk.sourceNumber,
      chunkIndex: chunk.chunkIndex,
    }));

    await documentsRequest(documentId, "upsert", { documents }, signal);
    completedChunks += documents.length;
    onBatchStored?.(completedChunks, chunks.length);
  }
}

export type RetrievedChunk = { sourceType: SourceType; sourceNumber?: number; pageNumber?: number; text: string };

export async function searchChunks(documentId: string, question: string): Promise<RetrievedChunk[]> {
  const result = await documentsRequest<SearchResponse>(documentId, "search", {
    score_by: [{ type: "embed", fields: ["chunk_text"], query: question }],
    top_k: RETRIEVAL_TOP_K,
    include_fields: ["chunk_text", "pageNumber", "sourceType", "sourceNumber"],
  });

  return (result.matches ?? []).flatMap((match) => {
    // Documents API matches expose document fields directly; accept nested fields too
    // so the parser remains compatible with the Records API hit shape.
    const fields = match.fields ?? match;
    const text = typeof fields.chunk_text === "string" ? fields.chunk_text : "";
    const pageNumber = typeof fields.pageNumber === "number" ? fields.pageNumber : undefined;
    const sourceType = fields.sourceType === "slide" || fields.sourceType === "document" || fields.sourceType === "page"
      ? fields.sourceType
      : "page";
    const sourceNumber = typeof fields.sourceNumber === "number" ? fields.sourceNumber : pageNumber;
    return text ? [{ sourceType, sourceNumber, pageNumber, text }] : [];
  });
}

/** Remove partial document writes if processing fails midway. */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
  await documentsRequest(documentId, "delete", { filter: { documentId: { $eq: documentId } } });
}
