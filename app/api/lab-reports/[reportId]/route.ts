import { ObjectId } from "mongodb";

import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

function getTextPreview(text: string | null) {
  if (!text) {
    return "";
  }

  return text.replace(/\s+/g, " ").trim().slice(0, 300);
}

export async function GET(
  _request: Request,
  segmentData: { params: Promise<{ reportId: string }> },
) {
  try {
    const { reportId } = await segmentData.params;

    if (!ObjectId.isValid(reportId)) {
      return Response.json({ error: "Invalid report ID." }, { status: 400 });
    }

    const db = await getDatabase();
    const report = await db.collection("labReports").findOne({ _id: new ObjectId(reportId) });

    if (!report) {
      return Response.json({ error: "Report not found." }, { status: 404 });
    }

    return Response.json({
      reportId: report._id.toString(),
      name: report.name,
      status: report.status,
      fileName: report.fileName,
      storageUrl: report.storageUrl,
      textLength: report.textLength,
      likelyScanned: report.likelyScanned,
      textPreview: getTextPreview(report.extractedText),
      parsedLabs: report.parsedLabs,
      parseWarnings: report.parseWarnings,
      analysis: report.analysis ?? null,
      errorMessage: report.errorMessage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load report.";

    return Response.json({ error: message }, { status: 500 });
  }
}
