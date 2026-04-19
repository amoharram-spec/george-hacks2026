import { put } from "@vercel/blob";
import { ObjectId } from "mongodb";

import { getGeminiApiKey, getUsdaApiKey } from "@/lib/env";
import { getDatabase } from "@/lib/mongodb";
import {
  buildDashboardDataFromMealScans,
  groundFoodWithUsda,
  normalizeGeminiMealScan,
  parseJsonText,
  type MealScanDocument,
  UsdaGroundingError,
} from "@/lib/meal-scans";

export const runtime = "nodejs";

const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function sanitizeFilename(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "") || "meal-image.jpg";
}

function getMealScanImageUrl(mealScanId: string) {
  return `/api/meal-scans/${mealScanId}/image`;
}

function getTodayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

async function analyzeMealImage(file: File, apiKey: string) {
  const prompt = [
    "You are analyzing a meal photo for a nutrition tracking app.",
    "Return JSON only with this exact shape:",
    '{"mealLabel":"Salmon rice bowl","overallConfidence":0.92,"foods":[{"name":"salmon","confidence":0.96,"servingSizeEstimate":"about 5 oz","gramsEstimate":140,"preparation":"cooked","searchHint":"atlantic salmon cooked","assumptions":["portion estimated from visible fillet size"]}],"warnings":["sauce amount estimated"]}',
    "Rules:",
    "- Split mixed meals into visible food components instead of returning one vague dish name.",
    "- Estimate realistic serving sizes and grams for each component.",
    "- Include foods only when they are visually supported by the image.",
    "- Use warnings for uncertain sauces, oils, or hidden ingredients.",
    "- Do not return nutrient estimates.",
    "- Keep foods as an array.",
  ].join("\n\n");

  const buffer = Buffer.from(await file.arrayBuffer());
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
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: file.type,
                  data: buffer.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
      cache: "no-store",
    },
  );

  if (!geminiResponse.ok) {
    throw new Error(await geminiResponse.text());
  }

  const payload = (await geminiResponse.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };
  const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error("Gemini returned an empty response.");
  }

  return {
    rawText,
    parsed: normalizeGeminiMealScan(parseJsonText(rawText)),
  };
}

export async function POST(request: Request) {
  let insertedId: ObjectId | null = null;

  try {
    const geminiApiKey = getGeminiApiKey();
    const usdaApiKey = getUsdaApiKey();

    if (!geminiApiKey) {
      return Response.json(
        { error: "Missing Gemini API key. Set GEMINI_API_KEY or GOOGLE_API_KEY in .env.local." },
        { status: 500 },
      );
    }

    if (!usdaApiKey) {
      return Response.json(
        { error: "Missing USDA FoodData Central API key. Set USDA_API_KEY, FDC_API_KEY, or FOODDATA_CENTRAL_API_KEY in .env.local." },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "Please upload a meal image." }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return Response.json({ error: "Please upload a JPEG, PNG, WebP, or HEIC meal image." }, { status: 400 });
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json({ error: "Please upload an image under 8MB." }, { status: 400 });
    }

    const db = await getDatabase();
    const collection = db.collection("mealScans");
    const now = new Date();
    const blob = await put(`meal-scans/${Date.now()}-${sanitizeFilename(file.name)}`, file, {
      access: "private",
      addRandomSuffix: true,
      contentType: file.type,
    });

    const insertResult = await collection.insertOne({
      status: "analyzing",
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      storageProvider: "vercel-blob",
      storageKey: blob.pathname,
      storageUrl: blob.url,
      mealLabel: "Scanned meal",
      imageUrl: null,
      analysisConfidence: null,
      foods: [],
      warnings: [],
      geminiModel: GEMINI_MODEL,
      geminiRawResponse: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });
    insertedId = insertResult.insertedId;

    const analysis = await analyzeMealImage(file, geminiApiKey);
    const groundedResults = await Promise.allSettled(analysis.parsed.foods.map((food) => groundFoodWithUsda(usdaApiKey, food)));
    const groundedFoods = groundedResults
      .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof groundFoodWithUsda>>> => result.status === "fulfilled")
      .map((result) => result.value);
    const groundingWarnings = groundedResults
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => {
        const reason = result.reason;

        if (reason instanceof UsdaGroundingError) {
          return reason.message;
        }

        if (reason instanceof Error) {
          return `Unable to ground one detected item: ${reason.message}`;
        }

        return "Unable to ground one detected item against USDA data.";
      });

    if (groundedFoods.length === 0) {
      throw new Error(groundingWarnings[0] ?? "The image could not be matched to grounded nutrition entries.");
    }

    await collection.updateOne(
      { _id: insertResult.insertedId },
      {
        $set: {
          status: "completed",
          mealLabel: analysis.parsed.mealLabel,
          analysisConfidence: analysis.parsed.overallConfidence,
          foods: groundedFoods,
          warnings: Array.from(new Set([...analysis.parsed.warnings, ...groundingWarnings])),
          geminiRawResponse: analysis.rawText,
          errorMessage: null,
          updatedAt: new Date(),
        },
      },
    );

    const { start, end } = getTodayRange();
    const scans = (await collection
      .find({
        status: "completed",
        createdAt: { $gte: start, $lt: end },
      })
      .sort({ createdAt: -1 })
      .toArray()) as unknown as Array<MealScanDocument & { storageUrl?: string }>;

    const dashboardData = buildDashboardDataFromMealScans(
      scans.map((scan) => ({
        ...scan,
        createdAt: new Date(scan.createdAt),
        imageUrl: scan._id ? getMealScanImageUrl(scan._id.toString()) : null,
      })),
    );

    return Response.json({
      mealScanId: insertedId.toString(),
      dashboardData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to scan the meal image.";

    if (insertedId) {
      try {
        const db = await getDatabase();
        await db.collection("mealScans").updateOne(
          { _id: insertedId },
          {
            $set: {
              status: "failed",
              errorMessage: message,
              updatedAt: new Date(),
            },
          },
        );
      } catch {
        // Keep the original request error if the failure state cannot be persisted.
      }
    }

    return Response.json({ error: message }, { status: 500 });
  }
}
