import { NextRequest, NextResponse } from "next/server";
import { importCsv } from "@/lib/csv-importer";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { csv, filename } = await req.json();
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "No CSV content provided." }, { status: 400 });
  }

  try {
    const summary = importCsv(csv, filename || "upload.csv", user.id);
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed." },
      { status: 500 }
    );
  }
}
