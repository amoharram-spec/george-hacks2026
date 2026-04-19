import { GoogleGenerativeAI } from "@google/generative-ai";
import { ObjectId } from "mongodb";

import { getGeminiApiKey } from "@/lib/env";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

const GEMINI_MODEL = "gemini-2.5-flash";

type ParsedLab = {
  key: string;
  label: string;
  value: number | string | null;
  unit: string | null;
  referenceRange: string | null;
  flag: "low" | "normal" | "high" | "abnormal" | "unknown";
  sourceText: string | null;
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "lab-marker";
}

function parseJsonText(rawText: string) {
  const trimmed = rawText.trim();

  return JSON.parse(trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim()) as {
    parsedLabs?: unknown;
    parseWarnings?: unknown;
    analysis?: unknown;
  };
}

function normalizeParsedLabs(input: unknown): ParsedLab[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      const label = typeof candidate.label === "string" ? candidate.label.trim() : "";

      if (!label) {
        return null;
      }

      const value =
        typeof candidate.value === "number" || typeof candidate.value === "string"
          ? candidate.value
          : null;
      const rawFlag = typeof candidate.flag === "string" ? candidate.flag.toLowerCase() : "unknown";
      const flag = ["low", "normal", "high", "abnormal", "unknown"].includes(rawFlag)
        ? (rawFlag as ParsedLab["flag"])
        : "unknown";

      return {
        key: typeof candidate.key === "string" && candidate.key.trim() ? candidate.key.trim() : slugify(label),
        label,
        value,
        unit: typeof candidate.unit === "string" && candidate.unit.trim() ? candidate.unit.trim() : null,
        referenceRange:
          typeof candidate.referenceRange === "string" && candidate.referenceRange.trim()
            ? candidate.referenceRange.trim()
            : null,
        flag,
        sourceText:
          typeof candidate.sourceText === "string" && candidate.sourceText.trim()
            ? candidate.sourceText.trim()
            : null,
      };
    })
    .filter((item): item is ParsedLab => item !== null);
}

function normalizeWarnings(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeAnalysis(input: unknown) {
  if (!input || typeof input !== "object") {
    return null;
  }

  return input;
}

export async function POST(
  _request: Request,
  segmentData: { params: Promise<{ reportId: string }> },
) {
  try {
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      return Response.json(
        { error: "Missing Gemini API key. Set GEMINI_API_KEY or GOOGLE_API_KEY in .env.local." },
        { status: 500 },
      );
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
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `
### ROLE
You are a Clinical Nutrition & Bioinformatics Specialist. Your task is to extract bloodwork markers from raw lab report data, identify nutritional deficiencies, and synthesize a corrective dietary plan.

### INPUT DATA
LAB_DATA: ${report.extractedText}

### OPERATIONAL PIPELINE
1. PARSE & VALIDATE: Extract key biomarkers. Compare values against standard clinical reference ranges.
2. DEFICIENCY MAPPING: Identify "Critical" (out of range) and "Sub-optimal" (low-end of normal) markers.
3. TARGET OPTIMIZATION: Based on deficiencies, suggest adjustments to the user's daily nutritional targets (Calories, Vitamins, Minerals).

### OUTPUT SCHEMA (JSON ONLY)
{
  "parsedLabs": [
    {
      "key": "vitamin-d",
      "label": "Vitamin D",
      "value": 18,
      "unit": "ng/mL",
      "referenceRange": "30-100",
      "flag": "low",
      "sourceText": "Vitamin D 18 ng/mL"
    }
  ],
  "parseWarnings": ["warning text if OCR or context is unreliable"],
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

### RULES
- Return JSON only.
- Do not invent values that are not present.
- Keep parsedLabs as an array.
- value may be a number, string, or null when needed.
- flag must be one of: low, normal, high, abnormal, unknown.
- Include sourceText when possible.
- If the PDF text is unclear, put that in parseWarnings.
- If there are no reliable lab values, return parsedLabs as an empty array.
- If you cannot support the analysis confidently, return a conservative analysis with empty arrays and explain uncertainty in parseWarnings.
`.trim();

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();

    if (!rawText) {
      await collection.updateOne(
        { _id },
        {
          $set: {
            status: "failed",
            errorMessage: "Gemini returned an empty response.",
            updatedAt: new Date(),
          },
        },
      );

      return Response.json({ error: "Gemini returned an empty response." }, { status: 502 });
    }

    const parsedJson = parseJsonText(rawText);
    const parsedLabs = normalizeParsedLabs(parsedJson.parsedLabs);
    const parseWarnings = Array.from(new Set([...(report.parseWarnings ?? []), ...normalizeWarnings(parsedJson.parseWarnings)]));
    const parsedAnalysis = normalizeAnalysis(parsedJson.analysis ?? parsedJson);

    await collection.updateOne(
      { _id },
      {
        $set: {
          status: "parsed",
          parsedLabs,
          parseWarnings,
          analysis: parsedAnalysis,
          geminiModel: GEMINI_MODEL,
          geminiRawResponse: rawText,
          errorMessage: null,
          updatedAt: new Date(),
        },
      },
    );

    return Response.json({
      reportId,
      status: "parsed",
      parsedLabs,
      parseWarnings,
      analysis: parsedAnalysis,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse the lab report.";
    console.error("Gemini Parsing Error:", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
