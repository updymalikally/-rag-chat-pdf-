"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MessageBubble, type ChatMessage } from "@/components/message-bubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_HISTORY_MESSAGES } from "@/lib/constants";

type ChatWindowProps = {
  documentId: string;
  fileName: string;
};

function parseSources(header: string | null): number[] {
  if (!header) return [];
  try {
    const value: unknown = JSON.parse(header);
    return Array.isArray(value) ? value.filter((page): page is number => typeof page === "number") : [];
  } catch {
    return [];
  }
}

export function ChatWindow({ documentId, fileName }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Grow the textarea with its content, up to about six lines
  useEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function updateMessage(id: string, update: (message: ChatMessage) => ChatMessage) {
    setMessages((current) => current.map((message) => (message.id === id ? update(message) : message)));
  }

  async function sendQuestion() {
    const question = input.trim();
    if (!question || isStreaming) return;

    const history = messages
      .filter((message) => message.status === "done")
      .slice(-MAX_HISTORY_MESSAGES)
      .map(({ role, content }) => ({ role, content }));

    const assistantId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: question, sources: [], status: "done" },
      { id: assistantId, role: "assistant", content: "", sources: [], status: "streaming" },
    ]);
    setInput("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, question, history }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const data: { error?: string } | null = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong. Try again.");
      }

      const sources = parseSources(response.headers.get("X-Sources"));
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        updateMessage(assistantId, (message) => ({ ...message, content: message.content + text }));
      }
      updateMessage(assistantId, (message) => ({ ...message, sources, status: "done" }));
    } catch (error) {
      if (controller.signal.aborted) return;
      const text = error instanceof Error ? error.message : "Something went wrong. Try again.";
      updateMessage(assistantId, (message) => ({
        ...message,
        status: "error",
        content: message.content ? `${message.content}\n\n${text}` : text,
      }));
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a new line
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendQuestion();
    }
  }

  return (
    <section className="flex h-[calc(100dvh-165px)] min-h-[480px] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6" aria-live="polite">
        {messages.length === 0 ? (
          <div className="m-auto max-w-sm text-center">
            <p className="text-base font-semibold">Ask about {fileName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a specific question, like “What are the main conclusions?” Answers come only from this document.
            </p>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-4">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about this PDF"
            aria-label="Ask a question about this PDF"
            maxLength={2000}
          />
          <Button
            size="icon"
            aria-label="Send message"
            disabled={isStreaming || input.trim() === ""}
            onClick={() => void sendQuestion()}
          >
            <ArrowUp className="h-[18px] w-[18px]" aria-hidden="true" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Enter to send · Shift+Enter for a new line</p>
      </div>
    </section>
  );
}
