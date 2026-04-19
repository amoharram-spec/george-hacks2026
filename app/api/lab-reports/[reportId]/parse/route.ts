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
  const withoutFence = trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

  return JSON.parse(withoutFence) as {
    parsedLabs?: unknown;
    parseWarnings?: unknown;
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

    const prompt = [
      "You are extracting bloodwork and lab report values from PDF text.",
      "Return JSON only with this exact shape:",
      '{"parsedLabs":[{"key":"vitamin-d","label":"Vitamin D","value":24,"unit":"ng/mL","referenceRange":"30-100","flag":"low","sourceText":"Vitamin D 24 ng/mL"}],"parseWarnings":["warning text"]}',
      "Rules:",
      "- Do not invent values that are not present.",
      "- Keep parsedLabs as an array.",
      "- value may be a number, string, or null when needed.",
      "- flag must be one of: low, normal, high, abnormal, unknown.",
      "- Include sourceText when possible.",
      "- If the PDF text is unclear, put that in parseWarnings.",
      "- If there are no reliable lab values, return parsedLabs as an empty array.",
      "PDF text:",
      report.extractedText,
    ].join("\n\n");

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const failureText = await geminiResponse.text();
      let failureMessage = "Gemini parsing request failed.";

      try {
        const parsedFailure = JSON.parse(failureText) as {
          error?: {
            message?: string;
          };
        };

        if (parsedFailure.error?.message) {
          failureMessage = parsedFailure.error.message;
        }
      } catch {
        if (failureText) {
          failureMessage = failureText;
        }
      }

      await collection.updateOne(
        { _id },
        {
          $set: {
            status: "failed",
            errorMessage: failureMessage,
            updatedAt: new Date(),
          },
        },
      );

      return Response.json({ error: failureMessage }, { status: 502 });
    }

    const geminiPayload = (await geminiResponse.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };
    const rawText = geminiPayload.candidates?.[0]?.content?.parts?.[0]?.text;

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
    const parseWarnings = normalizeWarnings(parsedJson.parseWarnings);

    await collection.updateOne(
      { _id },
      {
        $set: {
          status: "parsed",
          parsedLabs,
          parseWarnings: Array.from(new Set([...(report.parseWarnings ?? []), ...parseWarnings])),
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
      parseWarnings: Array.from(new Set([...(report.parseWarnings ?? []), ...parseWarnings])),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse the lab report.";

    return Response.json({ error: message }, { status: 500 });
  }
}
