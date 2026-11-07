import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { deleteDocumentNamespace } from "@/lib/pinecone";
import { documentIdSchema } from "@/lib/validations";
import { PdfDocument } from "@/models/Document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeleteDocumentContext = { params: Promise<{ documentId: string }> };

export async function DELETE(_request: Request, { params }: DeleteDocumentContext) {
  const { documentId } = await params;
  if (!documentIdSchema.safeParse(documentId).success) {
    return NextResponse.json({ error: "Invalid document id." }, { status: 400 });
  }

  try {
    await connectDB();
    const document = await PdfDocument.findById(documentId).select("status").lean();
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    if (document.status === "processing") {
      return NextResponse.json(
        { error: "Wait for document processing to finish before deleting it." },
        { status: 409 },
      );
    }

    // Remove the document's dedicated Pinecone namespace before deleting its MongoDB record.
    // If either service fails, retain the MongoDB row so the user can retry the cleanup.
    await deleteDocumentNamespace(documentId);
    const deleted = await PdfDocument.findByIdAndDelete(documentId).select("_id").lean();
    if (!deleted) return NextResponse.json({ error: "Document was already deleted." }, { status: 404 });

    return NextResponse.json({ success: true, documentId });
  } catch (error) {
    console.error(`Could not delete document ${documentId}`, error);
    return NextResponse.json(
      { error: "Could not completely delete this document. Check the database and Pinecone connection, then try again." },
      { status: 500 },
    );
  }
}
