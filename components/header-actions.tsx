"use client";

import { RefreshCw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function HeaderActions() {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Button
        className="h-9 w-9 rounded-lg p-0 sm:h-10 sm:w-auto sm:px-4"
        onClick={() => window.dispatchEvent(new Event("rag:open-upload"))}
        aria-label="Choose a document to upload"
        title="Upload document"
      >
        <Upload className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Upload</span>
      </Button>
      <Button className="h-9 w-9 sm:h-11 sm:w-11" variant="ghost" size="icon" aria-label="Refresh document list" title="Refresh document list" onClick={() => router.refresh()}>
        <RefreshCw className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
      </Button>
      <ThemeToggle />
    </div>
  );
}
