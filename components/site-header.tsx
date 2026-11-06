import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { HeaderActions } from "@/components/header-actions";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader({ documentName }: { documentName?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-[84px] w-full max-w-[1450px] items-center justify-between gap-4 px-4 sm:px-8">
        {documentName ? (
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Link href="/" className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              <span className="hidden sm:inline">←&nbsp; All documents</span>
              <span className="sm:hidden">← Back</span>
            </Link>
            <BrandMark className="h-8 w-8 rounded-lg" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold sm:text-base">{documentName}</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">Ask questions and get answers with page numbers</p>
            </div>
          </div>
        ) : (
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <BrandMark />
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold leading-tight">RAG Document Chat</span>
              <span className="hidden text-xs text-muted-foreground sm:block">Upload PDFs and chat with them using AI</span>
            </span>
          </Link>
        )}
        {documentName ? <ThemeToggle /> : <HeaderActions />}
      </div>
    </header>
  );
}
