import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/lib/types";

const STATUS_STYLES: Record<DocumentStatus, { label: string; className: string }> = {
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  },
  processing: {
    label: "Processing",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted text-muted-foreground",
  },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const { label, className } = STATUS_STYLES[status];
  return <Badge className={className}>{label}</Badge>;
}
