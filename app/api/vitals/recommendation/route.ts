import { GoogleGenerativeAI } from "@google/generative-ai";

import { getGeminiApiKey } from "@/lib/env";
import { parseJsonText } from "@/lib/meal-scans";
import type { VitalsAverages, VitalsSample } from "@/lib/vitals";

export const runtime = "nodejs";

const GEMINI_MODEL = "gemini-2.5-flash";

type VitalsRecommendationPayload = {
  samples?: VitalsSample[];
  averages?: VitalsAverages | null;
};

type RecommendationCandidate = {
  title?: string;
  summary?: string;
  alignment?: string;
  nextMeal?: string;
  reasons?: string[];
  ctaLabel?: string;
};

function normalizeRecommendation(input: unknown) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as RecommendationCandidate;
  const reasons = Array.isArray(candidate.reasons)
    ? candidate.reasons.filter((reason): reason is string => typeof reason === "string" && reason.trim().length > 0).slice(0, 3)
    : [];

  if (!candidate.title || !candidate.summary || !candidate.alignment || !candidate.nextMeal || reasons.length === 0) {
    return null;
  }

  return {
    title: candidate.title,
    summary: candidate.summary,
    alignment: candidate.alignment,
    nextMeal: candidate.nextMeal,
    reasons,
    ctaLabel: candidate.ctaLabel?.trim() ? candidate.ctaLabel : "View Plan",
  };
}

export async function POST(request: Request) {
  try {
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      return Response.json(
        { error: "Missing Gemini API key. Set GEMINI_API_KEY or GOOGLE_API_KEY in .env.local." },
        { status: 500 },
      );
    }

    const payload = (await request.json()) as VitalsRecommendationPayload;
    const samples = Array.isArray(payload.samples)
      ? payload.samples.filter(
          (sample): sample is VitalsSample =>
            Boolean(sample)
            && typeof sample.pulse === "number"
            && typeof sample.breathing === "number"
            && typeof sample.timestamp === "number",
        )
      : [];

    if (samples.length === 0) {
      return Response.json({ error: "No vitals samples were provided." }, { status: 400 });
    }

    const averages = payload.averages && typeof payload.averages.pulse === "number" && typeof payload.averages.breathing === "number"
      ? payload.averages
      : {
          pulse: Math.round((samples.reduce((sum, sample) => sum + sample.pulse, 0) / samples.length) * 10) / 10,
          breathing: Math.round((samples.reduce((sum, sample) => sum + sample.breathing, 0) / samples.length) * 10) / 10,
        };

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = [
      "You are generating a meal recommendation for a nutrition dashboard.",
      "Use the complete uploaded vitals session, but base the recommendation primarily on the average pulse and average breathing rate.",
      "Treat spikes or dips in the series as supporting context only.",
      "Keep the guidance nutrition-focused, practical, and concise.",
      "Do not give medical diagnosis or emergency instructions.",
      "Return JSON only with this exact shape:",
      '{"title":"","summary":"","alignment":"","nextMeal":"","reasons":["","",""],"ctaLabel":"View Plan"}',
      "Rules:",
      "- Recommend one specific next meal.",
      "- Mention the average vitals in the summary or alignment.",
      "- reasons must contain exactly 3 short strings.",
      "- Keep the tone aligned with a clean clinical nutrition app.",
      `AVERAGE_PULSE_BPM: ${averages.pulse}`,
      `AVERAGE_BREATHING_RATE: ${averages.breathing}`,
      `TOTAL_SAMPLES: ${samples.length}`,
      `VITALS_SERIES: ${JSON.stringify(samples)}`,
    ].join("\n\n");

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();

    if (!rawText) {
      return Response.json({ error: "Gemini returned an empty response." }, { status: 502 });
    }

    const parsed = normalizeRecommendation(parseJsonText<RecommendationCandidate>(rawText));

    if (!parsed) {
      return Response.json({ error: "Gemini returned an invalid recommendation payload." }, { status: 502 });
    }

    return Response.json({ recommendation: parsed, averages, sampleCount: samples.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate vitals recommendation.";
    console.error("Vitals Recommendation Error:", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
