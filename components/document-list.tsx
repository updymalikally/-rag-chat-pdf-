import { FileText, MessageSquare } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import type { DocumentDTO } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

export function DocumentList({ documents }: { documents: DocumentDTO[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4" aria-hidden="true" />
          Your documents
        </h2>
        <span className="text-xs text-muted-foreground">{documents.length} {documents.length === 1 ? "file" : "files"}</span>
      </div>

      {documents.length === 0 ? (
        <p className="border-t border-border px-5 py-8 text-center text-sm text-muted-foreground">
          Your uploaded PDFs will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-border px-4 sm:px-5">
          {documents.map((doc) => (
            <li key={doc.id} className="flex min-w-0 items-start gap-3 py-3.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium" title={doc.fileName}>{doc.fileName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusBadge status={doc.status} />
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(doc.fileSize)}
                    {doc.status === "completed" && ` · ${doc.pageCount} ${doc.pageCount === 1 ? "page" : "pages"}`}
                  </span>
                </div>
                {doc.status === "failed" && (
                  <p className="mt-1.5 line-clamp-2 text-xs text-red-700 dark:text-red-300">
                    {doc.errorMessage ?? "Processing failed. Try uploading the file again."}
                  </p>
                )}
              </div>
              {doc.status === "completed" ? (
                <Link
                  href={`/chat/${doc.id}`}
                  className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
                  aria-label={`Chat with ${doc.fileName}`}
                  title="Open chat"
                >
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground" aria-hidden="true">
                  <MessageSquare className="h-4 w-4" />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
