import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { parseDocument as parseDocx } from "@office-open/docx";
import { parsePresentation as parsePptx } from "@office-open/pptx";
import { parseDocument as parseDoc } from "@office-open/doc";
import { parsePresentation as parsePpt } from "@office-open/ppt";
import { CHUNK_OVERLAP, CHUNK_SIZE } from "@/lib/constants";
import { DOCUMENT_FORMATS, getDocumentFileType, type DocumentFileType, type SourceType } from "@/lib/document-formats";
import type { TextChunk } from "@/lib/types";

export type ExtractedSource = { sourceNumber?: number; sectionTitle?: string; text: string };
export type LoadedDocument = {
  documentId: string;
  fileName: string;
  fileType: DocumentFileType;
  sourceType: SourceType;
  sources: ExtractedSource[];
  sourceCount: number;
  metadata: { mimeType: string; extension: string };
};

type DocumentLoader = {
  load(file: File, documentId: string): Promise<LoadedDocument>;
};

export type ProcessedDocument = {
  fileType: DocumentFileType;
  sourceType: SourceType;
  sourceCount: number;
  pageCount: number;
  chunks: TextChunk[];
};

export type ProcessingStage = "extracting" | "chunking";
export type ProcessingProgress = (stage: ProcessingStage, fraction: number) => void;

export class DocumentContentError extends Error {}
export class DocumentLoadError extends Error {}

const TEXT_CONTAINER_KEYS = new Set([
  "sections", "children", "paragraph", "table", "rows", "cells", "textBody", "paragraphs",
  "slides", "shape", "group", "notes", "textbox", "sdt", "body", "runs", "textRuns",
]);

function collectOfficeText(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectOfficeText);
  if (typeof value !== "object" || value === null) return [];

  const texts: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (key === "text" && typeof child === "string") texts.push(child);
    else if (TEXT_CONTAINER_KEYS.has(key)) texts.push(...collectOfficeText(child));
  }
  return texts;
}

function cleanText(text: string): string {
  return text.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").normalize("NFC").trim();
}

function joinText(parts: string[]): string {
  return cleanText(parts.filter((part) => part.trim()).join("\n"));
}

function extractHeadingText(paragraph: unknown): string {
  if (typeof paragraph === "string") return cleanText(paragraph);
  if (typeof paragraph !== "object" || paragraph === null) return "";
  return joinText(collectOfficeText(paragraph));
}

function isDocxHeading(paragraph: unknown): boolean {
  if (typeof paragraph !== "object" || paragraph === null) return false;
  const properties = paragraph as { heading?: unknown; style?: unknown; outlineLevel?: unknown };
  return properties.heading !== undefined
    || typeof properties.outlineLevel === "number"
    || (typeof properties.style === "string" && /^heading\s*\d/i.test(properties.style));
}

function extractDocxSources(sections: unknown): ExtractedSource[] {
  const sources: ExtractedSource[] = [];
  let currentHeading: string | undefined;
  let currentParts: string[] = [];
  const flush = () => {
    const text = joinText(currentParts);
    if (text) sources.push({ sectionTitle: currentHeading, text });
    currentParts = [];
  };

  for (const section of Array.isArray(sections) ? sections : []) {
    const children = typeof section === "object" && section !== null && "children" in section
      ? (section as { children?: unknown }).children
      : [];
    for (const child of Array.isArray(children) ? children : []) {
      if (typeof child === "object" && child !== null && "paragraph" in child) {
        const paragraph = (child as { paragraph: unknown }).paragraph;
        const text = extractHeadingText(paragraph);
        if (isDocxHeading(paragraph) && text) {
          flush();
          currentHeading = text;
          currentParts.push(text);
        } else if (text) {
          currentParts.push(text);
        }
      } else {
        const text = joinText(collectOfficeText(child));
        if (text) currentParts.push(text);
      }
    }
  }
  flush();
  return sources;
}

function extractTextSections(text: string): ExtractedSource[] {
  const sources: ExtractedSource[] = [];
  let heading: string | undefined;
  let parts: string[] = [];
  const flush = () => {
    const content = joinText(parts);
    if (content) sources.push({ sectionTitle: heading, text: content });
    parts = [];
  };

  for (const line of text.split("\n")) {
    const markdownHeading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    const numberedHeading = line.match(/^\s*\d+(?:\.\d+)*[.)]?\s+([^.!?]{2,80})\s*$/);
    const nextHeading = markdownHeading?.[1]?.trim() ?? numberedHeading?.[2]?.trim();
    if (nextHeading) {
      flush();
      heading = nextHeading;
      parts.push(line.trim());
    } else if (line.trim()) {
      parts.push(line);
    }
  }
  flush();
  return sources.length ? sources : [{ text }];
}

function getMimeType(file: File, fileType: DocumentFileType): string {
  return file.type || DOCUMENT_FORMATS[fileType].mimeTypes[0];
}

