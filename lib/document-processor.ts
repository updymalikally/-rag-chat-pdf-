// npm install @langchain/community@^0.3.56
// npm install @langchain/core@^0.3.77
// npm install @langchain/textsplitters@^0.1.0
// npm install langchain@^0.3.34
// (PDFLoader also needs: npm install pdf-parse@1.1.1)
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { CHUNK_OVERLAP, CHUNK_SIZE } from "@/lib/constants";
import type { TextChunk } from "@/lib/types";

export type ProcessedDocument = {
  pageCount: number;
  chunks: TextChunk[];
};

function readPageNumber(metadata: Record<string, unknown>): number {
  const loc = metadata.loc as { pageNumber?: unknown } | undefined;
  return typeof loc?.pageNumber === "number" ? loc.pageNumber : 1;
}

/**
 * Step 4: extract the text of every page, then split it into overlapping chunks.
 * Each chunk keeps the page it came from, so answers can show their source pages.
 */
export async function processDocument(file: File): Promise<ProcessedDocument> {
  const loader = new PDFLoader(file, { splitPages: true }); // one LangChain Document per page
  const pages = await loader.load();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  const textPages = pages.filter((page) => page.pageContent.trim().length > 0);
  const pieces = await splitter.splitDocuments(textPages);

  const chunks = pieces.map<TextChunk>((piece, chunkIndex) => ({
    chunkIndex,
    pageNumber: readPageNumber(piece.metadata),
    text: piece.pageContent,
  }));

  return { pageCount: pages.length, chunks };
}
