import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import { NextResponse } from "next/server";
import { NOT_FOUND_MESSAGE } from "@/lib/constants";
import { getDocument } from "@/lib/documents";
import { getChatModel } from "@/lib/embeddings";
import { searchChunks, type RetrievedChunk } from "@/lib/pinecone";
import type { SourceType } from "@/lib/document-formats";
import { chatRequestSchema } from "@/lib/validations";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You answer questions about one document, using only the context excerpts you are given.
Each excerpt starts with a source label, such as a page or slide number, or the document name.
If the answer is not in the context, reply with exactly: ${NOT_FOUND_MESSAGE}
Never use outside knowledge. Keep answers clear and concise.
Do not mention source labels in your answer; the interface shows them.`;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function buildContext(chunks: RetrievedChunk[]): string {
  return chunks.map((chunk) => `[${sourceLabel(chunk.sourceType, chunk.sourceNumber, chunk.sectionTitle)}]\n${chunk.text}`).join("\n\n---\n\n");
}

function sourceLabel(type: SourceType, number?: number, sectionTitle?: string): string {
  if (type === "document" && sectionTitle) return `Section: ${sectionTitle}`;
  if (type === "document") return "Document";
  return number === undefined ? (type === "slide" ? "Slide" : "Page") : `${type === "slide" ? "Slide" : "Page"} ${number}`;
}

function uniqueSources(chunks: RetrievedChunk[]): { type: SourceType; number?: number; sectionTitle?: string }[] {
  const unique = new Map<string, { type: SourceType; number?: number; sectionTitle?: string }>();
  for (const chunk of chunks) {
    const source = { type: chunk.sourceType, number: chunk.sourceNumber, sectionTitle: chunk.sectionTitle };
    unique.set(`${source.type}:${source.number ?? ""}:${source.sectionTitle ?? ""}`, source);
  }
  return [...unique.values()];
}

/** Chunk content is a string for text models; other shapes are flattened to their text parts. */
function chunkText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (typeof part === "object" && part !== null && "text" in part ? String(part.text) : ""))
    .join("");
}

export async function POST(request: Request) {
  // 1- Receive { documentId, question, history }
  const body: unknown = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid request.", 400);
  }
  const { documentId, question, history } = parsed.data;

  try {
    // 2- Check the document exists and has status "completed"
    const document = await getDocument(documentId);
    if (!document) return errorResponse("Document not found.", 404);
    if (document.status !== "completed") {
      return errorResponse("This document is not ready yet. Wait for indexing to finish.", 409);
    }

    // 3- Search Pinecone's integrated embedding field for the closest chunks.
    const chunks = await searchChunks(documentId, question, document.sourceType);
    if (chunks.length === 0) {
      console.error(`No indexed chunks were returned for document ${documentId}`);
      return errorResponse(
        "I couldn't retrieve this document's indexed text. Re-upload it to index it again, then retry.",
        503,
      );
    }

    // 5- Build the prompt: answer only from the retrieved context
    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM_PROMPT),
      ...history.map((message) =>
        message.role === "user" ? new HumanMessage(message.content) : new AIMessage(message.content),
      ),
      new HumanMessage(`Context:\n${buildContext(chunks)}\n\nQuestion: ${question}`),
    ];

    // 6- Stream the answer to the client
    const modelStream = await getChatModel().stream(messages);
    const encoder = new TextEncoder();
    const answerStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of modelStream) {
            controller.enqueue(encoder.encode(chunkText(chunk.content)));
          }
          controller.close();
        } catch (error) {
          console.error("Streaming the answer failed", error);
          controller.error(error);
        }
      },
    });

    // 7- Return page, slide, or document-level sources before streaming starts.
    return new Response(answerStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Sources": JSON.stringify(uniqueSources(chunks)),
      },
    });
  } catch (error) {
    console.error("Chat request failed", error);
    return errorResponse("Could not answer that question. Try again.", 500);
  }
}
