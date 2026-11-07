import { NextResponse } from "next/server";
import { DocumentContentError, DocumentLoadError, processDocument, type ProcessingStage } from "@/lib/document-processor";
import { connectDB } from "@/lib/mongodb";
import { DOCUMENT_FORMATS, getDocumentFileType, getDocumentSourceType } from "@/lib/document-formats";
import { deleteDocumentChunks, storeChunks } from "@/lib/pinecone";
import { documentFileSchema } from "@/lib/validations";
import { PdfDocument } from "@/models/Document";

export const runtime = "nodejs";
export const maxDuration = 60;

class UserFacingError extends Error {}

function processingErrorMessage(error: unknown, stage: string): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof DocumentContentError) return error.message;
  if (error instanceof DocumentLoadError) return error.message;

  const detail = error instanceof Error ? error.message : "Unknown service error.";
  if (/password|encrypted|decrypt/i.test(detail)) {
    return "This document may be password-protected. Remove its password and upload it again.";
  }
  const missingSetting = detail.match(
    /Missing environment variable (OPENROUTER_API_KEY|PINECONE_API_KEY|PINECONE_INDEX)/,
  )?.[1];
  if (missingSetting) {
    return `Upload setup is incomplete: add ${missingSetting} to .env.local, restart the server, and try again.`;
  }

  if (stage.includes("Pinecone")) {
    if (/dimension|vector.*size/i.test(detail)) {
      return "Pinecone rejected the vector dimensions. This app uses 1536 dimensional embeddings; set the Pinecone index dimension to 1536 and its metric to cosine.";
    }
    if (/unauthorized|forbidden|authentication|invalid api key|\b401\b|\b403\b/i.test(detail)) {
      return "Pinecone rejected the API key. Check PINECONE_API_KEY in .env.local and restart the server.";
    }
    if (/index.*not found|not found.*index|\b404\b/i.test(detail)) {
      return "Pinecone could not find the configured index. Check that PINECONE_INDEX matches an existing index.";
    }

    const safeDetail = detail.replace(/\bsk-[A-Za-z0-9_-]+\b/g, "[redacted]").slice(0, 240);
    return `Pinecone could not store the vectors: ${safeDetail || "check PINECONE_API_KEY and PINECONE_INDEX"}`;
  }

  return `Could not ${stage}. Check the server logs and service settings, then try again.`;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function getFileFromRequest(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();

  // Raw request bodies let the browser report upload progress for every supported format.
  // Keep multipart support for existing API clients.
  if (request.headers.has("x-file-name")) {
    const encodedName = request.headers.get("x-file-name") ?? "document.pdf";
    let fileName: string;
    try {
      fileName = decodeURIComponent(encodedName);
    } catch {
      fileName = encodedName;
    }
    return new File([await request.arrayBuffer()], fileName, { type: contentType ?? "" });
  }

  const formData = await request.formData();
  return formData.get("file");
}

