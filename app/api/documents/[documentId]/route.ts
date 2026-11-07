import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { deleteDocumentNamespace, PineconeNamespaceDeletePendingError } from "@/lib/pinecone";
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
    if (document?.status === "processing") {
      return NextResponse.json(
        { error: "Wait for document processing to finish before deleting it." },
        { status: 409 },
      );
    }

    // Verify Pinecone has finished removing this namespace before deleting the MongoDB row.
    // If the row was removed by an older request, this also lets an idempotent retry clean up
    // the orphaned namespace by document ID.
    await deleteDocumentNamespace(documentId);
    if (document) await PdfDocument.findByIdAndDelete(documentId).select("_id").lean();

    return NextResponse.json({ success: true, documentId, alreadyRemovedFromMongo: !document });
  } catch (error) {
    if (error instanceof PineconeNamespaceDeletePendingError) {
      return NextResponse.json(
        { error: "Pinecone is still removing this document's indexed content. The document is still available for retry; wait a few seconds and try again." },
        { status: 503 },
      );
    }
    console.error(`Could not delete document ${documentId}`, error);
    return NextResponse.json(
      { error: "Could not completely delete this document. Check the database and Pinecone connection, then try again." },
      { status: 500 },
    );
  }
}
