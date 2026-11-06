import { NextResponse } from "next/server";
import { listDocuments } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ documents: await listDocuments() });
  } catch (error) {
    console.error("Listing documents failed", error);
    return NextResponse.json({ error: "Could not load your documents." }, { status: 500 });
  }
}
