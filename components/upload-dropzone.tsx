"use client";

import { FileText, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ACCEPTED_MIME_TYPE, MAX_FILE_SIZE } from "@/lib/constants";
import { cn, formatBytes } from "@/lib/utils";

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; fileName: string; fileSize: number; percent: number }
  | { phase: "indexing"; fileName: string; fileSize: number }
  | { phase: "failed"; fileName: string; fileSize: number; message: string };

type UploadResult = { status: number; body: { error?: string; chunkCount?: number } };

/** fetch() cannot report upload progress, so the file is sent with XMLHttpRequest. */
function sendFile(file: File, onProgress: (percent: number) => void, onSent: () => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
    };
    xhr.upload.onload = onSent;
    xhr.onerror = () => reject(new Error("Network error. Check your connection and try again."));
    xhr.onload = () => {
      try {
        resolve({ status: xhr.status, body: JSON.parse(xhr.responseText) });
      } catch {
        reject(new Error("The server sent an unreadable response."));
      }
    };
    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

function checkFile(file: File): string | null {
  // Some browsers and operating systems report an empty MIME type for dragged files.
  // The server verifies the actual PDF signature before processing it.
  if (!file.name.toLowerCase().endsWith(".pdf")) return "Only PDF files are supported.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_FILE_SIZE) return "The file is larger than 10 MB.";
  return null;
}

export function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const isBusy = state.phase === "uploading" || state.phase === "indexing";

  async function uploadFile(file: File) {
    const problem = checkFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }

    setState({ phase: "uploading", fileName: file.name, fileSize: file.size, percent: 0 });
    try {
      const { status, body } = await sendFile(
        file,
        (percent) => setState({ phase: "uploading", fileName: file.name, fileSize: file.size, percent }),
        () => setState({ phase: "indexing", fileName: file.name, fileSize: file.size }),
      );
      if (status === 201) {
        toast.success(`${file.name} is ready to chat`, { description: `${body.chunkCount} chunks indexed.` });
        setState({ phase: "idle" });
      } else {
        const message = body.error ?? "Upload failed. Try again.";
        setState({ phase: "failed", fileName: file.name, fileSize: file.size, message });
        toast.error(message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed. Try again.";
      setState({ phase: "failed", fileName: file.name, fileSize: file.size, message });
      toast.error(message);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
      router.refresh(); // reload the document list, including a failed one
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !isBusy) void uploadFile(file);
  }

  return (
    <Card id="upload" className="flex scroll-mt-24 flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Upload className="h-4 w-4" aria-hidden="true" />
        Upload document
      </div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!isBusy) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex min-h-[270px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-background px-5 py-9 text-center transition-colors sm:min-h-[340px] lg:min-h-[410px]",
          isDragging ? "border-primary bg-primary/5" : "border-input",
        )}
      >
        <Upload className="mb-1 h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <div className="text-base font-semibold">Upload your PDF</div>
        <div className="text-sm text-muted-foreground">Drag and drop a PDF here, or choose a file.</div>
        <div className="text-xs text-muted-foreground">PDF only · Max 10 MB · One file at a time</div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME_TYPE}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFile(file);
          }}
        />
        <Button variant="outline" className="mt-2 h-10 px-4" disabled={isBusy} onClick={() => inputRef.current?.click()}>
          Choose file
        </Button>
      </div>

      {state.phase !== "idle" && (
        <div
          className={cn(
            "flex flex-col gap-3 rounded-xl border p-4 sm:p-5",
            state.phase === "failed"
              ? "border-red-500/25 bg-red-500/5"
              : "border-neutral-800 bg-neutral-950 text-white dark:border-neutral-700",
          )}
          aria-live="polite"
        >
          {state.phase === "failed" ? (
            <>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4" aria-hidden="true" />
                Upload failed
              </div>
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">{state.message}</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">
                  {state.phase === "uploading" ? "Upload progress" : "Processing document"}
                </span>
                <span className="text-sm tabular-nums text-neutral-300">
                  {state.phase === "uploading" ? `${Math.round(state.percent)}%` : "Indexing…"}
                </span>
              </div>
              <Progress
                label={state.phase === "uploading" ? "Upload progress" : "Indexing progress"}
                value={state.phase === "uploading" ? state.percent : undefined}
                className="h-1.5 bg-white/15"
                indicatorClassName="bg-neutral-100"
              />
              <div className="flex items-center justify-between gap-3 text-xs text-neutral-400">
                <span className="min-w-0 truncate">{state.fileName}</span>
                <span className="shrink-0">{formatBytes(state.fileSize)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
