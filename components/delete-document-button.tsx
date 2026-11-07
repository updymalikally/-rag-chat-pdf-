"use client";

import { AlertTriangle, LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DeleteDocumentButton({ documentId, fileName, disabled = false }: {
  documentId: string;
  fileName: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isDialogOpen && !dialog.open) dialog.showModal();
    if (!isDialogOpen && dialog.open) dialog.close();
  }, [isDialogOpen]);

  async function deleteDocument() {
    if (disabled || isDeleting) return;

    setIsDeleting(true);
    window.dispatchEvent(new CustomEvent("rag:document-delete-start", { detail: { fileName } }));
    let deleted = false;
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, { method: "DELETE" });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not delete this document.");
      deleted = true;
      setIsDialogOpen(false);
      window.dispatchEvent(new CustomEvent("rag:document-delete-complete", { detail: { fileName } }));
      toast.success("Document removed from your library.");
      router.refresh();
    } catch (error) {
      window.dispatchEvent(new CustomEvent("rag:document-delete-failed", { detail: { fileName } }));
      toast.error(error instanceof Error ? error.message : "Could not delete this document.");
      setIsDeleting(false);
    } finally {
      if (!deleted) setIsDeleting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="mt-1 h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Delete ${fileName}`}
        title={disabled ? "Wait for processing to finish before deleting" : "Delete document"}
        disabled={disabled || isDeleting}
        onClick={() => setIsDialogOpen(true)}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>

      {isDialogOpen && (
        <dialog
          ref={dialogRef}
          aria-labelledby={`delete-title-${documentId}`}
          aria-describedby={`delete-description-${documentId}`}
          onCancel={(event) => {
            event.preventDefault();
            if (!isDeleting) setIsDialogOpen(false);
          }}
          onClick={(event) => {
            if (event.target === dialogRef.current && !isDeleting) setIsDialogOpen(false);
          }}
          className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
        >
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 pt-0.5">
                <h2 id={`delete-title-${documentId}`} className="text-sm font-semibold">Delete document?</h2>
                <p id={`delete-description-${documentId}`} className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                  Are you sure you want to delete <span className="font-medium text-foreground">“{fileName}”</span>?
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <p>This permanently removes the document and its indexed content from MongoDB and Pinecone. This action cannot be undone.</p>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-rose-600 text-white hover:bg-rose-700"
                disabled={isDeleting}
                onClick={() => void deleteDocument()}
              >
                {isDeleting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                {isDeleting ? "Deleting…" : "Delete document"}
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
