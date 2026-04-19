import { GoogleGenerativeAI } from "@google/generative-ai";
import { ObjectId } from "mongodb";

import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  segmentData: { params: Promise<{ reportId: string }> },
) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json({ error: "Missing GEMINI_API_KEY environment variable." }, { status: 500 });
    }

    const { reportId } = await segmentData.params;

    if (!ObjectId.isValid(reportId)) {
      return Response.json({ error: "Invalid report ID." }, { status: 400 });
    }

    const db = await getDatabase();
    const collection = db.collection("labReports");
    const _id = new ObjectId(reportId);
    const report = await collection.findOne({ _id });

    if (!report) {
      return Response.json({ error: "Report not found." }, { status: 404 });
    }

    if (!report.extractedText || typeof report.extractedText !== "string") {
      return Response.json({ error: "No extracted text available for parsing." }, { status: 400 });
    }

    await collection.updateOne(
      { _id },
      {
        $set: {
          status: "parsing",
          errorMessage: null,
          updatedAt: new Date(),
        },
      },
    );

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
### ROLE
You are a Clinical Nutrition & Bioinformatics Specialist. Your task is to analyze raw lab report data, identify nutritional deficiencies, and synthesize a corrective dietary plan.

### INPUT DATA
LAB_DATA: ${report.extractedText}

### OPERATIONAL PIPELINE
1. PARSE & VALIDATE: Extract key biomarkers. Compare values against standard clinical reference ranges.
2. DEFICIENCY MAPPING: Identify "Critical" (out of range) and "Sub-optimal" (low-end of normal) markers. 
3. TARGET OPTIMIZATION: Based on deficiencies, suggest adjustments to the user's daily nutritional targets (Calories, Vitamins, Minerals).

### OUTPUT SCHEMA (JSON ONLY)
{
  "summary": {
    "deficiencies": [
      { "marker": "Vitamin D", "value": "18 ng/mL", "status": "Deficient", "impact": "..." }
    ],
    "trends": "Overall health analysis."
  },
  "strategy": { "priority_nutrients": ["Vitamin D3"], "explanation": "..." },
  "proposed_adjustments": [
    { "metric": "Vitamin D", "recommended_target": 25, "unit": "mcg", "reasoning": "Standard dosage for correcting deficiency." }
  ]
}
`.trim();

    // Use defaults for maximum compatibility across API versions
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();

    if (!rawText) {
      return Response.json({ error: "Empty response from Gemini" }, { status: 502 });
    }

    // Robust JSON parsing to handle potential markdown fences
    let cleanJson = rawText.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    }

    const parsedAnalysis = JSON.parse(cleanJson);

    await collection.updateOne(
      { _id },
      {
        $set: {
          status: "parsed",
          analysis: parsedAnalysis,
          updatedAt: new Date(),
        },
      },
    );

    return Response.json({
      reportId,
      status: "parsed",
      analysis: parsedAnalysis,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse the lab report.";
    console.error("Gemini Parsing Error:", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
