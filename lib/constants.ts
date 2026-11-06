// Shared by server and client code, so it must not import anything server-only.

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export { ACCEPTED_MIME_TYPE, ACCEPTED_UPLOAD_TYPES } from "@/lib/document-formats";

export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 200;
export const CHAT_MODEL = "gpt-4o-mini";
export const RETRIEVAL_TOP_K = 5;
export const MAX_HISTORY_MESSAGES = 6;

// The model is told to reply with exactly this sentence when the context has no answer.
// The chat window checks for it so it does not show source pages for a non-answer.
export const NOT_FOUND_MESSAGE = "I could not find that in this document.";
