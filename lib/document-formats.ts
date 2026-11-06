export const DOCUMENT_FORMATS = {
  pdf: {
    extension: ".pdf",
    label: "PDF",
    mimeTypes: ["application/pdf"],
    sourceType: "page",
  },
  docx: {
    extension: ".docx",
    label: "Word",
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"],
    sourceType: "document",
  },
  doc: {
    extension: ".doc",
    label: "Word",
    mimeTypes: ["application/msword"],
    sourceType: "document",
  },
  pptx: {
    extension: ".pptx",
    label: "PowerPoint",
    mimeTypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip"],
    sourceType: "slide",
  },
  ppt: {
    extension: ".ppt",
    label: "PowerPoint",
    mimeTypes: ["application/vnd.ms-powerpoint"],
    sourceType: "slide",
  },
  txt: {
    extension: ".txt",
    label: "Text",
    mimeTypes: ["text/plain"],
    sourceType: "document",
  },
  md: {
    extension: ".md",
    label: "Markdown",
    mimeTypes: ["text/markdown", "text/x-markdown", "text/plain"],
    sourceType: "document",
  },
} as const;

export type DocumentFileType = keyof typeof DOCUMENT_FORMATS;
export type SourceType = "page" | "slide" | "document";

export const SUPPORTED_EXTENSIONS = Object.values(DOCUMENT_FORMATS).map((format) => format.extension);
export const ACCEPTED_UPLOAD_TYPES = SUPPORTED_EXTENSIONS.join(",");
export const ACCEPTED_MIME_TYPE = DOCUMENT_FORMATS.pdf.mimeTypes[0];

export function getDocumentFileType(fileName: string): DocumentFileType | null {
  const lowerName = fileName.toLowerCase();
  return (Object.entries(DOCUMENT_FORMATS) as [DocumentFileType, (typeof DOCUMENT_FORMATS)[DocumentFileType]][])
    .find(([, format]) => lowerName.endsWith(format.extension))?.[0] ?? null;
}

export function getDocumentSourceType(fileType: DocumentFileType): SourceType {
  return DOCUMENT_FORMATS[fileType].sourceType;
}

export function getDocumentSourceLabel(sourceType: SourceType, count: number): string {
  if (sourceType === "document") return "Document-level sources";
  const label = sourceType === "slide" ? "slide" : "page";
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}
