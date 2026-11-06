import { NextResponse } from "next/server";
import { processDocument } from "@/lib/document-processor";
import { connectDB } from "@/lib/mongodb";
import { deleteDocumentChunks, storeChunks } from "@/lib/pinecone";
import { pdfFileSchema } from "@/lib/validations";
import { PdfDocument } from "@/models/Document";

export const runtime = "nodejs";
export const maxDuration = 60;

class UserFacingError extends Error {}

function processingErrorMessage(error: unknown, stage: string): string {
  if (error instanceof UserFacingError) return error.message;

  const detail = error instanceof Error ? error.message : "Unknown service error.";
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

    // Pinecone errors do not include credentials, but redact token-like strings defensively.
    const safeDetail = detail.replace(/\bsk-[A-Za-z0-9_-]+\b/g, "[redacted]").slice(0, 240);
    return `Pinecone could not store the vectors: ${safeDetail || "check PINECONE_API_KEY and PINECONE_INDEX"}`;
  }

  return `Could not ${stage}. Check the server logs and service settings, then try again.`;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// 1- get the file from the request
async function getFileFromRequest(request: Request): Promise<unknown> {
  const formData = await request.formData();
  return formData.get("file");
}

// 2- Validate the file (zod checks type and size, then we confirm the PDF signature)
async function validateFile(entry: unknown): Promise<{ file: File } | { error: string }> {
  const parsed = pdfFileSchema.safeParse(entry);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid file." };

  const signature = await parsed.data.slice(0, 5).text();
  if (signature !== "%PDF-") return { error: "This file is not a valid PDF." };

  return { file: parsed.data };
}

export async function POST(request: Request) {
  // 1
  let entry: unknown;
  try {
    entry = await getFileFromRequest(request);
  } catch {
    return errorResponse("Send the PDF as multipart/form-data in a field named file.", 400);
  }

  // 2
  const validation = await validateFile(entry);
  if ("error" in validation) return errorResponse(validation.error, 400);
  const { file } = validation;

  // 3- Save the file information to the database
  let document;
  try {
    await connectDB();
    document = await PdfDocument.create({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/pdf",
      status: "processing",
    });
  } catch (error) {
    console.error("Could not start PDF upload", error);
    return errorResponse("Could not save the document. Check the database connection and try again.", 500);
  }
  const documentId = document._id.toString();
  let stage = "extract text from the PDF";

  try {
    // 4- Process the document (extract text and create chunks)
    const { pageCount, chunks } = await processDocument(file);
    if (chunks.length === 0) {
      throw new UserFacingError("No extractable text found. Scanned PDFs are not supported.");
    }

    // 5- Generate embeddings for all chunks
    // 5- Store chunks; the configured Pinecone index embeds its chunk_text field.
    stage = "store the document in Pinecone";
    await storeChunks(documentId, file.name, chunks);

    // 7- Update document in MongoDB with completion status
    stage = "save the completed document";
    document.set({
      status: "completed",
      pageCount,
      chunkCount: chunks.length,
      processedAt: new Date(),
    });
    await document.save();

    // 8- Return success response
    return NextResponse.json(
      { documentId, fileName: file.name, chunkCount: chunks.length, status: "completed" },
      { status: 201 },
    );
  } catch (error) {
    console.error(`Processing failed for document ${documentId}`, error);

    const message = processingErrorMessage(error, stage);

    // Remove any vectors that were already stored, then record the failure
    await deleteDocumentChunks(documentId).catch((cleanupError) =>
      console.error(`Vector cleanup failed for document ${documentId}`, cleanupError),
    );
    await PdfDocument.findByIdAndUpdate(documentId, { status: "failed", errorMessage: message });

    return errorResponse(message, error instanceof UserFacingError ? 422 : 500);
  }
}
