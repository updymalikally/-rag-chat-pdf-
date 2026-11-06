"use client";

import { Check, CircleAlert, FileText, RotateCw, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileTypeIcon } from "@/components/file-type-icon";
import { Progress } from "@/components/ui/progress";
import { ACCEPTED_UPLOAD_TYPES, MAX_FILE_SIZE } from "@/lib/constants";
import { DOCUMENT_FORMATS, getDocumentFileType } from "@/lib/document-formats";
import { cn, formatBytes } from "@/lib/utils";

type UploadStage = "uploading" | "extracting" | "chunking" | "embedding-indexing" | "saving";
type ServerProgressEvent = {
  type: "progress";
  stage: Exclude<UploadStage, "uploading">;
  progress: number;
  completedChunks?: number;
  totalChunks?: number;
};
type UploadResult = { status: number; body: { error?: string; chunkCount?: number } };

function sendFile(
  file: File,
  onUploadProgress: (loadedBytes: number) => void,
  onUploadComplete: () => void,
  onServerProgress: (event: ServerProgressEvent) => void,
  onXhr: (xhr: XMLHttpRequest) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let responseOffset = 0;
    let pendingLine = "";
    let streamedResult: UploadResult | null = null;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const processLine = (line: string) => {
      if (!line.trim()) return;
      try {
        const event = JSON.parse(line) as Record<string, unknown>;
        if (event.type === "progress" && typeof event.stage === "string" && typeof event.progress === "number") {
          onServerProgress(event as ServerProgressEvent);
        } else if (event.type === "complete") {
          streamedResult = { status: 201, body: (event.body ?? {}) as UploadResult["body"] };
        } else if (event.type === "error") {
          streamedResult = {
            status: typeof event.status === "number" ? event.status : 500,
            body: (event.body ?? {}) as UploadResult["body"],
          };
        }
      } catch {
        // Ignore an incomplete or unrelated response line; xhr.onload reports malformed responses.
      }
    };
    const readStreamEvents = () => {
      if (!xhr.getResponseHeader("Content-Type")?.includes("application/x-ndjson")) return;
      const newText = xhr.responseText.slice(responseOffset);
      responseOffset = xhr.responseText.length;
      const lines = `${pendingLine}${newText}`.split("\n");
      pendingLine = lines.pop() ?? "";
      lines.forEach(processLine);
    };

    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (event) => {
      // The request body is the file itself, so loadedBytes is the real byte count.
      if (event.lengthComputable) onUploadProgress(Math.min(file.size, event.loaded));
    };
    xhr.upload.onload = onUploadComplete;
    xhr.onprogress = readStreamEvents;
    xhr.onerror = () => fail(new Error("Network error. Check your connection and try again."));
    xhr.onabort = () => {
      const error = new Error("Upload cancelled.");
      error.name = "AbortError";
      fail(error);
    };
    xhr.onload = () => {
      readStreamEvents();
      if (pendingLine.trim()) processLine(pendingLine);
      if (streamedResult) {
        if (settled) return;
        settled = true;
        resolve(streamedResult);
        return;
      }

      try {
        const body = JSON.parse(xhr.responseText) as UploadResult["body"];
        if (settled) return;
        settled = true;
        resolve({ status: xhr.status, body });
      } catch {
        fail(new Error("The server sent an unreadable response."));
      }
    };

    onXhr(xhr);
    xhr.send(file);
  });
}

function checkFile(file: File): string | null {
  const fileType = getDocumentFileType(file.name);
  if (!fileType) return "Unsupported file. Choose PDF, DOCX, DOC, PPTX, PPT, TXT, or Markdown.";
  const mimeType = file.type.toLowerCase();
  if (mimeType && mimeType !== "application/octet-stream" && !(DOCUMENT_FORMATS[fileType].mimeTypes as readonly string[]).includes(mimeType)) {
    return `The selected file's content type does not match its ${DOCUMENT_FORMATS[fileType].extension} extension.`;
  }
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_FILE_SIZE) return "The file is larger than 10 MB.";
  return null;
}

