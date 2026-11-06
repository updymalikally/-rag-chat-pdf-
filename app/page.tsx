import { ArrowRight, Check, FileText, MessageSquare, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { DocumentList } from "@/components/document-list";
import { SiteHeader } from "@/components/site-header";
import { UploadDropzone } from "@/components/upload-dropzone";
import { Card } from "@/components/ui/card";
import { listDocuments } from "@/lib/documents";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const documents = await listDocuments();
  const readyDocuments = documents.filter((document) => document.status === "completed");
  const firstReadyDocument = readyDocuments[0];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-[1450px] gap-5 px-4 py-6 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,1.7fr)_minmax(360px,1fr)] lg:items-start lg:gap-7">
        <div className="flex min-w-0 flex-col gap-5">
          <UploadDropzone />
          <DocumentList documents={documents} />
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <Card className="p-4 sm:p-5">
            <h2 className="text-sm font-semibold">How it works</h2>
            <ol className="mt-4 flex flex-col gap-4">
              {[
                { icon: Upload, title: "Upload document", description: "PDF, Word, PowerPoint, TXT, or Markdown · up to 10 MB" },
                { icon: Sparkles, title: "AI processing", description: "Text is split into searchable chunks" },
                { icon: MessageSquare, title: "Open the chat", description: "Ask questions with page or slide references" },
              ].map(({ icon: Icon, title, description }, index) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[13px] font-medium">{title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Ready to chat
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {readyDocuments.length === 0
                ? "Your completed documents will be ready to chat here."
                : `You have ${readyDocuments.length} ${readyDocuments.length === 1 ? "document" : "documents"} ready for chat.`}
            </p>
            <div className="mt-3 flex items-start gap-3 rounded-lg border border-border p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {readyDocuments.length > 0 ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </span>
              <div className="min-w-0">
                {firstReadyDocument ? (
                  <>
                    <p className="text-[13px] font-medium">Start with a document</p>
                    <Link href={`/chat/${firstReadyDocument.id}`} className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-primary">
                      {firstReadyDocument.fileName}<ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-medium">How to start chatting</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Upload and finish processing a document to ask questions.</p>
                  </>
                )}
              </div>
            </div>
          </Card>
        </aside>
      </main>
    </>
  );
}
