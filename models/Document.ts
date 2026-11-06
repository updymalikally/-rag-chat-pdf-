import { model, models, Schema, type Model } from "mongoose";
import type { DocumentStatus } from "@/lib/types";

export type PdfDocumentAttrs = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: DocumentStatus;
  pageCount: number;
  chunkCount: number;
  errorMessage?: string;
  createdAt: Date;
  processedAt?: Date;
};

const pdfDocumentSchema = new Schema<PdfDocumentAttrs>(
  {
    fileName: { type: String, required: true, trim: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
      index: true,
    },
    pageCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    errorMessage: { type: String },
    processedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Named PdfDocument so it never clashes with the DOM `Document` type.
export const PdfDocument: Model<PdfDocumentAttrs> =
  (models.PdfDocument as Model<PdfDocumentAttrs> | undefined) ??
  model<PdfDocumentAttrs>("PdfDocument", pdfDocumentSchema, "documents");