type UploadState =
  | { phase: "idle" }
  | { phase: "working"; fileName: string; fileSize: number; percent: number; stage: UploadStage }
  | { phase: "completed"; fileName: string; fileSize: number }
  | { phase: "failed"; fileName: string; fileSize: number; percent: number; message: string; errorCode: string }
  | { phase: "cancelled"; fileName: string; fileSize: number; percent: number; message: string };

const STAGE_LABELS: Record<UploadStage, string> = {
  uploading: "Uploading file",
  extracting: "Extracting text",
  chunking: "Splitting into chunks",
  "embedding-indexing": "Embedding and indexing",
  saving: "Saving document",
};

export function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const lastFileRef = useRef<File | null>(null);
  const cancelRequested = useRef(false);
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const isBusy = state.phase === "working";

  useEffect(() => {
    const openPicker = () => {
      document.getElementById("upload")?.scrollIntoView({ behavior: "smooth", block: "center" });
      inputRef.current?.click();
    };
    window.addEventListener("rag:open-upload", openPicker);
    return () => window.removeEventListener("rag:open-upload", openPicker);
  }, []);

  async function uploadFile(file: File) {
    const problem = checkFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }

    cancelRequested.current = false;
    lastFileRef.current = file;
    let lastProgress = 0;
    const updateProgress = (percent: number, stage: UploadStage) => {
      lastProgress = Math.max(lastProgress, Math.min(99.9, percent));
      setState({ phase: "working", fileName: file.name, fileSize: file.size, percent: lastProgress, stage });
    };

    setState({ phase: "working", fileName: file.name, fileSize: file.size, percent: 0, stage: "uploading" });
    try {
      const { status, body } = await sendFile(
        file,
        (loadedBytes) => updateProgress((loadedBytes / file.size) * 15, "uploading"),
        () => updateProgress(15, "extracting"),
        (event) => updateProgress(15 + (event.progress / 100) * 85, event.stage),
        (xhr) => {
          xhrRef.current = xhr;
        },
      );

      if (status === 201) {
        setState({ phase: "completed", fileName: file.name, fileSize: file.size });
        toast.success(`${file.name} is ready to chat`, { description: `${body.chunkCount} chunks indexed.` });
      } else {
        const message = body.error ?? "Upload failed. Try again.";
        setState({
          phase: "failed",
          fileName: file.name,
          fileSize: file.size,
          percent: lastProgress,
          message,
          errorCode: status >= 400 ? `Error ${status}` : "Processing error",
        });
        toast.error(message);
      }
    } catch (error) {
      const cancelled = cancelRequested.current || (error instanceof Error && error.name === "AbortError");
      if (cancelled) {
        setState({
          phase: "cancelled",
          fileName: file.name,
          fileSize: file.size,
          percent: lastProgress,
          message: "Upload cancelled.",
        });
        toast.info("Upload cancelled.");
      } else {
        const message = error instanceof Error ? error.message : "Upload failed. Try again.";
        setState({
          phase: "failed",
          fileName: file.name,
          fileSize: file.size,
          percent: lastProgress,
          message,
          errorCode: error instanceof Error && error.message.startsWith("Network") ? "Network error" : "Upload error",
        });
        toast.error(message);
      }
    } finally {
      xhrRef.current = null;
      cancelRequested.current = false;
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    }
  }

  function cancelUpload() {
    if (!xhrRef.current) return;
    cancelRequested.current = true;
    xhrRef.current.abort();
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
        <div className="text-base font-semibold">Upload a document</div>
        <div className="text-sm text-muted-foreground">Drag and drop a supported document here, or choose a file.</div>
        <div className="max-w-lg text-xs text-muted-foreground">PDF, Word (.docx, .doc), PowerPoint (.pptx, .ppt), TXT, or Markdown · Max 10 MB · One file at a time</div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_UPLOAD_TYPES}
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
        <div aria-live="polite" className="flex flex-col gap-3">
          {(state.phase === "working" || state.phase === "completed" || state.phase === "failed") && (
            <div
              className={cn(
                "flex flex-col gap-3 rounded-xl border px-4 py-4 text-white transition-colors duration-500",
                state.phase === "working" && "border-slate-700 bg-slate-900",
                state.phase === "completed" && "border-emerald-800/80 bg-[#064e3b]",
                state.phase === "failed" && "border-rose-800/80 bg-[#300a0e]",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileTypeIcon fileName={state.fileName} size="sm" />
                  {state.phase === "failed" && <CircleAlert className="h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />}
                  <div className="min-w-0">
                    <span className="text-sm font-semibold">
                      {state.phase === "failed" ? "Upload interrupted" : "Upload progress"}
                    </span>
                    {state.phase === "failed" && (
                      <p className="truncate text-xs text-rose-200/80">{state.message}</p>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-sm tabular-nums",
                    state.phase === "completed" && "text-emerald-200",
                    state.phase === "failed" && "text-rose-200",
                    state.phase === "working" && "text-slate-300",
                  )}
                >
                  {state.phase === "completed"
                    ? "100%"
                    : state.phase === "failed"
                      ? `HALTED AT ${Math.floor(state.percent)}%`
                      : `${Math.min(99, Math.floor(state.percent))}%`}
                </span>
              </div>
              <Progress
                label="Upload and processing progress"
                value={state.phase === "completed" ? 100 : state.percent}
                className={cn(
                  "h-1.5",
                  state.phase === "working" && "bg-slate-700",
                  state.phase === "completed" && "bg-[#065f46]",
                  state.phase === "failed" && "bg-rose-900",
                )}
                indicatorClassName={cn(
                  state.phase === "working" && "bg-sky-400",
                  state.phase === "completed" && "bg-emerald-300",
                  state.phase === "failed" && "bg-orange-400",
                )}
                indicatorTransitionClassName={
                  state.phase === "completed" || state.phase === "failed"
                    ? "transition-[width,background-color] duration-500"
                    : undefined
                }
              />
              <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-neutral-400">
                <span className="min-w-0 truncate" title={state.fileName}>
                  {state.fileName} · {getDocumentFileType(state.fileName)?.toUpperCase()} · {formatBytes(state.fileSize)}
                </span>
                {state.phase === "completed" && (
                  <span className="flex shrink-0 items-center gap-1.5 font-medium text-emerald-200">
                    Complete <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                )}
                {state.phase === "working" && <span className="shrink-0">{STAGE_LABELS[state.stage]}</span>}
                {state.phase === "failed" && (
                  <span className="shrink-0 rounded bg-rose-900 px-2 py-1 font-medium text-rose-100">
                    {state.errorCode}
                  </span>
                )}
              </div>
              {state.phase === "working" && (
                <button
                  type="button"
                  className="self-end text-xs text-neutral-400 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  onClick={cancelUpload}
                >
                  Cancel upload
                </button>
              )}
              {state.phase === "failed" && (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-rose-100 hover:bg-rose-900/70 hover:text-white"
                    onClick={() => setState({ phase: "idle" })}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Dismiss
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 bg-rose-600 text-white hover:bg-rose-500"
                    onClick={() => {
                      if (lastFileRef.current) void uploadFile(lastFileRef.current);
                    }}
                  >
                    <RotateCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Retry upload
                  </Button>
                </div>
              )}
            </div>
          )}

          {state.phase === "cancelled" && (
            <div
              className={cn(
                "flex flex-col gap-2 rounded-xl border p-4",
                "border-border bg-muted/40",
              )}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileTypeIcon fileName={state.fileName} size="sm" />
                "Upload cancelled"
              </div>
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