async function hasExpectedSignature(file: File): Promise<boolean> {
  const fileType = getDocumentFileType(file.name);
  if (!fileType) return false;
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (fileType === "pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  if (fileType === "doc" || fileType === "ppt") {
    return bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1][index]);
  }
  if (fileType === "docx" || fileType === "pptx") {
    return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  }

  try {
    const contents = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    return !contents.includes("\u0000");
  } catch {
    return false;
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

type ProgressStage = "extracting" | "chunking" | "embedding-indexing" | "saving";

const PROGRESS_RANGES: Record<ProgressStage, { start: number; weight: number }> = {
  extracting: { start: 0, weight: 0.2 },
  chunking: { start: 0.2, weight: 0.1 },
  "embedding-indexing": { start: 0.3, weight: 0.65 },
  saving: { start: 0.95, weight: 0.05 },
};

// 1. Read and validate the uploaded document.
export async function POST(request: Request) {
  let entry: unknown;
  try {
    entry = await getFileFromRequest(request);
  } catch {
    return errorResponse("Send a supported document file to the upload endpoint.", 400);
  }

  const validation = documentFileSchema.safeParse(entry);
  if (!validation.success) {
    return errorResponse(validation.error.issues[0]?.message ?? "Invalid file.", 400);
  }
  const file = validation.data;
  const fileType = getDocumentFileType(file.name);
  if (!fileType || !(await hasExpectedSignature(file))) {
    return errorResponse("The file contents do not match a supported document format, or the file is damaged.", 400);
  }

  // 2. Create the document record before starting work so a failed process is visible.
  let document;
  try {
    await connectDB();
    document = await PdfDocument.create({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || DOCUMENT_FORMATS[fileType].mimeTypes[0],
      fileType,
      sourceType: getDocumentSourceType(fileType),
      status: "processing",
    });
  } catch (error) {
    console.error("Could not start PDF upload", error);
    return errorResponse("Could not save the document. Check the database connection and try again.", 500);
  }

  const documentId = document._id.toString();
  const abortController = new AbortController();
  let consumerCancelled = false;
  const abortOnRequest = () => abortController.abort();
  request.signal.addEventListener("abort", abortOnRequest, { once: true });
  if (request.signal.aborted) abortController.abort();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: Record<string, unknown>) => {
        if (consumerCancelled || abortController.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          consumerCancelled = true;
          abortController.abort();
        }
      };

      const report = (stage: ProgressStage, fraction: number, detail?: Record<string, unknown>) => {
        const range = PROGRESS_RANGES[stage];
        const clamped = Math.min(1, Math.max(0, fraction));
        emit({
          type: "progress",
          stage,
          progress: Math.round((range.start + range.weight * clamped) * 10000) / 100,
          ...detail,
        });
      };

      void (async () => {
        let failedStage = "extract text from the uploaded document";
        try {
          abortController.signal.throwIfAborted();

          const { pageCount, sourceCount, sourceType, chunks } = await processDocument(file, documentId, (stage: ProcessingStage, fraction) => {
            report(stage, fraction);
          });
          abortController.signal.throwIfAborted();

          if (chunks.length === 0) {
            throw new UserFacingError(
              fileType === "pdf"
                ? "No readable text was found. Scanned PDFs are not supported."
                : "No readable text was found in this document.",
            );
          }

          failedStage = "store the document in Pinecone";
          report("embedding-indexing", 0, { completedChunks: 0, totalChunks: chunks.length });
          await storeChunks(
            documentId,
            file.name,
            fileType,
            document.createdAt,
            chunks,
            (completedChunks, totalChunks) => {
              report("embedding-indexing", completedChunks / totalChunks, { completedChunks, totalChunks });
            },
            abortController.signal,
          );
          abortController.signal.throwIfAborted();

          failedStage = "save the completed document";
          report("saving", 0);
          document.set({
            status: "completed",
            pageCount,
            sourceCount,
            sourceType,
            chunkCount: chunks.length,
            processedAt: new Date(),
          });
          await document.save();

          emit({
            type: "complete",
            progress: 100,
            body: {
              documentId,
              fileName: file.name,
              fileType,
              sourceType,
              sourceCount,
              chunkCount: chunks.length,
              status: "completed",
            },
          });
          if (!consumerCancelled) controller.close();
        } catch (error) {
          const cancelled = abortController.signal.aborted || consumerCancelled || isAbort(error);
          const message = cancelled ? "Upload cancelled." : processingErrorMessage(error, failedStage);

          if (!cancelled) console.error(`Processing failed for document ${documentId}`, error);
          await deleteDocumentChunks(documentId).catch((cleanupError) =>
            console.error(`Vector cleanup failed for document ${documentId}`, cleanupError),
          );
          await PdfDocument.findByIdAndUpdate(documentId, {
            status: cancelled ? "cancelled" : "failed",
            errorMessage: message,
          });

          emit({
            type: "error",
            status: cancelled
              ? 499
              : error instanceof UserFacingError || error instanceof DocumentContentError || error instanceof DocumentLoadError
                ? 422
                : 500,
            body: { error: message },
          });
          if (!consumerCancelled) controller.close();
        } finally {
          request.signal.removeEventListener("abort", abortOnRequest);
        }
      })();
    },
    cancel() {
      consumerCancelled = true;
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
