import type { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import type { DocumentDTO } from "@/lib/types";
import { getDocumentFileType, getDocumentSourceType } from "@/lib/document-formats";
import { PdfDocument, type PdfDocumentAttrs } from "@/models/Document";

type LeanDocument = PdfDocumentAttrs & { _id: Types.ObjectId };

function toDTO(doc: LeanDocument): DocumentDTO {
  return {
    id: doc._id.toString(),
    fileName: doc.fileName,
    fileSize: doc.fileSize,
    fileType: doc.fileType ?? getDocumentFileType(doc.fileName) ?? "pdf",
    status: doc.status,
    pageCount: doc.pageCount,
    sourceType: doc.sourceType ?? getDocumentSourceType(doc.fileType ?? getDocumentFileType(doc.fileName) ?? "pdf"),
    sourceCount: doc.sourceCount || doc.pageCount,
    chunkCount: doc.chunkCount,
    errorMessage: doc.errorMessage,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listDocuments(): Promise<DocumentDTO[]> {
  await connectDB();
  const docs = await PdfDocument.find().sort({ createdAt: -1 }).lean<LeanDocument[]>();
  return docs.map(toDTO);
}

export async function getDocument(id: string): Promise<DocumentDTO | null> {
  await connectDB();
  const doc = await PdfDocument.findById(id).lean<LeanDocument>();
  return doc ? toDTO(doc) : null;
}
