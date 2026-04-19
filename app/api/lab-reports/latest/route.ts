import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = await getDatabase();
    const collection = db.collection("labReports");

    const latestReport = await collection.findOne(
      { status: "parsed" },
      { sort: { updatedAt: -1, createdAt: -1 } }
    );

    if (!latestReport) {
      return Response.json({ analysis: null }, { status: 200 });
    }

    return Response.json({
      reportId: latestReport._id.toString(),
      analysis: latestReport.analysis || null,
      updatedAt: latestReport.updatedAt,
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch latest lab report.";
    return Response.json({ error: message }, { status: 500 });
  }
}
