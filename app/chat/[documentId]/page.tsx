import { notFound } from "next/navigation";
import { ChatWindow } from "@/components/chat-window";
import { SiteHeader } from "@/components/site-header";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { getDocument } from "@/lib/documents";
import { formatBytes } from "@/lib/utils";
import { documentIdSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type ChatPageProps = {
  params: Promise<{ documentId: string }>;
};

export default async function ChatPage({ params }: ChatPageProps) {
  const { documentId } = await params;
  if (!documentIdSchema.safeParse(documentId).success) notFound();

  const document = await getDocument(documentId);
  if (!document) notFound();

  return (
    <>
      <SiteHeader documentName={document.fileName} />
      <main className="mx-auto grid w-full max-w-[1120px] gap-5 px-4 py-5 sm:px-8 sm:py-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Document</h2>
              <StatusBadge status={document.status} />
            </div>
            <dl className="flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Size</dt>
                <dd className="font-medium">{formatBytes(document.fileSize)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Pages</dt>
                <dd className="font-medium">{document.pageCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Chunks</dt>
                <dd className="font-medium">{document.chunkCount}</dd>
              </div>
            </dl>
          </Card>

          <p className="px-1 text-[13px] leading-normal text-muted-foreground">
            Answers use only text found in this document. If it is not there, the assistant says so.
          </p>
        </aside>

        <section className="min-w-0">
          {document.status === "completed" ? (
            <ChatWindow documentId={document.id} fileName={document.fileName} />
          ) : (
            <Card className="px-6 py-12 text-center text-sm text-muted-foreground">
              {document.status === "processing"
                ? "This document is still being indexed. Come back when it shows Completed."
                : (document.errorMessage ?? "This document could not be processed. Upload it again.")}
            </Card>
          )}
        </section>
      </main>
      <footer className="mt-auto border-t border-border py-5 text-center text-xs text-muted-foreground">
        RAG Document Chat <span className="mx-1">·</span> Upload a PDF and chat with it using AI
      </footer>
    </>
  );
}
