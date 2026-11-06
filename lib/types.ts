import type { DocumentFileType, SourceType } from "@/lib/document-formats";

export type DocumentStatus = "processing" | "completed" | "failed" | "cancelled";

/** Document shape sent to the UI (plain JSON, safe to pass to client components). */
export type DocumentDTO = {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: DocumentFileType;
  status: DocumentStatus;
  pageCount: number;
  sourceType: SourceType;
  sourceCount: number;
  chunkCount: number;
  errorMessage?: string;
  createdAt: string;
};

export type ChatRole = "user" | "assistant";

export type HistoryMessage = {
  role: ChatRole;
  content: string;
};

/** Metadata stored with every vector in Pinecone. */
export type ChunkMetadata = {
  documentId: string;
  fileName: string;
  pageNumber?: number;
  sourceType?: SourceType;
  sourceNumber?: number;
  chunkIndex: number;
  text: string;
};

export type TextChunk = {
  chunkIndex: number;
  pageNumber?: number;
  sourceType: SourceType;
  sourceNumber?: number;
  text: string;
};
