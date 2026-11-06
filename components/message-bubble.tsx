import { NOT_FOUND_MESSAGE } from "@/lib/constants";
import type { ChatRole } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  sources: number[];
  status: "streaming" | "done" | "error";
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="max-w-[80%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-[15px] leading-relaxed text-primary-foreground">
        {message.content}
      </div>
    );
  }

  const isWaiting = message.status === "streaming" && message.content === "";
  const showSources =
    message.status === "done" && message.sources.length > 0 && !message.content.startsWith(NOT_FOUND_MESSAGE);

  return (
    <div className="flex max-w-[80%] flex-col gap-2 self-start">
      <div
        className={cn(
          "whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-[15px] leading-relaxed",
          message.status === "error" && "text-red-700 dark:text-red-300",
        )}
      >
        {isWaiting ? (
          <div className="flex w-56 flex-col gap-1.5 py-1" aria-hidden="true">
            <div className="h-2.5 w-11/12 animate-pulse rounded-full bg-border" />
            <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-border" />
          </div>
        ) : (
          message.content
        )}
      </div>

      {isWaiting && <span className="text-xs text-muted-foreground">Generating answer…</span>}

      {showSources && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Sources</span>
          {message.sources.map((page) => (
            <span
              key={page}
              className="inline-flex min-h-7 items-center rounded-full border border-input bg-card px-3 text-[13px]"
            >
              Page {page}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
