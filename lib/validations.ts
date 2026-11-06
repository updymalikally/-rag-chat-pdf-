import mongoose from "mongoose";
import { z } from "zod";
import { MAX_FILE_SIZE, MAX_HISTORY_MESSAGES } from "@/lib/constants";

export const pdfFileSchema = z
  .instanceof(File, { message: "Attach a PDF file." })
  .refine((file) => file.name.toLowerCase().endsWith(".pdf"), "Choose a PDF file.")
  .refine((file) => file.size > 0, "The file is empty.")
  .refine((file) => file.size <= MAX_FILE_SIZE, "The file is larger than 10 MB.");

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