function createLoadedDocument(
  file: File,
  documentId: string,
  fileType: DocumentFileType,
  sources: ExtractedSource[],
): LoadedDocument {
  return {
    documentId,
    fileName: file.name,
    fileType,
    sourceType: DOCUMENT_FORMATS[fileType].sourceType,
    sources: sources.map((source) => ({ ...source, text: cleanText(source.text) })).filter((source) => source.text),
    sourceCount: fileType === "pdf" || fileType === "ppt" || fileType === "pptx"
      ? sources.length
      : 1,
    metadata: { mimeType: getMimeType(file, fileType), extension: DOCUMENT_FORMATS[fileType].extension },
  };
}

const pdfLoader: DocumentLoader = {
  async load(file, documentId) {
    const pages = await new PDFLoader(file, { splitPages: true }).load();
    return createLoadedDocument(
      file,
      documentId,
      "pdf",
      pages.map((page, index) => {
        const loc = page.metadata.loc as { pageNumber?: unknown } | undefined;
        const pageNumber = typeof loc?.pageNumber === "number" ? loc.pageNumber : index + 1;
        return { sourceNumber: pageNumber, text: page.pageContent };
      }),
    );
  },
};

const docxLoader: DocumentLoader = {
  async load(file, documentId) {
    const options = await parseDocx(new Uint8Array(await file.arrayBuffer()));
    return createLoadedDocument(file, documentId, "docx", extractDocxSources(options.sections));
  },
};

const docLoader: DocumentLoader = {
  async load(file, documentId) {
    const options = parseDoc(new Uint8Array(await file.arrayBuffer()));
    return createLoadedDocument(file, documentId, "doc", [{ text: joinText(collectOfficeText(options.sections)) }]);
  },
};

const pptxLoader: DocumentLoader = {
  async load(file, documentId) {
    const options = await parsePptx(new Uint8Array(await file.arrayBuffer()));
    const slides = options.slides ?? [];
    return createLoadedDocument(
      file,
      documentId,
      "pptx",
      slides.map((slide, index) => ({ sourceNumber: index + 1, text: joinText(collectOfficeText(slide.children)) })),
    );
  },
};

const pptLoader: DocumentLoader = {
  async load(file, documentId) {
    const options = parsePpt(new Uint8Array(await file.arrayBuffer()));
    const slides = options.slides ?? [];
    return createLoadedDocument(
      file,
      documentId,
      "ppt",
      slides.map((slide, index) => ({ sourceNumber: index + 1, text: joinText(collectOfficeText(slide.children)) })),
    );
  },
};

const plainTextLoader: DocumentLoader = {
  async load(file, documentId) {
    const fileType = file.name.toLowerCase().endsWith(".md") ? "md" : "txt";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    // Preserve authored text and use explicit Markdown/numbered headings where they exist.
    return createLoadedDocument(file, documentId, fileType, extractTextSections(text));
  },
};

const LOADERS: Record<DocumentFileType, DocumentLoader> = {
  pdf: pdfLoader,
  docx: docxLoader,
  doc: docLoader,
  pptx: pptxLoader,
  ppt: pptLoader,
  txt: plainTextLoader,
  md: plainTextLoader,
};

export async function loadDocument(file: File, documentId: string): Promise<LoadedDocument> {
  const fileType = getDocumentFileType(file.name);
  if (!fileType) throw new DocumentLoadError("Choose a supported document format and try again.");
  try {
    return await LOADERS[fileType].load(file, documentId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    if (/password|encrypted|decrypt/i.test(detail)) {
      throw new DocumentLoadError("This document may be password-protected. Remove its password and upload it again.");
    }
    throw new DocumentLoadError("This file could not be read. It may be damaged or password-protected; try an unprotected copy.");
  }
}

/** Extracts the format-specific sources, then sends all formats through the same chunking stage. */
export async function processDocument(
  file: File,
  documentId: string,
  onProgress?: ProcessingProgress,
): Promise<ProcessedDocument> {
  onProgress?.("extracting", 0);
  const loaded = await loadDocument(file, documentId);
  onProgress?.("extracting", 1);

  const textSources = loaded.sources.filter((source) => source.text.trim());
  if (textSources.length === 0) {
    throw new DocumentContentError("No readable text was found in this document.");
  }

  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP });
  onProgress?.("chunking", 0);
  const pieces = await splitter.createDocuments(
    textSources.map((source) => source.text),
    textSources.map((source) => ({ sourceNumber: source.sourceNumber, sectionTitle: source.sectionTitle })),
  );
  onProgress?.("chunking", 1);

  const chunks = pieces.map<TextChunk>((piece, chunkIndex) => {
    const sourceNumber = piece.metadata.sourceNumber;
    return {
      chunkIndex,
      sectionTitle: typeof piece.metadata.sectionTitle === "string" ? piece.metadata.sectionTitle : undefined,
      sourceType: loaded.sourceType,
      sourceNumber: typeof sourceNumber === "number" ? sourceNumber : undefined,
      pageNumber: loaded.sourceType === "page" && typeof sourceNumber === "number" ? sourceNumber : undefined,
      text: cleanText(piece.pageContent),
    };
  });

  return {
    fileType: loaded.fileType,
    sourceType: loaded.sourceType,
    sourceCount: loaded.sourceCount,
    pageCount: loaded.fileType === "pdf" ? loaded.sourceCount : 0,
    chunks,
  };
}
