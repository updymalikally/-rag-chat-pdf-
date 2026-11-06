import mongoose from "mongoose";
import { z } from "zod";
import { MAX_FILE_SIZE, MAX_HISTORY_MESSAGES } from "@/lib/constants";
import { DOCUMENT_FORMATS, getDocumentFileType } from "@/lib/document-formats";

export const documentFileSchema = z
  .instanceof(File, { message: "Choose a supported document file." })
  .refine((file) => getDocumentFileType(file.name) !== null, "Choose a PDF, Word, PowerPoint, text, or Markdown file.")
  .refine((file) => file.size > 0, "The file is empty.")
  .refine((file) => file.size <= MAX_FILE_SIZE, "The file is larger than 10 MB.")
  .superRefine((file, context) => {
    const fileType = getDocumentFileType(file.name);
    if (!fileType) return;
    const mimeType = file.type.toLowerCase();
    if (mimeType && mimeType !== "application/octet-stream" && !(DOCUMENT_FORMATS[fileType].mimeTypes as readonly string[]).includes(mimeType)) {
      context.addIssue({ code: "custom", message: `The file type does not match its ${DOCUMENT_FORMATS[fileType].extension} extension.` });
    }
  });

export const documentIdSchema = z
  .string()
  .refine((id) => mongoose.isValidObjectId(id), "Invalid document id.");

export const chatRequestSchema = z.object({
  documentId: documentIdSchema,
  question: z.string().trim().min(1, "Type a question.").max(2000, "The question is too long."),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(MAX_HISTORY_MESSAGES)
    .default([]),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
