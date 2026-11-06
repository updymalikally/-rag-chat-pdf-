import {
  File,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileText,
  FileType,
  Image as ImageIcon,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type FileCategory = "pdf" | "word" | "powerpoint" | "excel" | "markdown" | "text" | "csv" | "archive" | "image" | "unknown";

const ICONS: Record<FileCategory, LucideIcon> = {
  pdf: FileText,
  word: FileType,
  powerpoint: Presentation,
  excel: FileSpreadsheet,
  markdown: FileCode,
  text: FileText,
  csv: FileSpreadsheet,
  archive: FileArchive,
  image: ImageIcon,
  unknown: File,
};

const COLORS: Record<FileCategory, string> = {
  pdf: "bg-red-500/10 text-red-600 dark:text-red-400",
  word: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  powerpoint: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  excel: "bg-green-500/10 text-green-600 dark:text-green-400",
  markdown: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  text: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  csv: "bg-green-500/10 text-green-600 dark:text-green-400",
  archive: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  image: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  unknown: "bg-muted text-muted-foreground",
};

function categoryForFile(fileName: string): FileCategory {
  const extension = fileName.trim().toLowerCase().split(".").pop() ?? "";
  if (extension === "pdf") return "pdf";
  if (extension === "doc" || extension === "docx") return "word";
  if (extension === "ppt" || extension === "pptx") return "powerpoint";
  if (extension === "xls" || extension === "xlsx") return "excel";
  if (extension === "md") return "markdown";
  if (extension === "txt") return "text";
  if (extension === "csv") return "csv";
  if (extension === "zip" || extension === "rar") return "archive";
  if (["png", "jpg", "jpeg", "svg"].includes(extension)) return "image";
  return "unknown";
}

export function FileTypeIcon({
  fileName,
  className,
  iconClassName,
  size = "md",
}: {
  fileName: string;
  className?: string;
  iconClassName?: string;
  size?: "sm" | "md" | "lg";
}) {
  const category = categoryForFile(fileName);
  const Icon = ICONS[category];
  const sizeClasses = {
    sm: { wrapper: "h-7 w-7 rounded-md", icon: "h-3.5 w-3.5" },
    md: { wrapper: "h-8 w-8 rounded-lg", icon: "h-4 w-4" },
    lg: { wrapper: "h-10 w-10 rounded-xl", icon: "h-5 w-5" },
  }[size];

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", sizeClasses.wrapper, COLORS[category], className)}
      aria-hidden="true"
    >
      <Icon className={cn(sizeClasses.icon, iconClassName)} />
    </span>
  );
}
